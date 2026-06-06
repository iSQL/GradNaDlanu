import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, ilike, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alumni, locations, media, objectOwners } from '../db/schema.js';
import { getOptionalUser, requireRole } from '../lib/auth.js';
import { escapeLikePattern } from '../lib/locations.js';

const MAX_FULL_NAME = 200;
const MAX_TEACHER = 200;
const MAX_MOTTO = 500;
const MAX_EMAIL = 200;
const MAX_ALUMNI_PER_LOCATION = 5000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const YEAR_MIN = 1850;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function clampLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

interface AlumnusInput {
  locationId?: number;
  fullName?: string;
  graduationYear?: number;
  homeroomTeacher?: string;
  motto?: string;
  email?: string | null;
  photoMediaId?: number | null;
}

interface ValidatedAlumnus {
  locationId?: number;
  fullName: string;
  graduationYear: number;
  homeroomTeacher: string;
  motto: string;
  email: string | null;
  photoMediaId: number | null;
}

function validateAlumnusInput(
  body: AlumnusInput,
  opts: { requireLocation: boolean },
): { ok: true; value: ValidatedAlumnus } | { ok: false; error: string } {
  if (opts.requireLocation) {
    if (typeof body.locationId !== 'number' || !Number.isFinite(body.locationId)) {
      return { ok: false, error: 'locationId required' };
    }
  }

  if (typeof body.fullName !== 'string') return { ok: false, error: 'fullName required' };
  const fullName = body.fullName.trim();
  if (fullName.length === 0) return { ok: false, error: 'fullName required' };
  if (fullName.length > MAX_FULL_NAME) {
    return { ok: false, error: `fullName too long (max ${MAX_FULL_NAME})` };
  }

  if (typeof body.graduationYear !== 'number' || !Number.isInteger(body.graduationYear)) {
    return { ok: false, error: 'graduationYear must be an integer' };
  }
  const yearMax = new Date().getFullYear() + 1;
  if (body.graduationYear < YEAR_MIN || body.graduationYear > yearMax) {
    return { ok: false, error: `graduationYear out of range (${YEAR_MIN}–${yearMax})` };
  }

  if (typeof body.homeroomTeacher !== 'string') return { ok: false, error: 'homeroomTeacher required' };
  const homeroomTeacher = body.homeroomTeacher.trim();
  if (homeroomTeacher.length === 0) return { ok: false, error: 'homeroomTeacher required' };
  if (homeroomTeacher.length > MAX_TEACHER) {
    return { ok: false, error: `homeroomTeacher too long (max ${MAX_TEACHER})` };
  }

  if (typeof body.motto !== 'string') return { ok: false, error: 'motto required' };
  const motto = body.motto.trim();
  if (motto.length === 0) return { ok: false, error: 'motto required' };
  if (motto.length > MAX_MOTTO) return { ok: false, error: `motto too long (max ${MAX_MOTTO})` };

  let email: string | null = null;
  if (body.email !== undefined && body.email !== null) {
    if (typeof body.email !== 'string') return { ok: false, error: 'email must be a string' };
    const trimmed = body.email.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > MAX_EMAIL) {
        return { ok: false, error: `email too long (max ${MAX_EMAIL})` };
      }
      if (!EMAIL_REGEX.test(trimmed)) return { ok: false, error: 'email invalid' };
      email = trimmed;
    }
  }

  let photoMediaId: number | null = null;
  if (body.photoMediaId !== undefined && body.photoMediaId !== null) {
    if (typeof body.photoMediaId !== 'number' || !Number.isInteger(body.photoMediaId)) {
      return { ok: false, error: 'photoMediaId must be an integer' };
    }
    photoMediaId = body.photoMediaId;
  }

  return {
    ok: true,
    value: {
      locationId: body.locationId,
      fullName,
      graduationYear: body.graduationYear,
      homeroomTeacher,
      motto,
      email,
      photoMediaId,
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

// Returns `null` if the location exists and is a school; otherwise an error tuple.
async function assertSchool(locationId: number): Promise<{ code: number; error: string } | null> {
  const [loc] = await db
    .select({ catId: locations.catId })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  if (!loc) return { code: 404, error: 'Lokacija ne postoji' };
  if (loc.catId !== 'school') return { code: 400, error: 'Alumni je dostupan samo za škole' };
  return null;
}

// Verifies the media row exists, is owned by the caller (or admin), and is tagged
// as an `alumni_photo`. Prevents an owner from attaching another user's upload or
// a service_photo to an alumni record.
async function assertOwnsAlumniPhoto(
  userId: number,
  role: string,
  photoMediaId: number,
): Promise<{ code: number; error: string } | null> {
  const [row] = await db
    .select({ ownerUserId: media.ownerUserId, kind: media.kind })
    .from(media)
    .where(eq(media.id, photoMediaId))
    .limit(1);
  if (!row) return { code: 400, error: 'photoMediaId not found' };
  if (row.kind !== 'alumni_photo') return { code: 400, error: 'photoMediaId is not an alumni photo' };
  if (role !== 'admin' && row.ownerUserId !== userId) {
    return { code: 403, error: 'photoMediaId not owned by caller' };
  }
  return null;
}

export async function alumniRoutes(app: FastifyInstance) {
  // Public list — by location slug. Filters: year (exact), q (ILIKE on full_name).
  // Email is omitted from the response when the request is not authenticated.
  app.get<{ Params: { slug: string }; Querystring: { year?: string; q?: string; limit?: string } }>(
    '/api/locations/:slug/alumni',
    async (req, reply) => {
      const [loc] = await db
        .select({ id: locations.id, catId: locations.catId })
        .from(locations)
        .where(eq(locations.slug, req.params.slug))
        .limit(1);
      if (!loc) return reply.code(404).send({ error: 'Lokacija ne postoji' });
      if (loc.catId !== 'school') {
        return reply.code(400).send({ error: 'Alumni je dostupan samo za škole' });
      }

      const conds = [eq(alumni.locationId, loc.id)];
      if (req.query.year !== undefined) {
        const y = Number(req.query.year);
        if (Number.isInteger(y)) conds.push(eq(alumni.graduationYear, y));
      }
      if (req.query.q) {
        const safe = escapeLikePattern(req.query.q.slice(0, 80));
        conds.push(ilike(alumni.fullName, `%${safe}%`));
      }

      const rows = await db
        .select({
          id: alumni.id,
          locationId: alumni.locationId,
          fullName: alumni.fullName,
          graduationYear: alumni.graduationYear,
          homeroomTeacher: alumni.homeroomTeacher,
          motto: alumni.motto,
          email: alumni.email,
          photoMediaId: alumni.photoMediaId,
          createdAt: alumni.createdAt,
          updatedAt: alumni.updatedAt,
        })
        .from(alumni)
        .where(and(...conds))
        .orderBy(desc(alumni.graduationYear), asc(alumni.fullName))
        .limit(clampLimit(req.query.limit));

      const user = await getOptionalUser(req);
      if (user) return rows;
      return rows.map(({ email: _email, ...rest }) => rest);
    },
  );

  // Owner inbox — list all alumni the caller can manage. Always includes email.
  app.get<{ Querystring: { locationId?: string } }>(
    '/api/owner/alumni',
    { preHandler: requireRole('business') },
    async (req) => {
      const conds = [];
      if (req.user.role !== 'admin') {
        const owned = await db
          .select({ id: objectOwners.locationId })
          .from(objectOwners)
          .where(eq(objectOwners.userId, req.user.sub));
        if (owned.length === 0) return [];
        conds.push(inArray(alumni.locationId, owned.map((o) => o.id)));
      }
      if (req.query.locationId) {
        const lid = Number(req.query.locationId);
        if (Number.isFinite(lid)) conds.push(eq(alumni.locationId, lid));
      }
      const where = conds.length ? and(...conds) : undefined;
      return db
        .select({
          id: alumni.id,
          locationId: alumni.locationId,
          fullName: alumni.fullName,
          graduationYear: alumni.graduationYear,
          homeroomTeacher: alumni.homeroomTeacher,
          motto: alumni.motto,
          email: alumni.email,
          photoMediaId: alumni.photoMediaId,
          createdAt: alumni.createdAt,
          updatedAt: alumni.updatedAt,
          locationName: locations.name,
          locationSlug: locations.slug,
          locationCatId: locations.catId,
        })
        .from(alumni)
        .innerJoin(locations, eq(locations.id, alumni.locationId))
        .where(where)
        .orderBy(desc(alumni.graduationYear), asc(alumni.fullName))
        .limit(MAX_LIMIT);
    },
  );

  // Owner create.
  app.post<{ Body: AlumnusInput }>(
    '/api/owner/alumni',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const v = validateAlumnusInput(req.body ?? {}, { requireLocation: true });
      if (!v.ok) return reply.code(400).send({ error: v.error });
      const locationId = v.value.locationId as number;

      if (!(await userOwnsLocation(req.user.sub, req.user.role, locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const schoolErr = await assertSchool(locationId);
      if (schoolErr) return reply.code(schoolErr.code).send({ error: schoolErr.error });

      if (v.value.photoMediaId !== null) {
        const photoErr = await assertOwnsAlumniPhoto(req.user.sub, req.user.role, v.value.photoMediaId);
        if (photoErr) return reply.code(photoErr.code).send({ error: photoErr.error });
      }

      const [{ existing }] = await db
        .select({ existing: count() })
        .from(alumni)
        .where(eq(alumni.locationId, locationId));
      if (Number(existing) >= MAX_ALUMNI_PER_LOCATION) {
        return reply
          .code(409)
          .send({ error: `Too many alumni for this location (max ${MAX_ALUMNI_PER_LOCATION})` });
      }

      const [row] = await db
        .insert(alumni)
        .values({
          locationId,
          fullName: v.value.fullName,
          graduationYear: v.value.graduationYear,
          homeroomTeacher: v.value.homeroomTeacher,
          motto: v.value.motto,
          email: v.value.email,
          photoMediaId: v.value.photoMediaId,
        })
        .returning();
      return reply.code(201).send(row);
    },
  );

  // Owner update.
  app.patch<{ Params: { id: string }; Body: AlumnusInput }>(
    '/api/owner/alumni/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [row] = await db.select().from(alumni).where(eq(alumni.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (!(await userOwnsLocation(req.user.sub, req.user.role, row.locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const v = validateAlumnusInput(req.body ?? {}, { requireLocation: false });
      if (!v.ok) return reply.code(400).send({ error: v.error });

      // The row is already attached to a school (creation gated it), so we don't
      // re-check the category here. Photo ownership still needs verification.
      if (v.value.photoMediaId !== null && v.value.photoMediaId !== row.photoMediaId) {
        const photoErr = await assertOwnsAlumniPhoto(req.user.sub, req.user.role, v.value.photoMediaId);
        if (photoErr) return reply.code(photoErr.code).send({ error: photoErr.error });
      }

      const [updated] = await db
        .update(alumni)
        .set({
          fullName: v.value.fullName,
          graduationYear: v.value.graduationYear,
          homeroomTeacher: v.value.homeroomTeacher,
          motto: v.value.motto,
          email: v.value.email,
          photoMediaId: v.value.photoMediaId,
          updatedAt: new Date(),
        })
        .where(eq(alumni.id, id))
        .returning();
      return updated;
    },
  );

  // Owner delete.
  app.delete<{ Params: { id: string } }>(
    '/api/owner/alumni/:id',
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const [row] = await db.select().from(alumni).where(eq(alumni.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      if (!(await userOwnsLocation(req.user.sub, req.user.role, row.locationId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await db.delete(alumni).where(eq(alumni.id, id));
      return { ok: true };
    },
  );
}
