import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations, objectOwners, users, villageCurators } from '../db/schema.js';
import { bumpTokenVersion, requireRole } from '../lib/auth.js';
import { escapeLikePattern } from '../lib/locations.js';
import { isVillage } from '../lib/villages.js';

const ROLES = ['admin', 'business', 'user', 'curator'] as const;
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

export async function adminUsersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string; limit?: string; offset?: string } }>(
    '/api/admin/users',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const q = req.query.q?.trim();
      const limit = clampLimit(req.query.limit);
      const offset = clampOffset(req.query.offset);
      const where = q
        ? or(
            ilike(users.email, `%${escapeLikePattern(q.slice(0, 80))}%`),
            ilike(users.displayName, `%${escapeLikePattern(q.slice(0, 80))}%`),
          )
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
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

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

      const curatorRows = await db
        .select({ userId: villageCurators.userId, villageName: villageCurators.villageName })
        .from(villageCurators);
      const curatedByUser = new Map<number, string[]>();
      for (const c of curatorRows) {
        const arr = curatedByUser.get(c.userId) ?? [];
        arr.push(c.villageName);
        curatedByUser.set(c.userId, arr);
      }

      const [{ total }] = await db.select({ total: count() }).from(users).where(where);
      reply.header('X-Total-Count', String(total));
      return userRows.map((u) => ({
        ...u,
        ownedLocations: byUser.get(u.id) ?? [],
        curatedVillages: curatedByUser.get(u.id) ?? [],
      }));
    },
  );

  app.patch<{ Params: { id: string }; Body: { role?: string; displayName?: string } }>(
    '/api/admin/users/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      const newRole = req.body?.role;
      if (newRole !== undefined) {
        if (!ROLES.includes(newRole as (typeof ROLES)[number])) {
          return reply.code(400).send({ error: 'invalid role' });
        }
        // Refuse self-demotion when this would leave the system with no admin
        // (or when an admin tries to drop their own admin role unintentionally).
        if (id === req.user.sub && newRole !== 'admin') {
          const [{ admins }] = await db
            .select({ admins: count() })
            .from(users)
            .where(eq(users.role, 'admin'));
          if (Number(admins) <= 1) {
            return reply.code(400).send({ error: 'cannot demote the last remaining admin' });
          }
          return reply.code(400).send({ error: 'admins cannot demote themselves; ask another admin' });
        }
        patch.role = newRole;
      }
      if (req.body?.displayName !== undefined) patch.displayName = req.body.displayName;
      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'nothing to update' });
      }
      const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (newRole !== undefined) await bumpTokenVersion(id);
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

      let promoted = false;
      if (user.role === 'user') {
        await db.update(users).set({ role: 'business' }).where(eq(users.id, userId));
        promoted = true;
      }

      await db
        .insert(objectOwners)
        .values({ userId, locationId, grantedByAdminId: req.user.sub })
        .onConflictDoNothing();
      if (promoted) await bumpTokenVersion(userId);
      return { ok: true, userId, locationId };
    },
  );

  // Dodeli kustosa za jedno selo. Auto-promoviše korisnika u rolu 'curator' ako
  // je trenutno 'user'. Admin i business role se NE diraju (rola admin/business
  // ima pristup svemu i mimo curator skupa).
  app.post<{ Params: { id: string }; Body: { village: string } }>(
    '/api/admin/users/:id/grant-curator',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const userId = Number(req.params.id);
      const village = req.body?.village;
      if (typeof village !== 'string' || !isVillage(village)) {
        return reply.code(400).send({ error: 'village mora biti jedno od sela opštine Žabari' });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: 'User not found' });

      let promoted = false;
      if (user.role === 'user') {
        await db.update(users).set({ role: 'curator' }).where(eq(users.id, userId));
        promoted = true;
      }

      await db
        .insert(villageCurators)
        .values({ userId, villageName: village, grantedByAdminId: req.user.sub })
        .onConflictDoNothing();
      if (promoted) await bumpTokenVersion(userId);
      return { ok: true, userId, village };
    },
  );

  // Ukloni kustosa za jedno selo. Ako mu ostane nula sela i rola je 'curator',
  // demotuj nazad u 'user' (admin/business se ne diraju).
  app.delete<{ Params: { id: string; village: string } }>(
    '/api/admin/users/:id/grant-curator/:village',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const userId = Number(req.params.id);
      const village = decodeURIComponent(req.params.village);
      await db
        .delete(villageCurators)
        .where(and(eq(villageCurators.userId, userId), eq(villageCurators.villageName, village)));

      const [{ remaining }] = await db
        .select({ remaining: count() })
        .from(villageCurators)
        .where(eq(villageCurators.userId, userId));
      if (Number(remaining) === 0) {
        await db
          .update(users)
          .set({ role: 'user' })
          .where(and(eq(users.id, userId), eq(users.role, 'curator')));
      }
      await bumpTokenVersion(userId);
      return reply.send({ ok: true });
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

      // If no grants remain, demote business → user so they lose business-only
      // privileges. Admins stay admin regardless.
      const [{ remaining }] = await db
        .select({ remaining: count() })
        .from(objectOwners)
        .where(eq(objectOwners.userId, userId));
      if (Number(remaining) === 0) {
        await db
          .update(users)
          .set({ role: 'user' })
          .where(and(eq(users.id, userId), eq(users.role, 'business')));
      }
      await bumpTokenVersion(userId);
      return reply.send({ ok: true });
    },
  );
}
