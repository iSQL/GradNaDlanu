import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { events, news } from '../db/schema.js';

// Sva obaveštenja i događaji stariji od 30 dana se trajno brišu.
// 7-dana cutoff za prikazivanje "starih" je odluka UI-ja — DB drži duže
// da admin može da reaktivira ili pokrene retrospektivnu obradu.
const RETENTION_DAYS = 30;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

async function deleteOldNewsBatch(): Promise<number> {
  // News se sortira po publishedAt kad postoji, inače createdAt — primenjujemo
  // isti referentni datum za retention.
  const rows = await db.execute<{ id: number }>(sql`
    DELETE FROM ${news}
    WHERE id IN (
      SELECT id FROM ${news}
      WHERE COALESCE(published_at, created_at) < NOW() - (${RETENTION_DAYS} || ' days')::interval
      LIMIT ${BATCH_SIZE}
    )
    RETURNING id
  `);
  return rows.length;
}

async function deleteOldEventsBatch(): Promise<number> {
  // Za događaje pratimo "kraj života": ako endsAt postoji, koristi njega;
  // u suprotnom startsAt. Tako se višednevni festival ne briše dok ne istekne.
  const rows = await db.execute<{ id: number }>(sql`
    DELETE FROM ${events}
    WHERE id IN (
      SELECT id FROM ${events}
      WHERE COALESCE(ends_at, starts_at) < NOW() - (${RETENTION_DAYS} || ' days')::interval
      LIMIT ${BATCH_SIZE}
    )
    RETURNING id
  `);
  return rows.length;
}

async function sweepOldDesavanja(log: FastifyInstance['log']): Promise<void> {
  try {
    let totalNews = 0;
    let totalEvents = 0;
    for (let i = 0; i < 100; i++) {
      const n = await deleteOldNewsBatch();
      totalNews += n;
      if (n < BATCH_SIZE) break;
    }
    for (let i = 0; i < 100; i++) {
      const n = await deleteOldEventsBatch();
      totalEvents += n;
      if (n < BATCH_SIZE) break;
    }
    if (totalNews > 0 || totalEvents > 0) {
      log.info(
        { news: totalNews, events: totalEvents, retentionDays: RETENTION_DAYS },
        'desavanja cleanup swept',
      );
    }
  } catch (err) {
    log.error({ err }, 'desavanja cleanup failed');
  }
}

export function startDesavanjaCleanup(app: FastifyInstance): void {
  const timer = setInterval(() => { void sweepOldDesavanja(app.log); }, SWEEP_INTERVAL_MS);
  timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); });
  // Pokreni jednom odmah pri boot-u da dugotrajni restart ne ostavi backlog.
  void sweepOldDesavanja(app.log);
}
