import type { FastifyInstance } from 'fastify';
import { and, eq, ilike } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations, moduleContent } from '../db/schema.js';
import { requireAdmin } from '../lib/auth.js';

function slugify(s: string): string {
  const map: Record<string, string> = {
    č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj',
    Č: 'c', Ć: 'c', Š: 's', Ž: 'z', Đ: 'dj',
  };
  return s
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

  // Public single
  app.get<{ Params: { slug: string } }>('/api/locations/:slug', async (req, reply) => {
    const [loc] = await db.select().from(locations).where(eq(locations.slug, req.params.slug)).limit(1);
    if (!loc) return reply.code(404).send({ error: 'Not found' });
    const [mc] = await db
      .select()
      .from(moduleContent)
      .where(eq(moduleContent.locationId, loc.id))
      .limit(1);
    return { ...loc, content: mc?.content ?? {} };
  });

  // Admin: list with drafts
  app.get('/api/admin/locations', { preHandler: requireAdmin }, async () => {
    return db.select().from(locations);
  });

  // Admin: create
  app.post<{ Body: { name: string; address: string; catId: string; lat?: number; lng?: number; subtitle?: string } }>(
    '/api/admin/locations',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { name, address, catId, lat, lng, subtitle } = req.body;
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
            status: 'draft',
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

  // Admin: update status / fields
  app.patch<{ Params: { id: string }; Body: Partial<{ name: string; address: string; subtitle: string; status: 'draft' | 'published'; lat: number; lng: number }> }>(
    '/api/admin/locations/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const id = Number(req.params.id);
      const [row] = await db.update(locations).set(req.body).where(eq(locations.id, id)).returning();
      if (!row) return reply.code(404).send({ error: 'Not found' });
      return row;
    }
  );
}
