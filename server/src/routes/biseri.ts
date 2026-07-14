import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  biserComments,
  biseri,
  biserLikes,
  media,
  users,
  villageCurators,
} from '../db/schema.js';
import { getOptionalUser, requireAuth, requireRole } from '../lib/auth.js';
import { touchGuestActivity } from '../lib/guest-activity.js';
import { isVillage } from '../lib/villages.js';
import { COMMENT_MAX, validateBiserInput } from '../lib/biseri.js';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

function clampLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function clampOffset(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// Lajkovi / komentari kao korelirani podupiti — kolekcija je mala (opštinski
// nivo), isti pristup kao kod prijava problema.
const likesExpr = sql<number>`(SELECT COUNT(*)::int FROM biser_likes bl WHERE bl.biser_id = ${biseri.id})`;
const commentCountExpr = sql<number>`(SELECT COUNT(*)::int FROM biser_comments bc WHERE bc.biser_id = ${biseri.id})`;

function likedExpr(userId: number | null) {
  if (userId === null) return sql<boolean>`false`;
  return sql<boolean>`EXISTS (SELECT 1 FROM biser_likes bl WHERE bl.biser_id = ${biseri.id} AND bl.user_id = ${userId})`;
}

// Javni oblik bisera. `contributorName` je display ime autora ili NULL kad je
// nalog u međuvremenu obrisan — nikad email/ID.
function publicColumns(userId: number | null) {
  return {
    id: biseri.id,
    title: biseri.title,
    year: biseri.year,
    village: biseri.village,
    story: biseri.story,
    lat: biseri.lat,
    lng: biseri.lng,
    photoMediaId: biseri.photoMediaId,
    nowPhotoMediaId: biseri.nowPhotoMediaId,
    status: biseri.status,
    createdAt: biseri.createdAt,
    contributorName: users.displayName,
    likes: likesExpr,
    commentCount: commentCountExpr,
    liked: likedExpr(userId),
  } as const;
}

// Sme li korisnik da moderira biser (odobri / odbije / vrati u pending):
// admin uvek; kustos ako je selo bisera u njegovim grantovima.
async function canModerate(
  user: { sub: number; role: string } | null,
  village: string,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'curator') return false;
  const [hit] = await db
    .select({ userId: villageCurators.userId })
    .from(villageCurators)
    .where(and(eq(villageCurators.userId, user.sub), eq(villageCurators.villageName, village)))
    .limit(1);
  return !!hit;
}

// Provera fotografije pri kreiranju: mora biti biser_photo, u vlasništvu
// pošiljaoca i još nevezana za drugi biser (bilo koju od dve kolone).
async function checkPhoto(
  mediaId: number,
  ownerId: number,
): Promise<string | null> {
  const [m] = await db
    .select({ id: media.id, kind: media.kind, ownerUserId: media.ownerUserId })
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);
  if (!m || m.kind !== 'biser_photo') return 'Neispravna fotografija.';
  if (m.ownerUserId !== ownerId) return 'Fotografija ne pripada vama.';
  const [taken] = await db
    .select({ id: biseri.id })
    .from(biseri)
    .where(or(eq(biseri.photoMediaId, mediaId), eq(biseri.nowPhotoMediaId, mediaId)))
    .limit(1);
  if (taken) return 'Fotografija je već iskorišćena.';
  return null;
}

export async function biseriRoutes(app: FastifyInstance) {
  // Public: objavljeni biseri, najnoviji prvi. Filtriranje po deceniji je
  // klijentska stvar (kolekcija je mala); selo filtriramo i ovde zbog deep-linkova.
  app.get<{ Querystring: { village?: string; limit?: string; offset?: string } }>(
    '/api/biseri',
    async (req, reply) => {
      const user = await getOptionalUser(req);
      const conds = [eq(biseri.status, 'published' as const)];
      const village = req.query.village?.trim();
      if (village && isVillage(village)) conds.push(eq(biseri.village, village));
      const where = and(...conds);

      const rows = await db
        .select(publicColumns(user?.sub ?? null))
        .from(biseri)
        .leftJoin(users, eq(biseri.userId, users.id))
        .where(where)
        .orderBy(desc(biseri.createdAt))
        .limit(clampLimit(req.query.limit))
        .offset(clampOffset(req.query.offset));

      const [{ total }] = await db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(biseri)
        .where(where);
      reply.header('X-Total-Count', String(total));
      return rows;
    },
  );

  // Moderacija: predlozi na čekanju. Admin vidi sve, kustos samo svoja sela.
  // Registrovano pre /api/biseri/:id — statička ruta ima prednost nad param rutom.
  app.get('/api/biseri/pending', { preHandler: requireAuth }, async (req, reply) => {
    let where;
    if (req.user.role === 'admin') {
      where = eq(biseri.status, 'pending' as const);
    } else if (req.user.role === 'curator') {
      const grants = await db
        .select({ villageName: villageCurators.villageName })
        .from(villageCurators)
        .where(eq(villageCurators.userId, req.user.sub));
      if (grants.length === 0) return reply.code(403).send({ error: 'Forbidden' });
      where = and(
        eq(biseri.status, 'pending' as const),
        inArray(biseri.village, grants.map((g) => g.villageName)),
      );
    } else {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return db
      .select(publicColumns(req.user.sub))
      .from(biseri)
      .leftJoin(users, eq(biseri.userId, users.id))
      .where(where)
      .orderBy(desc(biseri.createdAt));
  });

  // Public: jedan biser sa komentarima. Neobjavljeni je vidljiv samo autoru,
  // adminu i kustosu sela (pregled pre odobrenja).
  app.get<{ Params: { id: string } }>('/api/biseri/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
    const user = await getOptionalUser(req);

    const [row] = await db
      .select({ ...publicColumns(user?.sub ?? null), userId: biseri.userId })
      .from(biseri)
      .leftJoin(users, eq(biseri.userId, users.id))
      .where(eq(biseri.id, id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: 'Not found' });

    const moderator = await canModerate(user, row.village);
    const isContributor = user !== null && row.userId !== null && row.userId === user.sub;
    if (row.status !== 'published' && !isContributor && !moderator) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const commentRows = await db
      .select({
        id: biserComments.id,
        body: biserComments.body,
        createdAt: biserComments.createdAt,
        authorId: users.id,
        authorName: users.displayName,
      })
      .from(biserComments)
      .innerJoin(users, eq(biserComments.userId, users.id))
      .where(eq(biserComments.biserId, id))
      .orderBy(biserComments.createdAt);

    const { userId, ...pub } = row;
    return {
      ...pub,
      canModerate: moderator,
      // Naknadno dodavanje "Danas" fotke: autor ili moderator (admin/kustos sela).
      canEdit: isContributor || moderator,
      comments: commentRows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: { id: c.authorId, displayName: c.authorName },
      })),
    };
  });

  // Novi biser — traži nalog (autor je deo sadržaja), uvek sleće u 'pending'
  // i čeka odobrenje kustosa sela ili admina.
  app.post<{ Body: unknown }>(
    '/api/biseri',
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const parsed = validateBiserInput(req.body, isVillage);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
      const input = parsed.value;

      const photoErr = await checkPhoto(input.photoMediaId, req.user.sub);
      if (photoErr) return reply.code(400).send({ error: photoErr });
      if (input.nowPhotoMediaId !== null) {
        const nowErr = await checkPhoto(input.nowPhotoMediaId, req.user.sub);
        if (nowErr) return reply.code(400).send({ error: nowErr });
      }

      const [row] = await db
        .insert(biseri)
        .values({
          userId: req.user.sub,
          title: input.title,
          year: input.year,
          village: input.village,
          story: input.story,
          lat: input.lat,
          lng: input.lng,
          photoMediaId: input.photoMediaId,
          nowPhotoMediaId: input.nowPhotoMediaId,
        })
        .returning();
      touchGuestActivity(req.user.sub, req.user.role);

      req.log.info(
        { biserId: row.id, village: row.village, year: row.year, by: req.user.sub },
        'biser submitted',
      );
      return reply.code(201).send({ id: row.id, status: row.status });
    },
  );

  // Lajk (toggle) — samo ulogovani, samo na objavljene.
  app.post<{ Params: { id: string } }>(
    '/api/biseri/:id/like',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [b] = await db
        .select({ id: biseri.id })
        .from(biseri)
        .where(and(eq(biseri.id, id), eq(biseri.status, 'published')))
        .limit(1);
      if (!b) return reply.code(404).send({ error: 'Not found' });

      const inserted = await db
        .insert(biserLikes)
        .values({ biserId: id, userId: req.user.sub })
        .onConflictDoNothing()
        .returning({ biserId: biserLikes.biserId });
      if (inserted.length === 0) {
        await db
          .delete(biserLikes)
          .where(and(eq(biserLikes.biserId, id), eq(biserLikes.userId, req.user.sub)));
      }
      touchGuestActivity(req.user.sub, req.user.role);

      const [{ likes }] = await db
        .select({ likes: sql<number>`COUNT(*)::int` })
        .from(biserLikes)
        .where(eq(biserLikes.biserId, id));
      return { liked: inserted.length > 0, likes };
    },
  );

  // Komentar — samo ulogovani, ravna lista, samo na objavljene.
  app.post<{ Params: { id: string }; Body: { body?: unknown } }>(
    '/api/biseri/:id/comments',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!body) return reply.code(400).send({ error: 'Komentar ne može biti prazan.' });
      if (body.length > COMMENT_MAX) {
        return reply.code(400).send({ error: `Komentar može imati najviše ${COMMENT_MAX} karaktera.` });
      }
      const [b] = await db
        .select({ id: biseri.id })
        .from(biseri)
        .where(and(eq(biseri.id, id), eq(biseri.status, 'published')))
        .limit(1);
      if (!b) return reply.code(404).send({ error: 'Not found' });

      const [row] = await db
        .insert(biserComments)
        .values({ biserId: id, userId: req.user.sub, body })
        .returning();
      touchGuestActivity(req.user.sub, req.user.role);

      const [author] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, req.user.sub))
        .limit(1);
      return reply.code(201).send({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        author,
      });
    },
  );

  // Dve nezavisne PATCH operacije: moderacija statusa (admin/kustos sela) i
  // naknadno dodavanje/uklanjanje "Danas" fotke (autor ili moderator) — telo
  // nosi ILI `status` ILI `nowPhotoMediaId`, ne oba odjednom.
  app.patch<{ Params: { id: string }; Body: { status?: unknown; nowPhotoMediaId?: unknown } }>(
    '/api/biseri/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [b] = await db
        .select({
          id: biseri.id,
          userId: biseri.userId,
          village: biseri.village,
          photoMediaId: biseri.photoMediaId,
        })
        .from(biseri)
        .where(eq(biseri.id, id))
        .limit(1);
      if (!b) return reply.code(404).send({ error: 'Not found' });

      // Naknadni "Danas" snimak — autor ili moderator; null uklanja fotku
      // (media red posle čisti gcOrphanMedia).
      if ('nowPhotoMediaId' in (req.body ?? {})) {
        const isContributor = b.userId !== null && b.userId === req.user.sub;
        if (!isContributor && !(await canModerate(req.user, b.village))) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
        let nowPhotoMediaId: number | null = null;
        if (req.body?.nowPhotoMediaId !== null) {
          nowPhotoMediaId = Number(req.body?.nowPhotoMediaId);
          if (!Number.isInteger(nowPhotoMediaId) || nowPhotoMediaId < 1) {
            return reply.code(400).send({ error: 'Neispravna današnja fotografija.' });
          }
          if (nowPhotoMediaId === b.photoMediaId) {
            return reply.code(400).send({ error: 'Nekad i danas ne mogu biti ista fotografija.' });
          }
          const photoErr = await checkPhoto(nowPhotoMediaId, req.user.sub);
          if (photoErr) return reply.code(400).send({ error: photoErr });
        }
        const [row] = await db
          .update(biseri)
          .set({ nowPhotoMediaId, updatedAt: new Date() })
          .where(eq(biseri.id, id))
          .returning({ id: biseri.id, nowPhotoMediaId: biseri.nowPhotoMediaId });
        req.log.info(
          { biserId: id, nowPhotoMediaId, by: req.user.sub },
          'biser now-photo updated',
        );
        return row;
      }

      // Moderacija: odobri / odbij / vrati na čekanje — admin ili kustos sela.
      const status = req.body?.status;
      if (status !== 'published' && status !== 'rejected' && status !== 'pending') {
        return reply.code(400).send({ error: 'status must be "published", "rejected" or "pending"' });
      }
      if (!(await canModerate(req.user, b.village))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const [row] = await db
        .update(biseri)
        .set(
          status === 'pending'
            ? { status, decidedAt: null, decidedBy: null, updatedAt: new Date() }
            : { status, decidedAt: new Date(), decidedBy: req.user.sub, updatedAt: new Date() },
        )
        .where(eq(biseri.id, id))
        .returning({ id: biseri.id, status: biseri.status });
      req.log.info({ biserId: id, status, by: req.user.sub }, 'biser moderated');
      return row;
    },
  );

  // Admin: brisanje bisera (moderacija neprimerenog sadržaja).
  app.delete<{ Params: { id: string } }>(
    '/api/biseri/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const deleted = await db.delete(biseri).where(eq(biseri.id, id)).returning({ id: biseri.id });
      if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' });
      req.log.info({ biserId: id }, 'biser deleted by admin');
      return { ok: true };
    },
  );
}
