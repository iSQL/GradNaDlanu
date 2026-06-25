import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ads } from '../db/schema.js';

// Dvostepeni životni vek oglasa:
//  1) Oglasi koji nisu osveženi 7 dana (vlasnik nije posetio sajt) prelaze u
//     status='archived' — soft-delete, red se NE briše. Admin ih vraća iz arhive
//     i poruke ostaju vidljive korisnicima dok je oglas u arhivi.
//  2) Oglasi koji su u arhivi duže od ARCHIVE_RETENTION_DAYS se trajno brišu —
//     a to CASCADE briše i njihove razgovore + poruke (FK conversations.ad_id).
// Trajni oglasi (permanent=true) se preskaču u oba koraka. Obrazac prati
// lib/desavanja-cleanup.ts (setInterval 24h, unref, jedan prolaz na boot-u,
// batch po 500).
const EXPIRY_DAYS = 7;
const ARCHIVE_RETENTION_DAYS = 30;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

async function archiveStaleAdsBatch(): Promise<number> {
  const rows = await db.execute<{ id: number }>(sql`
    UPDATE ${ads}
    SET status = 'archived', archived_at = NOW()
    WHERE id IN (
      SELECT id FROM ${ads}
      WHERE status = 'active'
        AND NOT permanent
        AND last_refreshed_at < NOW() - (${EXPIRY_DAYS} || ' days')::interval
      LIMIT ${BATCH_SIZE}
    )
    RETURNING id
  `);
  return rows.length;
}

async function purgeOldArchivedAdsBatch(): Promise<number> {
  const rows = await db.execute<{ id: number }>(sql`
    DELETE FROM ${ads}
    WHERE id IN (
      SELECT id FROM ${ads}
      WHERE status = 'archived'
        AND NOT permanent
        AND archived_at IS NOT NULL
        AND archived_at < NOW() - (${ARCHIVE_RETENTION_DAYS} || ' days')::interval
      LIMIT ${BATCH_SIZE}
    )
    RETURNING id
  `);
  return rows.length;
}

async function sweepStaleAds(log: FastifyInstance['log']): Promise<void> {
  try {
    let archived = 0;
    for (let i = 0; i < 100; i++) {
      const n = await archiveStaleAdsBatch();
      archived += n;
      if (n < BATCH_SIZE) break;
    }
    let purged = 0;
    for (let i = 0; i < 100; i++) {
      const n = await purgeOldArchivedAdsBatch();
      purged += n;
      if (n < BATCH_SIZE) break;
    }
    if (archived > 0 || purged > 0) {
      log.info(
        { archived, purged, expiryDays: EXPIRY_DAYS, retentionDays: ARCHIVE_RETENTION_DAYS },
        'oglasi cleanup swept',
      );
    }
  } catch (err) {
    log.error({ err }, 'oglasi cleanup failed');
  }
}

export function startOglasiCleanup(app: FastifyInstance): void {
  const timer = setInterval(() => { void sweepStaleAds(app.log); }, SWEEP_INTERVAL_MS);
  timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); });
  // Pokreni jednom odmah pri boot-u da dugotrajni restart ne ostavi backlog.
  void sweepStaleAds(app.log);
}
