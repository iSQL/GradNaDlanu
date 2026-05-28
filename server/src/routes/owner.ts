import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  comments,
  locations,
  moduleContent,
  objectOwners,
  reservations,
  serviceRequests,
  users,
} from '../db/schema.js';
import { requireRole } from '../lib/auth.js';
import { validateContent } from '../lib/locations.js';
import { isVillage } from '../lib/villages.js';
import {
  findCafeConflicts,
  findHotelConflicts,
  isCafePayload,
  isHotelPayload,
} from '../lib/reservations.js';
import {
  canTransition,
  validateQuote,
  type ServiceRequestQuote,
} from '../lib/serviceRequests.js';

// Returns the list of location ids the caller can act on as owner.
// Admin → all locations. Business/user → only their object_owners rows.
async function ownedLocationIds(userId: number, role: string): Promise<number[] | 'ALL'> {
  if (role === 'admin') return 'ALL';
  const rows = await db
    .select({ id: objectOwners.locationId })
    .from(objectOwners)
    .where(eq(objectOwners.userId, userId));
  return rows.map((r) => r.id);
}

export async function ownerRoutes(app: FastifyInstance) {
  // List owned objects.
  app.get('/api/owner/locations', { preHandler: requireRole('business') }, async (req) => {
    const owned = await ownedLocationIds(req.user.sub, req.user.role);
    if (owned === 'ALL') return db.select().from(locations);
    if (owned.length === 0) return [];
    return db.select().from(locations).where(inArray(locations.id, owned));
  });

  // Edit a single owned location — restricted field set (no lat/lng/catId/slug/status).
  app.patch<{
    Params: { id: string };
    Body: Partial<{ name: string; subtitle: string; address: string; village: string | null; content: unknown }>;
  }>(
    '/api/owner/locations/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const owned = await ownedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && !owned.includes(id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const { content, village, ...locFields } = req.body ?? {};
      const allowed: Record<string, unknown> = {};
      for (const k of ['name', 'subtitle', 'address'] as const) {
        if (locFields[k] !== undefined) allowed[k] = locFields[k];
      }
      if (village === null) {
        allowed.village = null;
      } else if (typeof village === 'string') {
        if (village.length === 0) {
          allowed.village = null;
        } else if (!isVillage(village)) {
          return reply.code(400).send({ error: 'village must be one of opština Žabari sela' });
        } else {
          allowed.village = village;
        }
      }
      const contentCheck = validateContent(content);
      if (!contentCheck.ok) return reply.code(400).send({ error: contentCheck.error });

      let row;
      if (Object.keys(allowed).length > 0) {
        [row] = await db.update(locations).set(allowed).where(eq(locations.id, id)).returning();
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
    },
  );

  // Reservation inbox for owned objects, filterable by status / specific location.
  app.get<{ Querystring: { status?: string; locationId?: string } }>(
    '/api/owner/reservations',
    { preHandler: requireRole('business') },
    async (req) => {
      const owned = await ownedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && owned.length === 0) return [];

      const conds = [];
      if (req.query.status) conds.push(eq(reservations.status, req.query.status as 'pending' | 'approved' | 'declined' | 'cancelled'));
      if (req.query.locationId) conds.push(eq(reservations.locationId, Number(req.query.locationId)));
      if (owned !== 'ALL') conds.push(inArray(reservations.locationId, owned));
      const where = conds.length ? and(...conds) : undefined;

      const rows = await db
        .select({
          id: reservations.id,
          payload: reservations.payload,
          status: reservations.status,
          createdAt: reservations.createdAt,
          decidedAt: reservations.decidedAt,
          locationId: locations.id,
          locationSlug: locations.slug,
          locationName: locations.name,
          locationCatId: locations.catId,
          userId: users.id,
          userDisplayName: users.displayName,
          userEmail: users.email,
        })
        .from(reservations)
        .innerJoin(locations, eq(reservations.locationId, locations.id))
        .innerJoin(users, eq(reservations.userId, users.id))
        .where(where)
        .orderBy(desc(reservations.createdAt));
      return rows;
    },
  );

  // Approve / decline a reservation. Re-runs conflict check on approve.
  app.patch<{
    Params: { id: string };
    Body: { status: 'approved' | 'declined' };
  }>(
    '/api/owner/reservations/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const next = req.body?.status;
      if (next !== 'approved' && next !== 'declined') {
        return reply.code(400).send({ error: 'status must be approved or declined' });
      }
      const [row] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });

      const owned = await ownedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && !owned.includes(row.locationId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      if (row.status !== 'pending') {
        return reply.code(409).send({ error: `Reservation already ${row.status}` });
      }

      if (next === 'approved') {
        // Race protection — another reservation may have been approved since this one was submitted.
        if (isCafePayload(row.payload)) {
          const conflicts = await findCafeConflicts(row.locationId, row.payload, row.id);
          if (conflicts.length > 0) {
            return reply.code(409).send({ error: 'Conflicts with another reservation', conflicts });
          }
        } else if (isHotelPayload(row.payload)) {
          const conflicts = await findHotelConflicts(row.locationId, row.payload, row.id);
          if (conflicts.length > 0) {
            return reply.code(409).send({ error: 'Conflicts with another reservation', conflicts });
          }
        }
      }

      const [updated] = await db
        .update(reservations)
        .set({
          status: next,
          decidedByOwnerId: req.user.sub,
          decidedAt: new Date(),
        })
        .where(eq(reservations.id, id))
        .returning();
      return updated;
    },
  );

  // Service requests inbox for owned objects.
  app.get<{ Querystring: { status?: string; locationId?: string } }>(
    '/api/owner/service-requests',
    { preHandler: requireRole('business') },
    async (req) => {
      const owned = await ownedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && owned.length === 0) return [];

      const conds = [];
      if (req.query.status) {
        conds.push(
          eq(
            serviceRequests.status,
            req.query.status as 'pending' | 'quoted' | 'accepted' | 'declined' | 'cancelled' | 'completed',
          ),
        );
      }
      if (req.query.locationId) conds.push(eq(serviceRequests.locationId, Number(req.query.locationId)));
      if (owned !== 'ALL') conds.push(inArray(serviceRequests.locationId, owned));
      const where = conds.length ? and(...conds) : undefined;

      const rows = await db
        .select({
          id: serviceRequests.id,
          payload: serviceRequests.payload,
          quote: serviceRequests.quote,
          status: serviceRequests.status,
          createdAt: serviceRequests.createdAt,
          decidedAt: serviceRequests.decidedAt,
          locationId: locations.id,
          locationSlug: locations.slug,
          locationName: locations.name,
          locationCatId: locations.catId,
          userId: users.id,
          userDisplayName: users.displayName,
          userEmail: users.email,
        })
        .from(serviceRequests)
        .innerJoin(locations, eq(serviceRequests.locationId, locations.id))
        .innerJoin(users, eq(serviceRequests.userId, users.id))
        .where(where)
        .orderBy(desc(serviceRequests.createdAt));
      return rows;
    },
  );

  // Quote / decline / complete a service request.
  // Body accepts EITHER { quote: {...} } (transitions pending → quoted) OR
  // { status: 'declined' | 'completed' }.
  app.patch<{
    Params: { id: string };
    Body: { quote?: unknown; status?: 'declined' | 'completed' };
  }>(
    '/api/owner/service-requests/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const [row] = await db
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });

      const owned = await ownedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && !owned.includes(row.locationId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const body = req.body ?? {};

      if (body.quote !== undefined) {
        const v = validateQuote(body.quote);
        if (!v.ok) return reply.code(400).send({ error: v.error });
        if (!canTransition(row.status, 'quoted', 'owner', true)) {
          return reply.code(400).send({ error: `Ponuda može da se posalje samo iz statusa 'pending', trenutno je '${row.status}'` });
        }
        const quote: ServiceRequestQuote = v.quote;
        const [updated] = await db
          .update(serviceRequests)
          .set({
            quote,
            status: 'quoted',
            decidedByOwnerId: req.user.sub,
            decidedAt: new Date(),
          })
          .where(eq(serviceRequests.id, id))
          .returning();
        return updated;
      }

      if (body.status === 'declined' || body.status === 'completed') {
        const hasQuote = row.quote !== null && row.quote !== undefined;
        if (!canTransition(row.status, body.status, 'owner', hasQuote)) {
          return reply.code(400).send({
            error: `Nije moguće prebaciti iz '${row.status}' u '${body.status}'`,
          });
        }
        const [updated] = await db
          .update(serviceRequests)
          .set({
            status: body.status,
            decidedByOwnerId: req.user.sub,
            decidedAt: new Date(),
          })
          .where(eq(serviceRequests.id, id))
          .returning();
        return updated;
      }

      return reply.code(400).send({ error: 'Pošaljite quote ili status=declined|completed' });
    },
  );

  // Comments on owned objects (for moderation list).
  app.get(
    '/api/owner/comments',
    { preHandler: requireRole('business') },
    async (req) => {
      const owned = await ownedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && owned.length === 0) return [];
      const conds = [eq(comments.status, 'visible' as const)];
      if (owned !== 'ALL') conds.push(inArray(comments.locationId, owned));
      const rows = await db
        .select({
          id: comments.id,
          body: comments.body,
          rating: comments.rating,
          createdAt: comments.createdAt,
          parentId: comments.parentId,
          locationId: locations.id,
          locationSlug: locations.slug,
          locationName: locations.name,
          authorId: users.id,
          authorName: users.displayName,
        })
        .from(comments)
        .innerJoin(locations, eq(comments.locationId, locations.id))
        .innerJoin(users, eq(comments.userId, users.id))
        .where(and(...conds))
        .orderBy(desc(comments.createdAt));
      return rows;
    },
  );
}
