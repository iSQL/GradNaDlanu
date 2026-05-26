import type { FastifyInstance } from 'fastify';
import { and, asc, count, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { events, locations, objectOwners } from '../db/schema.js';
import { requireRole } from '../lib/auth.js';
import { getLocationBySlug } from '../lib/locations.js';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_EVENTS_PER_LOCATION = 500;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

interface EventInput {
  locationId?: number;
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  status?: 'published' | 'cancelled';
}

function validateEventInput(body: EventInput, opts: { requireLocation: boolean }): {
  ok: true;
  value: {
    locationId?: number;
    title: string;
    description: string | null;
    startsAt: Date;
    endsAt: Date | null;
    status: 'published' | 'cancelled';
  };
} | { ok: false; error: string } {
  if (opts.requireLocation) {
    if (typeof body.locationId !== 'number' || !Number.isFinite(body.locationId)) {
      return { ok: false, error: 'locationId required' };
    }
  }
  const rawTitle = body.title;
  if (typeof rawTitle !== 'string') return { ok: false, error: 'title required' };
  const title = rawTitle.trim();
  if (title.length === 0) return { ok: false, error: 'title required' };
  if (title.length > MAX_TITLE) return { ok: false, error: `title too long (max ${MAX_TITLE})` };

  let description: string | null = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') return { ok: false, error: 'description must be a string' };
    const d = body.description.trim();
    if (d.length > MAX_DESCRIPTION) return { ok: false, error: `description too long (max ${MAX_DESCRIPTION})` };
    description = d.length === 0 ? null : d;
  }

  if (typeof body.startsAt !== 'string') return { ok: false, error: 'startsAt required (ISO timestamp)' };
  const startsMs = Date.parse(body.startsAt);
  if (Number.isNaN(startsMs)) return { ok: false, error: 'startsAt must be an ISO timestamp' };
  const startsAt = new Date(startsMs);

  let endsAt: Date | null = null;
  if (body.endsAt !== undefined && body.endsAt !== null && body.endsAt !== '') {
    if (typeof body.endsAt !== 'string') return { ok: false, error: 'endsAt must be a string' };
    const endsMs = Date.parse(body.endsAt);
    if (Number.isNaN(endsMs)) return { ok: false, error: 'endsAt must be an ISO timestamp' };
    if (endsMs <= startsMs) return { ok: false, error: 'endsAt must be after startsAt' };
    endsAt = new Date(endsMs);
  }

  const status = body.status === 'cancelled' ? 'cancelled' : 'published';

  return {
    ok: true,
    value: {
      locationId: body.locationId,
      title,
      description,
      startsAt,
      endsAt,
      status,
    },
  };
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

export async function eventsRoutes(app: FastifyInstance) {
  // Public: aggregated upcoming events across all published locations.
  // Powers the Pregled "Najavljeni događaji" panel.
  app.get<{ Querystring: { cat?: string; limit?: string; includePast?: string } }>(
    '/api/events',
    async (req) => {
      const limit = clampLimit(req.query.limit);
      const cat = req.query.cat?.trim();
      const includePast = req.query.includePast === '1';
      const conds = [
        eq(events.status, 'published' as const),
        eq(locations.status, 'published' as const),
      ];
      if (!includePast) conds.push(gte(events.startsAt, new Date()));
      if (cat) conds.push(eq(locations.catId, cat));

      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          status: events.status,
          locationId: locations.id,
          locationSlug: locations.slug,
          locationName: locations.name,
          locationCatId: locations.catId,
        })
        .from(events)
        .innerJoin(locations, eq(events.locationId, locations.id))
        .where(and(...conds))
        .orderBy(asc(events.startsAt))
        .limit(limit);
      return rows;
    },
  );

  // Public: events for a single location (used by module pages).
  app.get<{ Params: { slug: string }; Querystring: { includePast?: string } }>(
    '/api/locations/:slug/events',
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      const includePast = req.query.includePast === '1';
      const conds = [
        eq(events.locationId, loc.id),
        eq(events.status, 'published' as const),
      ];
      if (!includePast) conds.push(gte(events.startsAt, new Date()));
      return db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          status: events.status,
        })
        .from(events)
        .where(and(...conds))
        .orderBy(asc(events.startsAt))
        .limit(MAX_LIMIT);
    },
  );

  // Owner inbox — list events the caller can manage. Filterable by location.
  app.get<{ Querystring: { locationId?: string; includePast?: string } }>(
    '/api/owner/events',
    { preHandler: requireRole('business') },
    async (req) => {
      const includePast = req.query.includePast === '1';
      const conds = [];
      if (!includePast) conds.push(gte(events.startsAt, new Date()));

      if (req.user.role !== 'admin') {
        const owned = await db
          .select({ id: objectOwners.locationId })
          .from(objectOwners)
          .where(eq(objectOwners.userId, req.user.sub));
        if (owned.length === 0) return [];
        conds.push(inArray(events.locationId, owned.map((o) => o.id)));
      }
      if (req.query.locationId) {
        const lid = Number(req.query.locationId);
        if (Number.isFinite(lid)) conds.push(eq(events.locationId, lid));
      }
      const where = conds.length ? and(...conds) : undefined;
      return db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          status: events.status,
          locationId: locations.id,
          locationSlug: locations.slug,
          locationName: locations.name,
          locationCatId: locations.catId,
        })
        .from(events)
        .innerJoin(locations, eq(events.locationId, locations.id))
        .where(where)
        .orderBy(asc(events.startsAt))
        .limit(MAX_LIMIT);
    },
  );

  // Owner create.
  app.post<{ Body: EventInput }>(
    '/api/owner/events',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const v = validateEventInput(req.body ?? {}, { requireLocation: true });
      if (!v.ok) return reply.code(400).send({ error: v.error });
      const locationId = v.value.locationId as number;
      if (!(await userOwnsLocation(req.user.sub, req.user.role, locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const [{ existing }] = await db
        .select({ existing: count() })
        .from(events)
        .where(eq(events.locationId, locationId));
      if (Number(existing) >= MAX_EVENTS_PER_LOCATION) {
        return reply.code(409).send({ error: `Too many events for this location (max ${MAX_EVENTS_PER_LOCATION})` });
      }
      const [row] = await db
        .insert(events)
        .values({
          locationId,
          title: v.value.title,
          description: v.value.description,
          startsAt: v.value.startsAt,
          endsAt: v.value.endsAt,
          status: v.value.status,
          createdByUserId: req.user.sub,
        })
        .returning();
      return reply.code(201).send(row);
    },
  );

  // Owner update / delete on a single event. Ownership gates by the event's location.
  app.patch<{ Params: { id: string }; Body: EventInput }>(
    '/api/owner/events/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (!(await userOwnsLocation(req.user.sub, req.user.role, row.locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const v = validateEventInput(req.body ?? {}, { requireLocation: false });
      if (!v.ok) return reply.code(400).send({ error: v.error });
      const [updated] = await db
        .update(events)
        .set({
          title: v.value.title,
          description: v.value.description,
          startsAt: v.value.startsAt,
          endsAt: v.value.endsAt,
          status: v.value.status,
        })
        .where(eq(events.id, id))
        .returning();
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/owner/events/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (!(await userOwnsLocation(req.user.sub, req.user.role, row.locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await db.delete(events).where(eq(events.id, id));
      return { ok: true };
    },
  );
}
