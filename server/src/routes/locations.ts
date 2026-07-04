import type { FastifyInstance } from 'fastify';
import { and, avg, count, desc, eq, gte, ilike, sql as dsql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checkins, comments, favorites, locations, moduleContent, objectOwners, villageCurators } from '../db/schema.js';
import { requireAdmin, getOptionalUser } from '../lib/auth.js';
import { escapeLikePattern, InvalidSlugError, slugify, validateContent } from '../lib/locations.js';
import { isVillage } from '../lib/villages.js';

function clampLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

export async function locationsRoutes(app: FastifyInstance) {
  // Public list
  app.get<{ Querystring: { cat?: string; q?: string; includeDrafts?: string; sort?: string; limit?: string } }>(
    '/api/locations',
    async (req) => {
      const { cat, q, includeDrafts, sort, limit } = req.query;
      const conds = [];
      // Drafts are admin-only on the public endpoint — anyone else gets the
      // published set regardless of the flag.
      let showDrafts = false;
      if (includeDrafts) {
        const user = await getOptionalUser(req);
        showDrafts = user?.role === 'admin';
      }
      if (!showDrafts) conds.push(eq(locations.status, 'published'));
      if (cat) conds.push(eq(locations.catId, cat));
      if (q) {
        const safe = escapeLikePattern(q.slice(0, 80));
        conds.push(ilike(locations.name, `%${safe}%`));
      }
      const where = conds.length ? and(...conds) : undefined;
      const cap = clampLimit(limit);

      if (sort === 'popular') {
        // LEFT JOIN visible comments → aggregate count + avg rating per location.
        // commentCount=0 locations still appear at the bottom.
        const commentCount = dsql<number>`COUNT(${comments.id})`.as('comment_count');
        const avgRating = avg(comments.rating).as('avg_rating');
        const rows = await db
          .select({
            id: locations.id,
            slug: locations.slug,
            catId: locations.catId,
            name: locations.name,
            subtitle: locations.subtitle,
            address: locations.address,
            lat: locations.lat,
            lng: locations.lng,
            status: locations.status,
            createdAt: locations.createdAt,
            commentCount,
            avgRating,
          })
          .from(locations)
          .leftJoin(
            comments,
            and(eq(comments.locationId, locations.id), eq(comments.status, 'visible')),
          )
          .where(where)
          .groupBy(locations.id)
          .orderBy(desc(commentCount), dsql`avg_rating DESC NULLS LAST`)
          .limit(cap ?? 50);
        return rows.map((r) => ({
          ...r,
          commentCount: Number(r.commentCount ?? 0),
          avgRating: r.avgRating !== null && r.avgRating !== undefined ? Number(r.avgRating) : null,
        }));
      }

      const order = sort === 'recent' ? desc(locations.createdAt) : undefined;
      const base = db.select().from(locations).where(where);
      const ordered = order ? base.orderBy(order) : base;
      return cap !== undefined ? ordered.limit(cap) : ordered;
    }
  );

  // Public single — augmented with social aggregates and (when authed) favoritedByMe.
  app.get<{ Params: { slug: string } }>('/api/locations/:slug', async (req, reply) => {
    const [loc] = await db.select().from(locations).where(eq(locations.slug, req.params.slug)).limit(1);
    if (!loc) return reply.code(404).send({ error: 'Not found' });

    const user = await getOptionalUser(req);

    // Drafts are only visible to admin, the object's owner, or a curator of
    // its village (their editors load by slug). Everyone else gets 404 — same
    // response as "doesn't exist" so slugs can't be probed.
    if (loc.status !== 'published') {
      let canViewDraft = false;
      if (user) {
        if (user.role === 'admin') {
          canViewDraft = true;
        } else {
          const [own] = await db
            .select({ userId: objectOwners.userId })
            .from(objectOwners)
            .where(and(eq(objectOwners.userId, user.sub), eq(objectOwners.locationId, loc.id)))
            .limit(1);
          if (own) {
            canViewDraft = true;
          } else if (loc.village) {
            const [cur] = await db
              .select({ userId: villageCurators.userId })
              .from(villageCurators)
              .where(and(eq(villageCurators.userId, user.sub), eq(villageCurators.villageName, loc.village)))
              .limit(1);
            if (cur) canViewDraft = true;
          }
        }
      }
      if (!canViewDraft) return reply.code(404).send({ error: 'Not found' });
    }

    const [mc] = await db
      .select()
      .from(moduleContent)
      .where(eq(moduleContent.locationId, loc.id))
      .limit(1);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [checkinAgg] = await db
      .select({ n: count() })
      .from(checkins)
      .where(and(eq(checkins.locationId, loc.id), gte(checkins.createdAt, dayAgo)));

    const [commentAgg] = await db
      .select({ n: count(), avg: avg(comments.rating) })
      .from(comments)
      .where(and(eq(comments.locationId, loc.id), eq(comments.status, 'visible')));

    let favoritedByMe = false;
    if (user) {
      const [fav] = await db
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, user.sub), eq(favorites.locationId, loc.id)))
        .limit(1);
      favoritedByMe = !!fav;
    }

    return {
      ...loc,
      content: mc?.content ?? {},
      favoritedByMe,
      checkinsLast24h: Number(checkinAgg?.n ?? 0),
      commentSummary: {
        count: Number(commentAgg?.n ?? 0),
        avgRating: commentAgg?.avg !== null && commentAgg?.avg !== undefined
          ? Number(commentAgg.avg)
          : null,
      },
    };
  });

  // Admin: list with drafts
  app.get('/api/admin/locations', { preHandler: requireAdmin }, async () => {
    return db.select().from(locations);
  });

  // Admin: create
  app.post<{ Body: { name: string; address: string; catId: string; lat?: number; lng?: number; subtitle?: string; village?: string | null; status?: 'draft' | 'published' } }>(
    '/api/admin/locations',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { name, address, catId, lat, lng, subtitle, village, status } = req.body;
      if (!name || !address || !catId) {
        return reply.code(400).send({ error: 'name, address, catId are required' });
      }
      let resolvedVillage: string | null = null;
      if (typeof village === 'string' && village.length > 0) {
        if (!isVillage(village)) {
          return reply.code(400).send({ error: 'village must be one of opština Žabari sela' });
        }
        resolvedVillage = village;
      }
      let slug: string;
      try {
        slug = slugify(name);
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          return reply.code(400).send({ error: 'name does not contain any ASCII-slugifiable characters' });
        }
        throw err;
      }
      try {
        const [row] = await db
          .insert(locations)
          .values({
            slug,
            name,
            address,
            catId,
            subtitle: subtitle ?? null,
            village: resolvedVillage,
            lat: lat ?? 44.3567,
            lng: lng ?? 21.2161,
            status: status === 'published' ? 'published' : 'draft',
          })
          .returning();
        await db.insert(moduleContent).values({ locationId: row.id, content: {} });
        return row;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('unique')) {
          return reply.code(409).send({ error: 'Slug already exists', slug });
        }
        throw err;
      }
    }
  );

  // Admin: update location fields and/or content
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      address: string;
      subtitle: string;
      village: string | null;
      status: 'draft' | 'published';
      lat: number;
      lng: number;
      content: unknown;
    }>;
  }>(
    '/api/admin/locations/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};

      // Explicit whitelist — Drizzle's typed .set() doesn't reject unknown keys
      // at runtime, so a future Body widening (or a malicious body that happens
      // to match a column name like slug/catId/createdAt) would otherwise
      // silently mutate fields outside the admin product scope.
      const allowed: Record<string, unknown> = {};
      if (typeof body.name === 'string') allowed.name = body.name;
      if (typeof body.address === 'string') allowed.address = body.address;
      if (typeof body.subtitle === 'string' || body.subtitle === null) allowed.subtitle = body.subtitle;
      if (body.village === null) {
        allowed.village = null;
      } else if (typeof body.village === 'string') {
        if (body.village.length === 0) {
          allowed.village = null;
        } else if (!isVillage(body.village)) {
          return reply.code(400).send({ error: 'village must be one of opština Žabari sela' });
        } else {
          allowed.village = body.village;
        }
      }
      if (body.status === 'draft' || body.status === 'published') allowed.status = body.status;
      if (typeof body.lat === 'number' && Number.isFinite(body.lat)) allowed.lat = body.lat;
      if (typeof body.lng === 'number' && Number.isFinite(body.lng)) allowed.lng = body.lng;

      const contentCheck = validateContent(body.content);
      if (!contentCheck.ok) return reply.code(400).send({ error: contentCheck.error });

      let row;
      if (Object.keys(allowed).length > 0) {
        [row] = await db.update(locations).set(allowed).where(eq(locations.id, id)).returning();
        if (!row) return reply.code(404).send({ error: 'Not found' });
      } else {
        [row] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
        if (!row) return reply.code(404).send({ error: 'Not found' });
      }

      if (body.content !== undefined) {
        await db
          .insert(moduleContent)
          .values({ locationId: id, content: body.content })
          .onConflictDoUpdate({ target: moduleContent.locationId, set: { content: body.content } });
      }

      return row;
    }
  );

  // Admin: delete (module_content cascades via FK)
  app.delete<{ Params: { id: string } }>(
    '/api/admin/locations/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const id = Number(req.params.id);
      const [row] = await db.delete(locations).where(eq(locations.id, id)).returning({ id: locations.id });
      if (!row) return reply.code(404).send({ error: 'Not found' });
      return { ok: true, id: row.id };
    }
  );
}
