import type { FastifyInstance } from 'fastify';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations, objectOwners, users } from '../db/schema.js';
import { requireRole } from '../lib/auth.js';

const ROLES = ['admin', 'business', 'user'] as const;

export async function adminUsersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>(
    '/api/admin/users',
    { preHandler: requireRole('admin') },
    async (req) => {
      const q = req.query.q?.trim();
      const where = q
        ? or(ilike(users.email, `%${q}%`), ilike(users.displayName, `%${q}%`))
        : undefined;
      const userRows = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt));

      // Attach ownership info in a single query.
      const ownerships = await db
        .select({
          userId: objectOwners.userId,
          locationId: locations.id,
          locationSlug: locations.slug,
          locationName: locations.name,
        })
        .from(objectOwners)
        .innerJoin(locations, eq(objectOwners.locationId, locations.id));

      const byUser = new Map<number, Array<{ id: number; slug: string; name: string }>>();
      for (const o of ownerships) {
        const arr = byUser.get(o.userId) ?? [];
        arr.push({ id: o.locationId, slug: o.locationSlug, name: o.locationName });
        byUser.set(o.userId, arr);
      }

      return userRows.map((u) => ({ ...u, ownedLocations: byUser.get(u.id) ?? [] }));
    },
  );

  app.patch<{ Params: { id: string }; Body: { role?: string; displayName?: string } }>(
    '/api/admin/users/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      if (req.body?.role !== undefined) {
        if (!ROLES.includes(req.body.role as (typeof ROLES)[number])) {
          return reply.code(400).send({ error: 'invalid role' });
        }
        patch.role = req.body.role;
      }
      if (req.body?.displayName !== undefined) patch.displayName = req.body.displayName;
      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'nothing to update' });
      }
      const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      if (!row) return reply.code(404).send({ error: 'Not found' });
      return { id: row.id, email: row.email, displayName: row.displayName, role: row.role };
    },
  );

  app.post<{ Params: { id: string }; Body: { locationId: number } }>(
    '/api/admin/users/:id/grant-ownership',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const userId = Number(req.params.id);
      const locationId = Number(req.body?.locationId);
      if (!Number.isFinite(locationId)) {
        return reply.code(400).send({ error: 'locationId required' });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: 'User not found' });
      const [loc] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (!loc) return reply.code(404).send({ error: 'Location not found' });

      // Promote to business if currently a plain visitor — admin keeps admin.
      if (user.role === 'user') {
        await db.update(users).set({ role: 'business' }).where(eq(users.id, userId));
      }

      await db
        .insert(objectOwners)
        .values({ userId, locationId, grantedByAdminId: req.user.sub })
        .onConflictDoNothing();
      return { ok: true, userId, locationId };
    },
  );

  app.delete<{ Params: { id: string; locationId: string } }>(
    '/api/admin/users/:id/grant-ownership/:locationId',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const userId = Number(req.params.id);
      const locationId = Number(req.params.locationId);
      await db
        .delete(objectOwners)
        .where(and(eq(objectOwners.userId, userId), eq(objectOwners.locationId, locationId)));
      return reply.send({ ok: true });
    },
  );
}
