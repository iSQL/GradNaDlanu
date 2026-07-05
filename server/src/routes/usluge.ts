import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, inArray, ne, or, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { majstorCategories, media, serviceJobs, serviceOffers, users } from '../db/schema.js';
import type { ServiceOffer } from '../db/schema.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { guestsCanBook } from '../lib/settings.js';
import { validateQuote } from '../lib/serviceRequests.js';
import {
  SERVICE_CATEGORIES,
  isServiceCategory,
  validateJobPayload,
  validateTargetUserIds,
} from '../lib/usluge.js';

// "Usluge" — broadcast zahtevi za majstore po kategorijama usluga. Paralelan
// (netaknut) je stariji 1-na-1 flow u service-requests.ts koji cilja jedan
// majstorski OBJEKAT; ovde se cilja skup majstora-KORISNIKA (majstor_categories).
//
// Životni ciklus: job open → accepted (naručilac prihvata jednu ponudu; ostale
// aktivne se arhiviraju) ili open → cancelled (sve aktivne ponude se arhiviraju).
// Majstor po job-u ima najviše jednu ponudu (UNIQUE) — ponovno slanje je upsert.

// jsonb uslov targetiranja: NULL = broadcast, inače niz mora sadržati korisnika.
function targetingAllows(userId: number) {
  return sql`(${serviceJobs.targetUserIds} IS NULL OR ${serviceJobs.targetUserIds} @> ${JSON.stringify([userId])}::jsonb)`;
}

interface JobOfferOut {
  id: number;
  majstorUserId: number;
  majstorDisplayName: string;
  // Telefon majstora — otkriva se naručiocu tek kada prihvati OVU ponudu.
  majstorPhone: string | null;
  quote: unknown;
  status: ServiceOffer['status'];
  createdAt: Date;
  updatedAt: Date;
}

export async function uslugeRoutes(app: FastifyInstance) {
  // Public: broj dostupnih majstora po kategoriji (sidebar na /usluge).
  app.get('/api/usluge/stats', async () => {
    const rows = await db
      .select({ categoryId: majstorCategories.categoryId, majstorCount: count() })
      .from(majstorCategories)
      .groupBy(majstorCategories.categoryId);
    const byCat = new Map(rows.map((r) => [r.categoryId, Number(r.majstorCount)]));
    return SERVICE_CATEGORIES.map((categoryId) => ({
      categoryId,
      majstorCount: byCat.get(categoryId) ?? 0,
    }));
  });

  // Lista majstora jedne kategorije za "Izaberi majstore" picker. Samo id +
  // displayName (bez PII); iza prijave da javni API ne izlaže spisak imena.
  app.get<{ Querystring: { cat?: string } }>(
    '/api/usluge/majstori',
    { preHandler: requireAuth },
    async (req, reply) => {
      const cat = req.query.cat;
      if (!isServiceCategory(cat)) {
        return reply.code(400).send({ error: 'cat mora biti jedna od kategorija usluga' });
      }
      const rows = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(majstorCategories)
        .innerJoin(users, eq(majstorCategories.userId, users.id))
        .where(eq(majstorCategories.categoryId, cat))
        .orderBy(users.displayName);
      return rows;
    },
  );

  // Naručilac: kreiranje broadcast zahteva.
  app.post<{
    Body: {
      categoryId?: string;
      description?: unknown;
      note?: unknown;
      photoIds?: unknown;
      targetUserIds?: unknown;
    };
  }>('/api/usluge/jobs', { preHandler: requireAuth }, async (req, reply) => {
    // Isti gate kao rezervacije / 1-na-1 zahtevi: bez trajnog naloga majstor
    // nema kome da odgovori.
    if (req.user.role === 'guest' && !(await guestsCanBook())) {
      return reply.code(403).send({
        error: 'Za zahtev za uslugu je potreban trajan nalog.',
        code: 'guest_not_allowed',
      });
    }

    const categoryId = req.body?.categoryId;
    if (!isServiceCategory(categoryId)) {
      return reply.code(400).send({ error: 'categoryId mora biti jedna od kategorija usluga' });
    }

    const v = validateJobPayload(req.body);
    if (!v.ok) return reply.code(400).send({ error: v.error });

    const t = validateTargetUserIds(req.body?.targetUserIds);
    if (!t.ok) return reply.code(400).send({ error: t.error });

    // Slike moraju biti moje i tipa service_photo — broadcast širi publiku
    // medija na sve majstore kategorije, pa se vlasništvo proverava strogo.
    if (v.payload.photoIds.length > 0) {
      const owned = await db
        .select({ id: media.id })
        .from(media)
        .where(
          and(
            inArray(media.id, v.payload.photoIds),
            eq(media.ownerUserId, req.user.sub),
            eq(media.kind, 'service_photo'),
          ),
        );
      if (owned.length !== v.payload.photoIds.length) {
        return reply.code(400).send({ error: 'Neki od poslatih photoIds ne postoje ili nisu vaši' });
      }
    }

    // Ručno izabrani primaoci moraju biti majstori upravo ove kategorije.
    let targetUserIds = t.ids;
    if (targetUserIds) {
      targetUserIds = targetUserIds.filter((id) => id !== req.user.sub);
      if (targetUserIds.length === 0) {
        return reply.code(400).send({ error: 'Izaberite bar jednog majstora ili pošaljite svima.' });
      }
      const valid = await db
        .select({ userId: majstorCategories.userId })
        .from(majstorCategories)
        .where(
          and(
            eq(majstorCategories.categoryId, categoryId),
            inArray(majstorCategories.userId, targetUserIds),
          ),
        );
      if (valid.length !== targetUserIds.length) {
        return reply
          .code(400)
          .send({ error: 'Neki od izabranih majstora nisu dostupni za ovu kategoriju.' });
      }
    }

    const [row] = await db
      .insert(serviceJobs)
      .values({
        userId: req.user.sub,
        categoryId,
        payload: v.payload,
        targetUserIds,
      })
      .returning();
    return reply.code(201).send(row);
  });

  // Naručilac: moji zahtevi sa svim pristiglim ponudama.
  app.get('/api/me/usluge', { preHandler: requireAuth }, async (req) => {
    const jobs = await db
      .select()
      .from(serviceJobs)
      .where(eq(serviceJobs.userId, req.user.sub))
      .orderBy(desc(serviceJobs.createdAt));
    if (jobs.length === 0) return [];

    const offerRows = await db
      .select({
        id: serviceOffers.id,
        jobId: serviceOffers.jobId,
        majstorUserId: serviceOffers.majstorUserId,
        majstorDisplayName: users.displayName,
        majstorPhone: users.phone,
        quote: serviceOffers.quote,
        status: serviceOffers.status,
        createdAt: serviceOffers.createdAt,
        updatedAt: serviceOffers.updatedAt,
      })
      .from(serviceOffers)
      .innerJoin(users, eq(serviceOffers.majstorUserId, users.id))
      .where(inArray(serviceOffers.jobId, jobs.map((j) => j.id)))
      .orderBy(serviceOffers.createdAt);

    const byJob = new Map<number, JobOfferOut[]>();
    for (const o of offerRows) {
      const arr = byJob.get(o.jobId) ?? [];
      arr.push({
        id: o.id,
        majstorUserId: o.majstorUserId,
        majstorDisplayName: o.majstorDisplayName,
        // Kontakt se ne izlaže dok ponuda nije prihvaćena — konkurentski
        // majstori i otvorene ponude ostaju bez telefona u payload-u.
        majstorPhone: o.status === 'accepted' ? o.majstorPhone : null,
        quote: o.quote,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      });
      byJob.set(o.jobId, arr);
    }
    return jobs.map((j) => ({ ...j, offers: byJob.get(j.id) ?? [] }));
  });

  // Naručilac: prihvatanje jedne ponude (ostale se arhiviraju) ili otkazivanje.
  app.patch<{ Params: { id: string }; Body: { action?: string; offerId?: number } }>(
    '/api/me/usluge/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const action = req.body?.action;
      if (action !== 'accept' && action !== 'cancel') {
        return reply.code(400).send({ error: "action mora biti 'accept' ili 'cancel'" });
      }
      const offerId = Number(req.body?.offerId);
      if (action === 'accept' && (!Number.isInteger(offerId) || offerId <= 0)) {
        return reply.code(400).send({ error: 'offerId je obavezan za prihvatanje ponude' });
      }

      const result = await db.transaction(async (tx) => {
        // FOR UPDATE drži bravu nad job redom do commit-a — konkurentan accept/
        // cancel/offer čeka pa vidi već promenjen status (409 umesto trke).
        const [job] = await tx
          .select()
          .from(serviceJobs)
          .where(and(eq(serviceJobs.id, id), eq(serviceJobs.userId, req.user.sub)))
          .for('update')
          .limit(1);
        if (!job) return { code: 404 as const, error: 'Not found' };
        if (job.status !== 'open') return { code: 409 as const, error: 'Zahtev više nije otvoren.' };

        const now = new Date();
        if (action === 'accept') {
          const [offer] = await tx
            .update(serviceOffers)
            .set({ status: 'accepted', updatedAt: now })
            .where(
              and(
                eq(serviceOffers.id, offerId),
                eq(serviceOffers.jobId, job.id),
                eq(serviceOffers.status, 'active'),
              ),
            )
            .returning();
          if (!offer) {
            return { code: 400 as const, error: 'Ponuda nije aktivna ili ne pripada ovom zahtevu.' };
          }
          await tx
            .update(serviceOffers)
            .set({ status: 'archived', updatedAt: now })
            .where(
              and(
                eq(serviceOffers.jobId, job.id),
                ne(serviceOffers.id, offerId),
                eq(serviceOffers.status, 'active'),
              ),
            );
          const [updated] = await tx
            .update(serviceJobs)
            .set({ status: 'accepted', acceptedOfferId: offerId })
            .where(eq(serviceJobs.id, job.id))
            .returning();
          return { code: 200 as const, job: updated };
        }

        // cancel
        await tx
          .update(serviceOffers)
          .set({ status: 'archived', updatedAt: now })
          .where(and(eq(serviceOffers.jobId, job.id), eq(serviceOffers.status, 'active')));
        const [updated] = await tx
          .update(serviceJobs)
          .set({ status: 'cancelled' })
          .where(eq(serviceJobs.id, job.id))
          .returning();
        return { code: 200 as const, job: updated };
      });

      if (result.code !== 200) return reply.code(result.code).send({ error: result.error });
      return result.job;
    },
  );

  // Majstor: inbox — otvoreni zahtevi mojih kategorija (koji me targetiraju)
  // plus svi na kojima imam ponudu (radi arhive i statusa "prihvaćena").
  app.get('/api/majstor/jobs', { preHandler: requireRole('majstor') }, async (req) => {
    const me = req.user.sub;
    const myCats = await db
      .select({ categoryId: majstorCategories.categoryId })
      .from(majstorCategories)
      .where(eq(majstorCategories.userId, me));
    if (myCats.length === 0) return [];

    const rows = await db
      .select({
        id: serviceJobs.id,
        categoryId: serviceJobs.categoryId,
        payload: serviceJobs.payload,
        status: serviceJobs.status,
        acceptedOfferId: serviceJobs.acceptedOfferId,
        createdAt: serviceJobs.createdAt,
        requesterUserId: users.id,
        requesterDisplayName: users.displayName,
        requesterEmail: users.email,
        offerId: serviceOffers.id,
        offerQuote: serviceOffers.quote,
        offerStatus: serviceOffers.status,
        offerCreatedAt: serviceOffers.createdAt,
        offerUpdatedAt: serviceOffers.updatedAt,
      })
      .from(serviceJobs)
      .innerJoin(users, eq(serviceJobs.userId, users.id))
      .leftJoin(
        serviceOffers,
        and(eq(serviceOffers.jobId, serviceJobs.id), eq(serviceOffers.majstorUserId, me)),
      )
      .where(
        and(
          inArray(serviceJobs.categoryId, myCats.map((c) => c.categoryId)),
          ne(serviceJobs.userId, me),
          targetingAllows(me),
          or(eq(serviceJobs.status, 'open'), isNotNull(serviceOffers.id)),
        ),
      )
      .orderBy(desc(serviceJobs.createdAt));

    return rows.map((r) => {
      const mine = r.offerId !== null && r.acceptedOfferId === r.offerId;
      const archivedReason =
        r.status === 'cancelled'
          ? ('cancelled' as const)
          : r.status === 'accepted' && !mine
            ? ('accepted_other' as const)
            : null;
      return {
        id: r.id,
        categoryId: r.categoryId,
        payload: r.payload,
        status: r.status,
        createdAt: r.createdAt,
        requesterDisplayName: r.requesterDisplayName,
        // Kontakt naručioca se otkriva tek kada je MOJA ponuda prihvaćena —
        // do tada majstori vide samo ime (broadcast bi inače leak-ovao email).
        // `requesterId` isto: služi za "Pošalji poruku" (conversations).
        requesterEmail: mine ? r.requesterEmail : null,
        requesterId: mine ? r.requesterUserId : null,
        myOffer:
          r.offerId === null
            ? null
            : {
                id: r.offerId,
                quote: r.offerQuote,
                status: r.offerStatus,
                createdAt: r.offerCreatedAt,
                updatedAt: r.offerUpdatedAt,
              },
        archivedReason,
      };
    });
  });

  // Majstor: slanje/izmena kontraponude (upsert po UNIQUE(job_id, majstor_user_id)).
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/majstor/jobs/:id/offer',
    { preHandler: requireRole('majstor') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const me = req.user.sub;
      const v = validateQuote(req.body);
      if (!v.ok) return reply.code(400).send({ error: v.error });

      const result = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(serviceJobs)
          .where(eq(serviceJobs.id, id))
          .for('update')
          .limit(1);
        // Nevidljivi job-ovi (tuđa kategorija, nisam targetiran, moj sopstveni)
        // vraćaju 404 — isto kao da ne postoje, da se ID-evi ne mogu sondirati.
        if (!job || job.userId === me) return { code: 404 as const, error: 'Not found' };
        const [grant] = await tx
          .select()
          .from(majstorCategories)
          .where(
            and(eq(majstorCategories.userId, me), eq(majstorCategories.categoryId, job.categoryId)),
          )
          .limit(1);
        if (!grant) return { code: 404 as const, error: 'Not found' };
        if (job.targetUserIds && !job.targetUserIds.includes(me)) {
          return { code: 404 as const, error: 'Not found' };
        }
        if (job.status !== 'open') return { code: 409 as const, error: 'Zahtev više nije otvoren.' };

        const [offer] = await tx
          .insert(serviceOffers)
          .values({ jobId: job.id, majstorUserId: me, quote: v.quote })
          .onConflictDoUpdate({
            target: [serviceOffers.jobId, serviceOffers.majstorUserId],
            set: { quote: v.quote, status: 'active', updatedAt: new Date() },
          })
          .returning();
        return { code: 201 as const, offer };
      });

      if (result.code !== 201) return reply.code(result.code).send({ error: result.error });
      return reply.code(201).send(result.offer);
    },
  );
}
