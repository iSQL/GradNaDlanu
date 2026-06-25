import type { FastifyInstance } from 'fastify';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ads, alumni, media, objectOwners, serviceRequests } from '../db/schema.js';
import { getOptionalUser, requireAuth } from '../lib/auth.js';
import { env } from '../env.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_KINDS = new Set(['service_photo', 'alumni_photo', 'ad_photo']);
const SNIFF_BYTES = 12;

// Read just the first SNIFF_BYTES of a file and infer its image type.
// Returns the trusted MIME or null if it isn't one of the allowed image formats.
async function sniffFile(absPath: string): Promise<string | null> {
  const fh = await open(absPath, 'r');
  try {
    const buf = Buffer.alloc(SNIFF_BYTES);
    const { bytesRead } = await fh.read(buf, 0, SNIFF_BYTES, 0);
    if (bytesRead < SNIFF_BYTES) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
    ) return 'image/png';
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) return 'image/webp';
    return null;
  } finally {
    await fh.close();
  }
}

function extFor(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.bin';
}

// Periodic GC: deletes media rows (and their files) older than ORPHAN_AGE_HOURS
// that aren't referenced by any service_request.payload.photoIds array, an
// alumni row, or an ad's photo_media_id.
const ORPHAN_AGE_HOURS = 24;
const GC_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function gcOrphanMedia(uploadRoot: string, log: { info: (o: object, msg: string) => void; error: (o: object, msg: string) => void }) {
  try {
    const cutoff = new Date(Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000);
    const candidates = await db
      .select({ id: media.id, path: media.storagePath })
      .from(media)
      .where(lt(media.createdAt, cutoff))
      .limit(500);
    if (candidates.length === 0) return;

    const ids = candidates.map((c) => c.id);
    const referencedFromServiceRequests = await db
      .select({ id: media.id })
      .from(media)
      .innerJoin(
        serviceRequests,
        sql`(${serviceRequests.payload}->'photoIds') @> to_jsonb(${media.id})`,
      )
      .where(inArray(media.id, ids));
    const referencedFromAlumni = await db
      .select({ id: media.id })
      .from(media)
      .innerJoin(alumni, eq(alumni.photoMediaId, media.id))
      .where(inArray(media.id, ids));
    const referencedFromAds = await db
      .select({ id: media.id })
      .from(media)
      .innerJoin(ads, eq(ads.photoMediaId, media.id))
      .where(inArray(media.id, ids));
    const refSet = new Set<number>();
    for (const r of referencedFromServiceRequests) refSet.add(r.id);
    for (const r of referencedFromAlumni) refSet.add(r.id);
    for (const r of referencedFromAds) refSet.add(r.id);
    const orphans = candidates.filter((c) => !refSet.has(c.id));
    if (orphans.length === 0) return;

    for (const o of orphans) {
      const abs = join(uploadRoot, o.path);
      const rootWithSep = uploadRoot.endsWith(sep) ? uploadRoot : uploadRoot + sep;
      if (!abs.startsWith(rootWithSep)) continue;
      try { await unlink(abs); } catch { /* file may already be gone */ }
    }
    await db.delete(media).where(inArray(media.id, orphans.map((o) => o.id)));
    log.info({ count: orphans.length }, 'orphan media gc');
  } catch (err) {
    log.error({ err }, 'orphan media gc failed');
  }
}

export async function mediaRoutes(app: FastifyInstance) {
  const uploadRoot = resolve(env.uploadDir);
  await mkdir(uploadRoot, { recursive: true });
  const uploadRootWithSep = uploadRoot.endsWith(sep) ? uploadRoot : uploadRoot + sep;

  const gcTimer = setInterval(() => { void gcOrphanMedia(uploadRoot, app.log); }, GC_INTERVAL_MS);
  gcTimer.unref();
  app.addHook('onClose', async () => { clearInterval(gcTimer); });
  // Kick off one GC pass on boot so a long-stopped server doesn't accumulate.
  void gcOrphanMedia(uploadRoot, app.log);

  // Upload a single photo. Returns { id }.
  app.post('/api/uploads', {
    preHandler: requireAuth,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 day',
        keyGenerator: (req) => req.headers.authorization ?? req.ip,
      },
    },
  }, async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(400).send({ error: 'multipart/form-data required' });
    }

    const file = await req.file({ limits: { fileSize: MAX_BYTES, files: 1 } });
    if (!file) return reply.code(400).send({ error: 'No file in request' });

    if (!ALLOWED_MIME.has(file.mimetype)) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    // Optional `kind` field — sent alongside the file in the multipart body.
    // Defaults to 'service_photo' for back-compat with majstor flows.
    const kindField = file.fields?.kind;
    let kind = 'service_photo';
    if (kindField && !Array.isArray(kindField) && 'value' in kindField && typeof kindField.value === 'string') {
      if (!ALLOWED_KINDS.has(kindField.value)) {
        return reply.code(400).send({ error: 'Unsupported kind' });
      }
      kind = kindField.value;
    }

    // Stream to a temp file rather than buffering in RAM. We sniff the magic
    // bytes from disk, then rename into the final location on success.
    const tmpPath = join(tmpdir(), `gnd-upload-${randomUUID()}`);
    let cleanupTmp = true;
    let totalBytes = 0;
    try {
      const ws = createWriteStream(tmpPath);
      file.file.on('data', (chunk: Buffer) => { totalBytes += chunk.length; });
      await pipeline(file.file, ws);
      if (file.file.truncated || totalBytes > MAX_BYTES) {
        return reply.code(400).send({ error: 'File too large (max 5 MB)' });
      }

      const trustedMime = await sniffFile(tmpPath);
      if (!trustedMime || !ALLOWED_MIME.has(trustedMime)) {
        return reply.code(400).send({ error: 'File content does not match a supported image type' });
      }

      const now = new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const relPath = join(yyyy, mm, randomUUID() + extFor(trustedMime));
      const absPath = join(uploadRoot, relPath);
      if (!absPath.startsWith(uploadRootWithSep)) {
        return reply.code(500).send({ error: 'Invalid storage path' });
      }
      await mkdir(dirname(absPath), { recursive: true });
      await rename(tmpPath, absPath);
      cleanupTmp = false;

      const [row] = await db
        .insert(media)
        .values({
          ownerUserId: req.user.sub,
          mimeType: trustedMime,
          sizeBytes: totalBytes,
          kind,
          storagePath: relPath.split('\\').join('/'),
        })
        .returning({ id: media.id });
      return reply.code(201).send({ id: row.id });
    } finally {
      if (cleanupTmp) {
        try { await unlink(tmpPath); } catch { /* nothing to clean */ }
      }
    }
  });

  // Serve a single media file. Public for alumni photos referenced by an alumni
  // row; otherwise gated to admin, the upload owner, or a tradesperson whose
  // assigned service request references the media.
  app.get<{ Params: { id: string } }>(
    '/api/media/:id',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const [m] = await db.select().from(media).where(eq(media.id, id)).limit(1);
      if (!m) return reply.code(404).send({ error: 'Not found' });

      let allowed = false;

      // Alumni photos are public iff they're still referenced by an alumni row.
      // The alumni table is the gating index: deletes drop the FK to null and
      // the GC sweep eventually reaps the orphan file.
      if (m.kind === 'alumni_photo') {
        const [hit] = await db
          .select({ id: alumni.id })
          .from(alumni)
          .where(eq(alumni.photoMediaId, id))
          .limit(1);
        if (hit) allowed = true;
      }

      // Ad photos are public iff referenced by an *active* (non-archived) ad.
      // Archived ads' photos fall through to owner/admin-only access below.
      if (!allowed && m.kind === 'ad_photo') {
        const [hit] = await db
          .select({ id: ads.id })
          .from(ads)
          .where(and(eq(ads.photoMediaId, id), eq(ads.status, 'active')))
          .limit(1);
        if (hit) allowed = true;
      }

      if (!allowed) {
        const user = await getOptionalUser(req);
        if (!user) return reply.code(401).send({ error: 'Unauthorized' });
        if (user.role === 'admin') {
          allowed = true;
        } else if (m.ownerUserId === user.sub) {
          allowed = true;
        } else {
          const owned = await db
            .select({ locationId: objectOwners.locationId })
            .from(objectOwners)
            .where(eq(objectOwners.userId, user.sub));
          if (owned.length > 0) {
            const ownedIds = owned.map((o) => o.locationId);
            const [hit] = await db
              .select({ id: serviceRequests.id })
              .from(serviceRequests)
              .where(
                and(
                  inArray(serviceRequests.locationId, ownedIds),
                  sql`(${serviceRequests.payload}->'photoIds') @> ${JSON.stringify([id])}::jsonb`,
                ),
              )
              .limit(1);
            if (hit) allowed = true;
          }
        }
        if (!allowed) return reply.code(403).send({ error: 'Forbidden' });
      }

      const absPath = join(uploadRoot, m.storagePath);
      // Defense-in-depth: stored paths are server-generated UUIDs, but verify
      // the resolved path can't escape the upload root before opening.
      if (!absPath.startsWith(uploadRootWithSep)) {
        return reply.code(500).send({ error: 'Invalid storage path' });
      }
      reply.header('Content-Type', m.mimeType);
      reply.header(
        'Cache-Control',
        m.kind === 'alumni_photo' || m.kind === 'ad_photo'
          ? 'public, max-age=3600'
          : 'private, max-age=300',
      );
      return reply.send(createReadStream(absPath));
    },
  );
}
