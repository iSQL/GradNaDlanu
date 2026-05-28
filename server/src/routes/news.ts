import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations, news, objectOwners } from '../db/schema.js';
import { requireRole } from '../lib/auth.js';
import { InvalidSlugError, slugify } from '../lib/locations.js';

const MAX_TITLE = 200;
const MAX_BODY = 8000;
const MAX_NEWS_PER_LOCATION = 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

interface NewsInput {
  locationId?: number;
  title?: string;
  body?: string;
  status?: 'draft' | 'pending' | 'published';
}

function validateNewsInput(body: NewsInput, opts: { requireLocation: boolean }): {
  ok: true;
  value: { locationId?: number; title: string; body: string; status: 'draft' | 'pending' | 'published' };
} | { ok: false; error: string } {
  if (opts.requireLocation) {
    if (typeof body.locationId !== 'number' || !Number.isFinite(body.locationId)) {
      return { ok: false, error: 'locationId required' };
    }
  }
  if (typeof body.title !== 'string') return { ok: false, error: 'title required' };
  const title = body.title.trim();
  if (title.length === 0) return { ok: false, error: 'title required' };
  if (title.length > MAX_TITLE) return { ok: false, error: `title too long (max ${MAX_TITLE})` };

  if (typeof body.body !== 'string') return { ok: false, error: 'body required' };
  const text = body.body.trim();
  if (text.length === 0) return { ok: false, error: 'body required' };
  if (text.length > MAX_BODY) return { ok: false, error: `body too long (max ${MAX_BODY})` };

  const status =
    body.status === 'draft' || body.status === 'pending' || body.status === 'published'
      ? body.status
      : 'published';

  return { ok: true, value: { locationId: body.locationId, title, body: text, status } };
}

async function userOwnsLocation(userId: number, role: string, locationId: number): Promise<boolean> {
  if (role === 'admin') return true;
  const [row] = await db
    .select()
    .from(objectOwners)
    .where(and(eq(objectOwners.userId, userId), eq(objectOwners.locationId, locationId)))
    .limit(1);
  return !!row;
}

// Generate a slug from title + a short locationId/timestamp suffix to avoid
// global slug collisions across business-authored news.
async function generateUniqueSlug(title: string, locationId: number): Promise<string> {
  let base: string;
  try {
    base = slugify(title);
  } catch (err) {
    if (err instanceof InvalidSlugError) {
      base = `vest-${locationId}`;
    } else {
      throw err;
    }
  }
  // Try base, then base + short suffix(es). 5 attempts is overkill but safe.
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${Date.now().toString(36).slice(-4)}${i}`;
    const [hit] = await db
      .select({ id: news.id })
      .from(news)
      .where(eq(news.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  // Last-ditch fallback — guaranteed unique.
  return `${base}-${locationId}-${Date.now().toString(36)}`;
}

export async function newsRoutes(app: FastifyInstance) {
  // Public list — only published items, joined with locations for name/village.
  app.get<{ Querystring: { village?: string; locationId?: string; limit?: string } }>(
    '/api/news',
    async (req) => {
      const conds = [eq(news.status, 'published')];
      if (req.query.village) {
        conds.push(eq(locations.village, req.query.village));
      }
      if (req.query.locationId) {
        const id = Number(req.query.locationId);
        if (Number.isFinite(id)) conds.push(eq(news.locationId, id));
      }
      const rows = await db
        .select({
          id: news.id,
          locationId: news.locationId,
          title: news.title,
          slug: news.slug,
          body: news.body,
          publishedAt: news.publishedAt,
          createdAt: news.createdAt,
          locationName: locations.name,
          locationSlug: locations.slug,
          locationCatId: locations.catId,
          village: locations.village,
        })
        .from(news)
        .innerJoin(locations, eq(locations.id, news.locationId))
        .where(and(...conds))
        .orderBy(desc(news.publishedAt), desc(news.createdAt))
        .limit(clampLimit(req.query.limit));
      return rows;
    },
  );

  // Public single — by slug.
  app.get<{ Params: { slug: string } }>('/api/news/:slug', async (req, reply) => {
    const [row] = await db
      .select({
        id: news.id,
        locationId: news.locationId,
        title: news.title,
        slug: news.slug,
        body: news.body,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
        locationName: locations.name,
        locationSlug: locations.slug,
        locationCatId: locations.catId,
        village: locations.village,
      })
      .from(news)
      .innerJoin(locations, eq(locations.id, news.locationId))
      .where(and(eq(news.slug, req.params.slug), eq(news.status, 'published')))
      .limit(1);
    if (!row) return reply.code(404).send({ error: 'Not found' });
    return row;
  });

  // Owner inbox — list all news the caller can manage. Includes drafts.
  app.get<{ Querystring: { locationId?: string } }>(
    '/api/owner/news',
    { preHandler: requireRole('business') },
    async (req) => {
      const conds = [];
      if (req.user.role !== 'admin') {
        const owned = await db
          .select({ id: objectOwners.locationId })
          .from(objectOwners)
          .where(eq(objectOwners.userId, req.user.sub));
        if (owned.length === 0) return [];
        conds.push(inArray(news.locationId, owned.map((o) => o.id)));
      }
      if (req.query.locationId) {
        const lid = Number(req.query.locationId);
        if (Number.isFinite(lid)) conds.push(eq(news.locationId, lid));
      }
      const where = conds.length ? and(...conds) : undefined;
      return db
        .select({
          id: news.id,
          locationId: news.locationId,
          title: news.title,
          slug: news.slug,
          body: news.body,
          status: news.status,
          publishedAt: news.publishedAt,
          createdAt: news.createdAt,
          updatedAt: news.updatedAt,
          locationName: locations.name,
          locationSlug: locations.slug,
          locationCatId: locations.catId,
          village: locations.village,
        })
        .from(news)
        .innerJoin(locations, eq(locations.id, news.locationId))
        .where(where)
        .orderBy(desc(news.publishedAt), desc(news.createdAt))
        .limit(MAX_LIMIT);
    },
  );

  // Owner create.
  app.post<{ Body: NewsInput }>(
    '/api/owner/news',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const v = validateNewsInput(req.body ?? {}, { requireLocation: true });
      if (!v.ok) return reply.code(400).send({ error: v.error });
      const locationId = v.value.locationId as number;
      if (!(await userOwnsLocation(req.user.sub, req.user.role, locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const [{ existing }] = await db
        .select({ existing: count() })
        .from(news)
        .where(eq(news.locationId, locationId));
      if (Number(existing) >= MAX_NEWS_PER_LOCATION) {
        return reply.code(409).send({ error: `Too many news items for this location (max ${MAX_NEWS_PER_LOCATION})` });
      }
      const slug = await generateUniqueSlug(v.value.title, locationId);
      const now = new Date();
      const [row] = await db
        .insert(news)
        .values({
          locationId,
          authorId: req.user.sub,
          title: v.value.title,
          slug,
          body: v.value.body,
          status: v.value.status,
          publishedAt: v.value.status === 'published' ? now : null,
        })
        .returning();
      return reply.code(201).send(row);
    },
  );

  // Owner update.
  app.patch<{ Params: { id: string }; Body: NewsInput }>(
    '/api/owner/news/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (!(await userOwnsLocation(req.user.sub, req.user.role, row.locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const v = validateNewsInput(req.body ?? {}, { requireLocation: false });
      if (!v.ok) return reply.code(400).send({ error: v.error });
      // Promote to published only when status flips from non-published. If
      // already published, keep the original publishedAt so edits don't reorder.
      const nowPublished = v.value.status === 'published';
      const wasPublished = row.status === 'published';
      const [updated] = await db
        .update(news)
        .set({
          title: v.value.title,
          body: v.value.body,
          status: v.value.status,
          publishedAt: nowPublished && !wasPublished ? new Date() : row.publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(news.id, id))
        .returning();
      return updated;
    },
  );

  // Owner delete.
  app.delete<{ Params: { id: string } }>(
    '/api/owner/news/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (!(await userOwnsLocation(req.user.sub, req.user.role, row.locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await db.delete(news).where(eq(news.id, id));
      return { ok: true };
    },
  );
}
