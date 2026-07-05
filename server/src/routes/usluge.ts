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

export const RATING_COMMENT_MAX = 160;

// Ocena završenog posla: zvezdice 1–5 + opcioni kratak komentar (≤160).
function validateRating(body: unknown):
  | { ok: true; stars: number; comment: string | null }
  | { ok: false; error: string } {
  const b = body as { stars?: unknown; comment?: unknown } | null;
  const stars = Number(b?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: 'stars mora biti ceo broj 1–5' };
  }
  let comment: string | null = null;
  if (b?.comment !== undefined && b?.comment !== null) {
    if (typeof b.comment !== 'string') return { ok: false, error: 'comment mora biti tekst' };
    comment = b.comment.trim();
    if (comment.length === 0) comment = null;
    else if (comment.length > RATING_COMMENT_MAX) {
      return { ok: false, error: `comment: najviše ${RATING_COMMENT_MAX} karaktera` };
    }
  }
  return { ok: true, stars, comment };
}

interface MajstorStats {
  avgRating: number | null;
  ratingCount: number;
  completedJobs: number;
  avgResponseMinutes: number | null;
}

const EMPTY_STATS: MajstorStats = {
  avgRating: null,
  ratingCount: 0,
  completedJobs: 0,
  avgResponseMinutes: null,
};

// Agregati po majstoru za picker i javnu /majstori stranicu: prosečna ocena,
// broj ocena, broj ZAVRŠENIH poslova (completed — ne samo prihvaćenih) i
// prosečno vreme od objave zahteva do slanja ponude.
async function majstorStats(): Promise<Map<number, MajstorStats>> {
  const rows = await db.execute<{
    userId: number;
    avgRating: number | null;
    ratingCount: number;
    completedJobs: number;
    avgResponseMinutes: number | null;
  }>(sql`
    SELECT
      o.majstor_user_id AS "userId",
      ROUND(AVG(o.rating_stars) FILTER (WHERE o.rating_stars IS NOT NULL)::numeric, 1)::float
        AS "avgRating",
      (COUNT(*) FILTER (WHERE o.rating_stars IS NOT NULL))::int AS "ratingCount",
      (COUNT(*) FILTER (WHERE j.status = 'completed' AND j.accepted_offer_id = o.id))::int
        AS "completedJobs",
      ROUND(AVG(EXTRACT(EPOCH FROM (o.created_at - j.created_at)) / 60))::int
        AS "avgResponseMinutes"
    FROM service_offers o
    JOIN service_jobs j ON j.id = o.job_id
    GROUP BY o.majstor_user_id
  `);
  return new Map(
    rows.map((r) => [
      Number(r.userId),
      {
        avgRating: r.avgRating === null ? null : Number(r.avgRating),
        ratingCount: Number(r.ratingCount),
        completedJobs: Number(r.completedJobs),
        avgResponseMinutes: r.avgResponseMinutes === null ? null : Number(r.avgResponseMinutes),
      },
    ]),
  );
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
  // Ocena naručioca (samo na prihvaćenoj ponudi završenog posla).
  ratingStars: number | null;
  ratingComment: string | null;
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
      // Metrike (ocena / broj poslova / brzina odgovora) uz svaku karticu —
      // bolje ocenjeni idu prvi, majstori bez istorije na kraj po imenu.
      const stats = await majstorStats();
      return rows
        .map((r) => ({ ...r, ...(stats.get(r.id) ?? EMPTY_STATS) }))
        .sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || b.completedJobs - a.completedJobs);
    },
  );

  // Public: imenik majstora za /majstori — kategorije, metrike i poslednje
  // ocene sa kratkim komentarima. Namerno javno (odluka: poverenje > privatnost
  // imena majstora); komentari nose ime naručioca kao i komentari na objektima.
  app.get('/api/majstori', async () => {
    const grants = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        categoryId: majstorCategories.categoryId,
      })
      .from(majstorCategories)
      .innerJoin(users, eq(majstorCategories.userId, users.id))
      .orderBy(users.displayName, majstorCategories.categoryId);

    const stats = await majstorStats();

    // Poslednje ocene po majstoru (cap 10 po majstoru, 300 ukupno — selo).
    // type (ne interface) — db.execute<T> traži implicitni index signature.
    type ReviewRow = {
      majstorId: number;
      stars: number;
      comment: string | null;
      ratedAt: string;
      categoryId: string;
      reviewerName: string;
    };
    const reviewRows = await db.execute<ReviewRow>(sql`
      SELECT
        o.majstor_user_id AS "majstorId",
        o.rating_stars    AS "stars",
        o.rating_comment  AS "comment",
        o.rated_at        AS "ratedAt",
        j.category_id     AS "categoryId",
        ru.display_name   AS "reviewerName"
      FROM service_offers o
      JOIN service_jobs j ON j.id = o.job_id
      JOIN users ru ON ru.id = j.user_id
      WHERE o.rating_stars IS NOT NULL
      ORDER BY o.rated_at DESC
      LIMIT 300
    `);
    const reviewsByMajstor = new Map<number, ReviewRow[]>();
    for (const r of reviewRows) {
      const key = Number(r.majstorId);
      const arr = reviewsByMajstor.get(key) ?? [];
      if (arr.length < 10) arr.push(r);
      reviewsByMajstor.set(key, arr);
    }

    const byUser = new Map<number, { id: number; displayName: string; categories: string[] }>();
    for (const g of grants) {
      const entry = byUser.get(g.id) ?? { id: g.id, displayName: g.displayName, categories: [] };
      entry.categories.push(g.categoryId);
      byUser.set(g.id, entry);
    }

    return [...byUser.values()]
      .map((m) => ({
        ...m,
        ...(stats.get(m.id) ?? EMPTY_STATS),
        reviews: (reviewsByMajstor.get(m.id) ?? []).map((r) => ({
          stars: Number(r.stars),
          comment: r.comment,
          ratedAt: r.ratedAt,
          categoryId: r.categoryId,
          reviewerName: r.reviewerName,
        })),
      }))
      .sort(
        (a, b) =>
          (b.avgRating ?? -1) - (a.avgRating ?? -1) ||
          b.completedJobs - a.completedJobs ||
          a.displayName.localeCompare(b.displayName, 'sr'),
      );
  });

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
        ratingStars: serviceOffers.ratingStars,
        ratingComment: serviceOffers.ratingComment,
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
        ratingStars: o.ratingStars,
        ratingComment: o.ratingComment,
      });
      byJob.set(o.jobId, arr);
    }
    return jobs.map((j) => ({ ...j, offers: byJob.get(j.id) ?? [] }));
  });

  // Naručilac: prihvatanje jedne ponude (ostale se arhiviraju), otkazivanje,
  // označavanje posla završenim i ocenjivanje majstora (posle završetka).
  app.patch<{
    Params: { id: string };
    Body: { action?: string; offerId?: number; stars?: number; comment?: string };
  }>(
    '/api/me/usluge/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const action = req.body?.action;
      if (action !== 'accept' && action !== 'cancel' && action !== 'complete' && action !== 'rate') {
        return reply
          .code(400)
          .send({ error: "action mora biti 'accept', 'cancel', 'complete' ili 'rate'" });
      }
      const offerId = Number(req.body?.offerId);
      if (action === 'accept' && (!Number.isInteger(offerId) || offerId <= 0)) {
        return reply.code(400).send({ error: 'offerId je obavezan za prihvatanje ponude' });
      }
      const rating = action === 'rate' ? validateRating(req.body) : null;
      if (rating && !rating.ok) return reply.code(400).send({ error: rating.error });

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

        const now = new Date();

        // Završetak: samo iz 'accepted' (posao u toku) — može i majstor sa
        // svoje strane (POST /api/majstor/jobs/:id/complete).
        if (action === 'complete') {
          if (job.status !== 'accepted') {
            return { code: 409 as const, error: 'Posao nije u toku — nema šta da se završi.' };
          }
          const [updated] = await tx
            .update(serviceJobs)
            .set({ status: 'completed', completedAt: now, completedBy: req.user.sub })
            .where(eq(serviceJobs.id, job.id))
            .returning();
          return { code: 200 as const, job: updated };
        }

        // Ocena: samo posle završetka; upisuje se na prihvaćenu ponudu.
        // Ponovno slanje menja postojeću ocenu (nisko-rizičan overwrite).
        if (action === 'rate') {
          if (job.status !== 'completed' || job.acceptedOfferId === null) {
            return { code: 409 as const, error: 'Ocena je moguća tek kada je posao završen.' };
          }
          const r = rating as { ok: true; stars: number; comment: string | null };
          await tx
            .update(serviceOffers)
            .set({ ratingStars: r.stars, ratingComment: r.comment, ratedAt: now })
            .where(eq(serviceOffers.id, job.acceptedOfferId));
          return { code: 200 as const, job };
        }

        if (job.status !== 'open') return { code: 409 as const, error: 'Zahtev više nije otvoren.' };

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
        completedAt: serviceJobs.completedAt,
        requesterUserId: users.id,
        requesterDisplayName: users.displayName,
        requesterEmail: users.email,
        offerId: serviceOffers.id,
        offerQuote: serviceOffers.quote,
        offerStatus: serviceOffers.status,
        offerCreatedAt: serviceOffers.createdAt,
        offerUpdatedAt: serviceOffers.updatedAt,
        offerRatingStars: serviceOffers.ratingStars,
        offerRatingComment: serviceOffers.ratingComment,
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
          : (r.status === 'accepted' || r.status === 'completed') && !mine
            ? ('accepted_other' as const)
            : null;
      return {
        id: r.id,
        categoryId: r.categoryId,
        payload: r.payload,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
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
                // Dobijena ocena — vidljiva majstoru na završenom poslu.
                ratingStars: r.offerRatingStars,
                ratingComment: r.offerRatingComment,
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

  // Majstor: označavanje posla završenim — sme SAMO majstor čija je ponuda
  // prihvaćena, i samo iz statusa 'accepted'. Naručilac isto može sa svoje
  // strane (PATCH /api/me/usluge/:id, action 'complete') — bilo ko od dvoje.
  app.post<{ Params: { id: string } }>(
    '/api/majstor/jobs/:id/complete',
    { preHandler: requireRole('majstor') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const me = req.user.sub;

      const result = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(serviceJobs)
          .where(eq(serviceJobs.id, id))
          .for('update')
          .limit(1);
        if (!job) return { code: 404 as const, error: 'Not found' };
        if (job.acceptedOfferId === null) {
          return { code: 409 as const, error: 'Posao nije u toku — nema šta da se završi.' };
        }
        const [acceptedOffer] = await tx
          .select({ majstorUserId: serviceOffers.majstorUserId })
          .from(serviceOffers)
          .where(eq(serviceOffers.id, job.acceptedOfferId))
          .limit(1);
        // Tuđi posao se ponaša kao nepostojeći (bez sondiranja ID-eva).
        if (!acceptedOffer || acceptedOffer.majstorUserId !== me) {
          return { code: 404 as const, error: 'Not found' };
        }
        if (job.status !== 'accepted') {
          return { code: 409 as const, error: 'Posao je već završen ili otkazan.' };
        }
        const [updated] = await tx
          .update(serviceJobs)
          .set({ status: 'completed', completedAt: new Date(), completedBy: me })
          .where(eq(serviceJobs.id, job.id))
          .returning();
        return { code: 200 as const, job: updated };
      });

      if (result.code !== 200) return reply.code(result.code).send({ error: result.error });
      return result.job;
    },
  );
}
