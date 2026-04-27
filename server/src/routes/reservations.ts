import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { locations, reservations } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';
import { getLocationBySlug } from '../lib/locations.js';
import {
  findCafeConflicts,
  findHotelConflicts,
  validateCafePayload,
  validateHotelPayload,
} from '../lib/reservations.js';

export async function reservationsRoutes(app: FastifyInstance) {
  // Visitor: submit a reservation request.
  app.post<{ Params: { slug: string }; Body: unknown }>(
    '/api/locations/:slug/reservations',
    { preHandler: requireAuth },
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });

      if (loc.catId === 'cafe') {
        const v = validateCafePayload(req.body);
        if (!v.ok) return reply.code(400).send({ error: v.error });
        const conflicts = await findCafeConflicts(loc.id, v.payload);
        if (conflicts.length > 0) {
          return reply.code(409).send({ error: 'Sto je već zauzet u tom periodu', conflicts });
        }
        const [row] = await db
          .insert(reservations)
          .values({ userId: req.user.sub, locationId: loc.id, payload: v.payload })
          .returning();
        return reply.code(201).send(row);
      }

      if (loc.catId === 'hotel') {
        const v = validateHotelPayload(req.body);
        if (!v.ok) return reply.code(400).send({ error: v.error });
        const conflicts = await findHotelConflicts(loc.id, v.payload);
        if (conflicts.length > 0) {
          return reply.code(409).send({ error: 'Soba je već rezervisana u tom periodu', conflicts });
        }
        const [row] = await db
          .insert(reservations)
          .values({ userId: req.user.sub, locationId: loc.id, payload: v.payload })
          .returning();
        return reply.code(201).send(row);
      }

      return reply.code(400).send({ error: 'Reservations not available for this category' });
    },
  );

  // Visitor: own reservations across all locations.
  app.get('/api/me/reservations', { preHandler: requireAuth }, async (req) => {
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
      })
      .from(reservations)
      .innerJoin(locations, eq(reservations.locationId, locations.id))
      .where(eq(reservations.userId, req.user.sub))
      .orderBy(desc(reservations.createdAt));
    return rows;
  });

  // Visitor: cancel own reservation. The only field they can change.
  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    '/api/me/reservations/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (req.body?.status !== 'cancelled') {
        return reply.code(400).send({ error: 'only status=cancelled allowed here' });
      }
      const [row] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (row.userId !== req.user.sub) return reply.code(403).send({ error: 'Forbidden' });
      if (row.status === 'cancelled') return row;
      const [updated] = await db
        .update(reservations)
        .set({ status: 'cancelled' })
        .where(eq(reservations.id, id))
        .returning();
      return updated;
    },
  );

  // Public: active reservations in a window so client-side pickers can mark slots taken.
  // Returns minimal payload — never exposes user_id to other visitors.
  app.get<{
    Params: { slug: string };
    Querystring: { from?: string; to?: string };
  }>('/api/locations/:slug/availability', async (req, reply) => {
    const loc = await getLocationBySlug(req.params.slug);
    if (!loc) return reply.code(404).send({ error: 'Not found' });
    const { from, to } = req.query;
    if (!from || !to) return reply.code(400).send({ error: 'from and to are required' });

    if (loc.catId === 'cafe') {
      const fromTs = `${from}T00:00:00Z`;
      const toTs = `${to}T23:59:59Z`;
      const rows = await sql<Array<{ payload: unknown; status: string }>>`
        SELECT payload, status FROM reservations
        WHERE location_id = ${loc.id}
          AND status IN ('pending','approved')
          AND tstzrange(
                (payload->>'slotStart')::timestamptz,
                (payload->>'slotEnd')::timestamptz,
                '[)'
              ) &&
              tstzrange(${fromTs}::timestamptz, ${toTs}::timestamptz, '[)')
      `;
      return rows;
    }

    if (loc.catId === 'hotel') {
      const rows = await sql<Array<{ payload: unknown; status: string }>>`
        SELECT payload, status FROM reservations
        WHERE location_id = ${loc.id}
          AND status IN ('pending','approved')
          AND daterange(
                (payload->>'dateFrom')::date,
                (payload->>'dateTo')::date,
                '[)'
              ) &&
              daterange(${from}::date, ${to}::date, '[)')
      `;
      return rows;
    }

    return [];
  });
}
