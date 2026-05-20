import type { FastifyInstance } from 'fastify';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { media, objectOwners, serviceRequests } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';
import { env } from '../env.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Inspect first 12 bytes to verify the file actually is what its MIME claims.
// Returns the trusted MIME or null if mismatch.
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function extFor(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.bin';
}

export async function mediaRoutes(app: FastifyInstance) {
  const uploadRoot = resolve(env.uploadDir);
  await mkdir(uploadRoot, { recursive: true });

  // Upload a single photo. Returns { id }.
  app.post('/api/uploads', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(400).send({ error: 'multipart/form-data required' });
    }

    const file = await req.file({ limits: { fileSize: MAX_BYTES, files: 1 } });
    if (!file) return reply.code(400).send({ error: 'No file in request' });

    // Quick whitelist on the declared header before reading bytes.
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    // Stream to a temp path, then validate magic bytes by reading the head.
    // We buffer the whole file to inspect; 5 MB is acceptable in RAM.
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of file.file) {
      chunks.push(chunk as Buffer);
      total += (chunk as Buffer).length;
      if (total > MAX_BYTES) {
        return reply.code(400).send({ error: 'File too large (max 5 MB)' });
      }
    }
    if (file.file.truncated) {
      return reply.code(400).send({ error: 'File too large (max 5 MB)' });
    }
    const buf = Buffer.concat(chunks);
    const trustedMime = sniffMime(buf);
    if (!trustedMime || !ALLOWED_MIME.has(trustedMime)) {
      return reply.code(400).send({ error: 'File content does not match a supported image type' });
    }

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const relPath = join(yyyy, mm, randomUUID() + extFor(trustedMime));
    const absPath = join(uploadRoot, relPath);
    await mkdir(dirname(absPath), { recursive: true });

    const writeStream = createWriteStream(absPath);
    await pipeline(async function* () { yield buf; }(), writeStream);

    const [row] = await db
      .insert(media)
      .values({
        ownerUserId: req.user.sub,
        mimeType: trustedMime,
        sizeBytes: total,
        kind: 'service_photo',
        storagePath: relPath.split('\\').join('/'),
      })
      .returning({ id: media.id });
    return reply.code(201).send({ id: row.id });
  });

  // Serve a single media file. Authenticated; ACL gates access to owner,
  // tradesperson assigned to a service request that references the media, or admin.
  app.get<{ Params: { id: string } }>(
    '/api/media/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const [m] = await db.select().from(media).where(eq(media.id, id)).limit(1);
      if (!m) return reply.code(404).send({ error: 'Not found' });

      let allowed = false;
      if (req.user.role === 'admin') {
        allowed = true;
      } else if (m.ownerUserId === req.user.sub) {
        allowed = true;
      } else {
        // Check whether the caller owns any location whose service_requests reference this media id.
        const owned = await db
          .select({ locationId: objectOwners.locationId })
          .from(objectOwners)
          .where(eq(objectOwners.userId, req.user.sub));
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

      const absPath = join(uploadRoot, m.storagePath);
      reply.header('Content-Type', m.mimeType);
      reply.header('Cache-Control', 'private, max-age=300');
      return reply.send(createReadStream(absPath));
    },
  );
}
