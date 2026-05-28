import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

// Deletes `role='guest'` rows whose `last_active_at` is more than this many
// days in the past. The number is the contract surfaced in the GuestBanner UI
// ("istice za 7 dana neaktivnosti") — change both at once.
const INACTIVITY_THRESHOLD_DAYS = 7;
// Daily — the 7-day window means we don't need to sweep more often than that,
// and a longer interval keeps the per-run impact predictable.
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Batch size — keep individual DELETE transactions short to avoid locking the
// users table while ON DELETE CASCADE walks through favorites/comments/etc.
const BATCH_SIZE = 500;

async function runOneBatch(): Promise<number> {
  // Postgres doesn't allow LIMIT directly on DELETE — route through a subquery.
  // RETURNING gives us a row list whose .length is the actual deletion count
  // when used via drizzle's `db.execute` over postgres-js.
  const rows = await db.execute<{ id: number }>(sql`
    DELETE FROM ${users}
    WHERE id IN (
      SELECT id FROM ${users}
      WHERE role = 'guest'
        AND last_active_at < NOW() - (${INACTIVITY_THRESHOLD_DAYS} || ' days')::interval
      LIMIT ${BATCH_SIZE}
    )
    RETURNING id
  `);
  return rows.length;
}

async function sweepInactiveGuests(log: FastifyInstance['log']): Promise<void> {
  try {
    let totalDeleted = 0;
    // Loop until a partial batch tells us we've drained the eligible set.
    // CASCADE handles the per-row cleanup of favorites/comments/etc.
    for (let i = 0; i < 100; i++) {
      const deleted = await runOneBatch();
      totalDeleted += deleted;
      if (deleted < BATCH_SIZE) break;
    }
    if (totalDeleted > 0) {
      log.info({ count: totalDeleted, thresholdDays: INACTIVITY_THRESHOLD_DAYS }, 'guest cleanup swept');
    }
  } catch (err) {
    log.error({ err }, 'guest cleanup failed');
  }
}

export function startGuestCleanup(app: FastifyInstance): void {
  const timer = setInterval(() => { void sweepInactiveGuests(app.log); }, SWEEP_INTERVAL_MS);
  timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); });
  // Kick off one pass at boot so a long-stopped instance doesn't sit on a backlog.
  void sweepInactiveGuests(app.log);
}
