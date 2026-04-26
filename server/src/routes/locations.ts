import type { FastifyInstance } from 'fastify';
import { and, avg, count, eq, gte, ilike } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checkins, comments, favorites, locations, moduleContent } from '../db/schema.js';
import { requireAdmin, getOptionalUser } from '../lib/auth.js';
import { slugify } from '../lib/locations.js';

export async function locationsRoutes(app: FastifyInstance) {
  // Public list
  app.get<{ Querystring: { cat?: string; q?: string; includeDrafts?: string } }>(
    '/api/locations',
    async (req) => {
      const { cat, q, includeDrafts } = req.query;
      const conds = [];
      if (!includeDrafts) conds.push(eq(locations.status, 'published'));
      if (cat) conds.push(eq(locations.catId, cat));
      if (q)   conds.push(ilike(locations.name, `%${q}%`));
      const where = conds.length ? and(...conds) : undefined;
      return db.select().from(locations).where(where);
    }
  );

  // Public single — augmented with social aggregates and (when authed) favoritedByMe.
  app.get<{ Params: { slug: string } }>('/api/locations/:slug', async (req, reply) => {
    const [loc] = await db.select().from(locations).where(eq(locations.slug, req.params.slug)).limit(1);
    if (!loc) return reply.code(404).send({ error: 'Not found' });
    const [mc] = await db
      .select()
      .from(moduleContent)
      .where(eq(moduleContent.locationId, loc.id))
      .limit(1);

    const user = await getOptionalUser(req);

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
  app.post<{ Body: { name: string; address: string; catId: string; lat?: number; lng?: number; subtitle?: string; status?: 'draft' | 'published' } }>(
    '/api/admin/locations',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { name, address, catId, lat, lng, subtitle, status } = req.body;
      if (!name || !address || !catId) {
        return reply.code(400).send({ error: 'name, address, catId are required' });
      }
      const slug = slugify(name);
      try {
        const [row] = await db
          .insert(locations)
          .values({
            slug,
            name,
            address,
            catId,
            subtitle: subtitle ?? null,
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
      const { content, ...locFields } = req.body;

      let row;
      if (Object.keys(locFields).length > 0) {
        [row] = await db.update(locations).set(locFields).where(eq(locations.id, id)).returning();
        if (!row) return reply.code(404).send({ error: 'Not found' });
      } else {
        [row] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
        if (!row) return reply.code(404).send({ error: 'Not found' });
      }

      if (content !== undefined) {
        await db
          .insert(moduleContent)
          .values({ locationId: id, content })
          .onConflictDoUpdate({ target: moduleContent.locationId, set: { content } });
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
