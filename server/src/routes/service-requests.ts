import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations, media, serviceRequests } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';
import { getLocationBySlug } from '../lib/locations.js';
import {
  canTransition,
  isMajstorCategory,
  validateRequestPayload,
} from '../lib/serviceRequests.js';

export async function serviceRequestsRoutes(app: FastifyInstance) {
  // Visitor: create a new service request for a tradesperson location.
  app.post<{ Params: { slug: string }; Body: unknown }>(
    '/api/locations/:slug/service-requests',
    { preHandler: requireAuth },
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      if (!isMajstorCategory(loc.catId)) {
        return reply.code(400).send({ error: 'Zahtevi za usluge nisu dostupni za ovu kategoriju' });
      }

      const v = validateRequestPayload(req.body);
      if (!v.ok) return reply.code(400).send({ error: v.error });

      // Verify all photoIds belong to the caller.
      if (v.payload.photoIds.length > 0) {
        const owned = await db
          .select({ id: media.id })
          .from(media)
          .where(and(inArray(media.id, v.payload.photoIds), eq(media.ownerUserId, req.user.sub)));
        if (owned.length !== v.payload.photoIds.length) {
          return reply.code(400).send({ error: 'Neki od poslatih photoIds ne postoje ili nisu vaši' });
        }
      }

      const [row] = await db
        .insert(serviceRequests)
        .values({
          userId: req.user.sub,
          locationId: loc.id,
          payload: v.payload,
        })
        .returning();
      return reply.code(201).send(row);
    },
  );

  // Visitor: list own service requests with expanded location info.
  app.get('/api/me/service-requests', { preHandler: requireAuth }, async (req) => {
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
      })
      .from(serviceRequests)
      .innerJoin(locations, eq(serviceRequests.locationId, locations.id))
      .where(eq(serviceRequests.userId, req.user.sub))
      .orderBy(desc(serviceRequests.createdAt));
    return rows;
  });

  // Visitor: accept a quote or cancel own request.
  app.patch<{ Params: { id: string }; Body: { status?: string } }>(
    '/api/me/service-requests/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const next = req.body?.status;
      if (next !== 'accepted' && next !== 'cancelled') {
        return reply.code(400).send({ error: 'status mora biti accepted ili cancelled' });
      }
      const [row] = await db
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (row.userId !== req.user.sub) return reply.code(403).send({ error: 'Forbidden' });

      const hasQuote = row.quote !== null && row.quote !== undefined;
      if (!canTransition(row.status, next, 'visitor', hasQuote)) {
        return reply.code(400).send({
          error: `Nije moguće prebaciti iz '${row.status}' u '${next}'`,
        });
      }
      const [updated] = await db
        .update(serviceRequests)
        .set({ status: next })
        .where(eq(serviceRequests.id, id))
        .returning();
      return updated;
    },
  );
}

