import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ads, media, users } from '../db/schema.js';
import { getOptionalUser, requireAuth, requireRole } from '../lib/auth.js';
import { isVillage } from '../lib/villages.js';
import { AD_CATEGORIES, MAX_ACTIVE_ADS_PER_USER, validateAdInput } from '../lib/oglasi.js';
import { guestsCanPostAds } from '../lib/settings.js';
import type { AdCategory } from '../db/schema.js';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

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

// Public-facing shape of an ad row joined with its author's display name.
const PUBLIC_COLUMNS = {
  id: ads.id,
  userId: ads.userId,
  title: ads.title,
  description: ads.description,
  category: ads.category,
  priceRsd: ads.priceRsd,
  village: ads.village,
  photoMediaId: ads.photoMediaId,
  contactMethod: ads.contactMethod,
  contactValue: ads.contactValue,
  status: ads.status,
  permanent: ads.permanent,
  createdAt: ads.createdAt,
  updatedAt: ads.updatedAt,
  authorDisplayName: users.displayName,
} as const;

// Verify a media id exists, belongs to the caller, and is an ad photo.
async function isOwnedAdPhoto(mediaId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.ownerUserId, userId), eq(media.kind, 'ad_photo')))
    .limit(1);
  return !!row;
}

export async function oglasiRoutes(app: FastifyInstance) {
  // Public: browse active ads with optional category / village filters.
  app.get<{ Querystring: { category?: string; village?: string; limit?: string; offset?: string } }>(
    '/api/oglasi',
    async (req, reply) => {
      const limit = clampLimit(req.query.limit);
      const offset = clampOffset(req.query.offset);
      const conds = [eq(ads.status, 'active')];
      const cat = req.query.category?.trim();
      if (cat && (AD_CATEGORIES as readonly string[]).includes(cat)) {
        conds.push(eq(ads.category, cat as AdCategory));
      }
      const village = req.query.village?.trim();
      if (village && isVillage(village)) conds.push(eq(ads.village, village));
      const where = and(...conds);

      const rows = await db
        .select(PUBLIC_COLUMNS)
        .from(ads)
        .innerJoin(users, eq(ads.userId, users.id))
        .where(where)
        .orderBy(desc(ads.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db.select({ total: count() }).from(ads).where(where);
      reply.header('X-Total-Count', String(total));
      return rows;
    },
  );

  // Visitor: list own ads (active + archived) so the dashboard can manage them.
  app.get('/api/me/oglasi', { preHandler: requireAuth }, async (req) => {
    const rows = await db
      .select(PUBLIC_COLUMNS)
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(eq(ads.userId, req.user.sub))
      .orderBy(desc(ads.createdAt));
    return rows;
  });

  // Public: a single ad. Archived ads are visible only to the owner/admin.
  app.get<{ Params: { id: string } }>('/api/oglasi/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const [row] = await db
      .select(PUBLIC_COLUMNS)
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(eq(ads.id, id))
      .limit(1);
    if (!row) return reply.code(404).send({ error: 'Not found' });
    if (row.status !== 'active') {
      const user = await getOptionalUser(req);
      const isOwnerOrAdmin = user && (user.role === 'admin' || user.sub === row.userId);
      if (!isOwnerOrAdmin) return reply.code(404).send({ error: 'Not found' });
    }
    return row;
  });

  // Create an ad. Registered users only — guests can't (they're ephemeral).
  app.post<{ Body: unknown }>('/api/oglasi', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user.role === 'guest' && !(await guestsCanPostAds())) {
      return reply.code(403).send({
        error: 'Za postavljanje oglasa je potreban trajan nalog.',
        code: 'guest_not_allowed',
      });
    }

    const v = validateAdInput(req.body, isVillage);
    if (!v.ok) return reply.code(400).send({ error: v.error });

    const [{ active }] = await db
      .select({ active: count() })
      .from(ads)
      .where(and(eq(ads.userId, req.user.sub), eq(ads.status, 'active')));
    if (Number(active) >= MAX_ACTIVE_ADS_PER_USER) {
      return reply.code(400).send({
        error: `Dostigli ste maksimum od ${MAX_ACTIVE_ADS_PER_USER} aktivnih oglasa.`,
        code: 'ad_limit_reached',
      });
    }

    if (v.value.photoMediaId !== null && !(await isOwnedAdPhoto(v.value.photoMediaId, req.user.sub))) {
      return reply.code(400).send({ error: 'Slika ne postoji ili nije vaša' });
    }

    const [row] = await db
      .insert(ads)
      .values({
        userId: req.user.sub,
        title: v.value.title,
        description: v.value.description,
        category: v.value.category,
        priceRsd: v.value.priceRsd,
        village: v.value.village,
        photoMediaId: v.value.photoMediaId,
        contactMethod: v.value.contactMethod,
        contactValue: v.value.contactValue,
      })
      .returning();
    return reply.code(201).send(row);
  });

  // Edit an ad. Owner or admin. Editing also refreshes the 7-day window.
  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/oglasi/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
      if (!existing) return reply.code(404).send({ error: 'Not found' });
      if (req.user.role !== 'admin' && existing.userId !== req.user.sub) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const v = validateAdInput(req.body, isVillage);
      if (!v.ok) return reply.code(400).send({ error: v.error });
      if (
        v.value.photoMediaId !== null &&
        v.value.photoMediaId !== existing.photoMediaId &&
        !(await isOwnedAdPhoto(v.value.photoMediaId, existing.userId))
      ) {
        return reply.code(400).send({ error: 'Slika ne postoji ili nije vaša' });
      }

      const [updated] = await db
        .update(ads)
        .set({
          title: v.value.title,
          description: v.value.description,
          category: v.value.category,
          priceRsd: v.value.priceRsd,
          village: v.value.village,
          photoMediaId: v.value.photoMediaId,
          contactMethod: v.value.contactMethod,
          contactValue: v.value.contactValue,
          updatedAt: new Date(),
          lastRefreshedAt: new Date(),
        })
        .where(eq(ads.id, id))
        .returning();
      return updated;
    },
  );

  // Soft-delete (archive) an ad. Owner or admin.
  app.delete<{ Params: { id: string } }>(
    '/api/oglasi/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
      if (!existing) return reply.code(404).send({ error: 'Not found' });
      if (req.user.role !== 'admin' && existing.userId !== req.user.sub) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await db.update(ads).set({ status: 'archived', archivedAt: new Date() }).where(eq(ads.id, id));
      return { ok: true };
    },
  );

  // --- Admin: arhiva ---

  // List archived (soft-deleted) ads.
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/admin/oglasi/archived',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const limit = clampLimit(req.query.limit);
      const offset = clampOffset(req.query.offset);
      const where = eq(ads.status, 'archived');
      const rows = await db
        .select(PUBLIC_COLUMNS)
        .from(ads)
        .innerJoin(users, eq(ads.userId, users.id))
        .where(where)
        .orderBy(desc(ads.updatedAt))
        .limit(limit)
        .offset(offset);
      const [{ total }] = await db.select({ total: count() }).from(ads).where(where);
      reply.header('X-Total-Count', String(total));
      return rows;
    },
  );

  // Restore an archived ad — fresh 7-day window so the sweep doesn't re-archive it.
  app.post<{ Params: { id: string } }>(
    '/api/admin/oglasi/:id/restore',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const [row] = await db
        .update(ads)
        .set({ status: 'active', lastRefreshedAt: new Date(), archivedAt: null })
        .where(eq(ads.id, id))
        .returning();
      if (!row) return reply.code(404).send({ error: 'Not found' });
      return row;
    },
  );

  // Pin/unpin an ad as permanent (exempt from the expiry sweep).
  app.patch<{ Params: { id: string }; Body: { permanent?: boolean } }>(
    '/api/admin/oglasi/:id/permanent',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (typeof req.body?.permanent !== 'boolean') {
        return reply.code(400).send({ error: 'permanent: boolean je obavezan' });
      }
      const [row] = await db
        .update(ads)
        .set({ permanent: req.body.permanent })
        .where(eq(ads.id, id))
        .returning();
      if (!row) return reply.code(404).send({ error: 'Not found' });
      return row;
    },
  );
}
