import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  media,
  problemComments,
  problems,
  problemVotes,
  users,
  villageCurators,
} from '../db/schema.js';
import type { ProblemStatus } from '../db/schema.js';
import { getOptionalUser, requireAuth, requireRole } from '../lib/auth.js';
import { touchGuestActivity } from '../lib/guest-activity.js';
import { isVillage } from '../lib/villages.js';
import { COMMENT_MAX, isProblemCategory, validateProblemInput } from '../lib/problemi.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

// Broj glasova / komentara kao korelirani podupiti — lista je mala (opštinski
// nivo), pa je ovo jednostavnije i dovoljno brzo naspram GROUP BY pristupa.
const votesExpr = sql<number>`(SELECT COUNT(*)::int FROM problem_votes pv WHERE pv.problem_id = ${problems.id})`;
const commentCountExpr = sql<number>`(SELECT COUNT(*)::int FROM problem_comments pc WHERE pc.problem_id = ${problems.id})`;

function votedExpr(userId: number | null) {
  if (userId === null) return sql<boolean>`false`;
  return sql<boolean>`EXISTS (SELECT 1 FROM problem_votes pv WHERE pv.problem_id = ${problems.id} AND pv.user_id = ${userId})`;
}

// Javni oblik prijave. `reporterName` je display ime ulogovanog prijavioca ili
// NULL za anonimne — nikad email/ID (ID ide samo u canResolve računicu).
function publicColumns(userId: number | null) {
  return {
    id: problems.id,
    catId: problems.catId,
    title: problems.title,
    description: problems.description,
    village: problems.village,
    address: problems.address,
    lat: problems.lat,
    lng: problems.lng,
    photoMediaId: problems.photoMediaId,
    status: problems.status,
    solvedAt: problems.solvedAt,
    createdAt: problems.createdAt,
    reporterName: users.displayName,
    votes: votesExpr,
    commentCount: commentCountExpr,
    voted: votedExpr(userId),
  } as const;
}

// Sme li korisnik da menja status prijave: admin uvek; kustos ako je selo
// prijave u njegovim grantovima; (ulogovani) prijavilac svoju prijavu.
async function canResolve(
  user: { sub: number; role: string } | null,
  problem: { userId: number | null; village: string },
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (problem.userId !== null && problem.userId === user.sub) return true;
  if (user.role === 'curator') {
    const [hit] = await db
      .select({ userId: villageCurators.userId })
      .from(villageCurators)
      .where(
        and(eq(villageCurators.userId, user.sub), eq(villageCurators.villageName, problem.village)),
      )
      .limit(1);
    return !!hit;
  }
  return false;
}

export async function problemiRoutes(app: FastifyInstance) {
  // Public: lista prijava sa filterima i sortiranjem (glasovi / najnovije).
  app.get<{
    Querystring: {
      cat?: string;
      status?: string;
      village?: string;
      sort?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/problemi', async (req, reply) => {
    const user = await getOptionalUser(req);
    const conds = [];
    const cat = req.query.cat?.trim();
    if (cat && isProblemCategory(cat)) conds.push(eq(problems.catId, cat));
    const status = req.query.status?.trim();
    if (status === 'open' || status === 'solved') {
      conds.push(eq(problems.status, status as ProblemStatus));
    }
    const village = req.query.village?.trim();
    if (village && isVillage(village)) conds.push(eq(problems.village, village));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const sort = req.query.sort === 'recent' ? 'recent' : 'votes';
    const order =
      sort === 'votes'
        ? [desc(votesExpr), desc(problems.createdAt)]
        : [desc(problems.createdAt)];

    const rows = await db
      .select(publicColumns(user?.sub ?? null))
      .from(problems)
      .leftJoin(users, eq(problems.userId, users.id))
      .where(where)
      .orderBy(...order)
      .limit(clampLimit(req.query.limit))
      .offset(clampOffset(req.query.offset));

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(problems)
      .where(where);
    reply.header('X-Total-Count', String(total));
    return rows;
  });

  // Public: jedna prijava sa komentarima. "official" bedž ("opština") se izvodi
  // iz uloge autora komentara — admin i kustosi govore u ime opštine.
  app.get<{ Params: { id: string } }>('/api/problemi/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
    const user = await getOptionalUser(req);

    const [row] = await db
      .select({ ...publicColumns(user?.sub ?? null), userId: problems.userId })
      .from(problems)
      .leftJoin(users, eq(problems.userId, users.id))
      .where(eq(problems.id, id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: 'Not found' });

    const commentRows = await db
      .select({
        id: problemComments.id,
        body: problemComments.body,
        createdAt: problemComments.createdAt,
        authorId: users.id,
        authorName: users.displayName,
        authorRole: users.role,
      })
      .from(problemComments)
      .innerJoin(users, eq(problemComments.userId, users.id))
      .where(eq(problemComments.problemId, id))
      .orderBy(problemComments.createdAt);

    const { userId, ...pub } = row;
    return {
      ...pub,
      canResolve: await canResolve(user, { userId, village: row.village }),
      comments: commentRows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: { id: c.authorId, displayName: c.authorName, role: c.authorRole },
        official: c.authorRole === 'admin' || c.authorRole === 'curator',
      })),
    };
  });

  // Public (i anonimno): nova prijava. Rate limit 5/1h po IP-u — prijava ne
  // traži nalog pa je ovo jedina brana od spama.
  app.post<{ Body: unknown }>(
    '/api/problemi',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const user = await getOptionalUser(req);
      const parsed = validateProblemInput(req.body, isVillage);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
      const input = parsed.value;

      if (input.photoMediaId !== null) {
        const [m] = await db
          .select({ id: media.id, kind: media.kind, ownerUserId: media.ownerUserId })
          .from(media)
          .where(eq(media.id, input.photoMediaId))
          .limit(1);
        // Fotka mora biti problem_photo i još "slobodna": bez vlasnika (anoniman
        // upload) ili u vlasništvu pošiljaoca, i nevezana za drugu prijavu.
        if (!m || m.kind !== 'problem_photo') {
          return reply.code(400).send({ error: 'Neispravna fotografija.' });
        }
        if (m.ownerUserId !== null && m.ownerUserId !== (user?.sub ?? -1)) {
          return reply.code(403).send({ error: 'Fotografija ne pripada vama.' });
        }
        const [taken] = await db
          .select({ id: problems.id })
          .from(problems)
          .where(eq(problems.photoMediaId, input.photoMediaId))
          .limit(1);
        if (taken) return reply.code(400).send({ error: 'Fotografija je već iskorišćena.' });
      }

      const [row] = await db
        .insert(problems)
        .values({
          userId: user?.sub ?? null,
          catId: input.catId,
          title: input.title,
          description: input.description,
          village: input.village,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
          photoMediaId: input.photoMediaId,
        })
        .returning();

      // Prijavilac (ako je ulogovan) automatski podržava svoju prijavu.
      if (user) {
        await db
          .insert(problemVotes)
          .values({ problemId: row.id, userId: user.sub })
          .onConflictDoNothing();
        touchGuestActivity(user.sub, user.role);
      }

      req.log.info(
        { problemId: row.id, catId: row.catId, village: row.village, anonymous: !user },
        'problem reported',
      );
      return reply.code(201).send({ id: row.id });
    },
  );

  // Glasanje (toggle) — samo ulogovani.
  app.post<{ Params: { id: string } }>(
    '/api/problemi/:id/vote',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [p] = await db
        .select({ id: problems.id })
        .from(problems)
        .where(eq(problems.id, id))
        .limit(1);
      if (!p) return reply.code(404).send({ error: 'Not found' });

      const inserted = await db
        .insert(problemVotes)
        .values({ problemId: id, userId: req.user.sub })
        .onConflictDoNothing()
        .returning({ problemId: problemVotes.problemId });
      if (inserted.length === 0) {
        await db
          .delete(problemVotes)
          .where(and(eq(problemVotes.problemId, id), eq(problemVotes.userId, req.user.sub)));
      }
      touchGuestActivity(req.user.sub, req.user.role);

      const [{ votes }] = await db
        .select({ votes: sql<number>`COUNT(*)::int` })
        .from(problemVotes)
        .where(eq(problemVotes.problemId, id));
      return { voted: inserted.length > 0, votes };
    },
  );

  // Komentar — samo ulogovani, ravna lista.
  app.post<{ Params: { id: string }; Body: { body?: unknown } }>(
    '/api/problemi/:id/comments',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!body) return reply.code(400).send({ error: 'Komentar ne može biti prazan.' });
      if (body.length > COMMENT_MAX) {
        return reply.code(400).send({ error: `Komentar može imati najviše ${COMMENT_MAX} karaktera.` });
      }
      const [p] = await db
        .select({ id: problems.id })
        .from(problems)
        .where(eq(problems.id, id))
        .limit(1);
      if (!p) return reply.code(404).send({ error: 'Not found' });

      const [row] = await db
        .insert(problemComments)
        .values({ problemId: id, userId: req.user.sub, body })
        .returning();
      touchGuestActivity(req.user.sub, req.user.role);

      const [author] = await db
        .select({ id: users.id, displayName: users.displayName, role: users.role })
        .from(users)
        .where(eq(users.id, req.user.sub))
        .limit(1);
      return reply.code(201).send({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        author,
        official: author.role === 'admin' || author.role === 'curator',
      });
    },
  );

  // Promena statusa (rešeno / ponovo otvoreno) — admin, kustos sela, prijavilac.
  app.patch<{ Params: { id: string }; Body: { status?: unknown } }>(
    '/api/problemi/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const status = req.body?.status;
      if (status !== 'solved' && status !== 'open') {
        return reply.code(400).send({ error: 'status must be "solved" or "open"' });
      }
      const [p] = await db
        .select({ id: problems.id, userId: problems.userId, village: problems.village })
        .from(problems)
        .where(eq(problems.id, id))
        .limit(1);
      if (!p) return reply.code(404).send({ error: 'Not found' });

      if (!(await canResolve(req.user, p))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const [row] = await db
        .update(problems)
        .set(
          status === 'solved'
            ? { status: 'solved', solvedAt: new Date(), solvedBy: req.user.sub, updatedAt: new Date() }
            : { status: 'open', solvedAt: null, solvedBy: null, updatedAt: new Date() },
        )
        .where(eq(problems.id, id))
        .returning({ id: problems.id, status: problems.status, solvedAt: problems.solvedAt });
      req.log.info({ problemId: id, status, by: req.user.sub }, 'problem status changed');
      return row;
    },
  );

  // Admin: brisanje prijave (moderacija spama / uvredljivog sadržaja).
  app.delete<{ Params: { id: string } }>(
    '/api/problemi/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.code(400).send({ error: 'Invalid id' });
      const deleted = await db.delete(problems).where(eq(problems.id, id)).returning({ id: problems.id });
      if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' });
      req.log.info({ problemId: id }, 'problem deleted by admin');
      return { ok: true };
    },
  );
}
