import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ads } from '../db/schema.js';
import type { Role } from '../db/schema.js';

// Refresh-on-visit za oglase. Svaki put kad prijavljeni korisnik učita sajt,
// /api/me poziva ovu funkciju i ona pomera `last_refreshed_at` na sada za sve
// njegove aktivne (ne-trajne) oglase — produžavajući im život za još 7 dana.
// Sweep (lib/oglasi-cleanup.ts) arhivira oglase koji nisu osveženi 7 dana.
//
// Mirror obrasca iz lib/guest-activity.ts: throttle Map sa FIFO eviction-om i
// fire-and-forget UPDATE, da bookkeeping nikad ne blokira korisnikov zahtev.
// Gostima oglasi nisu dozvoljeni, pa je za 'guest' ovo no-op.

const THROTTLE_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;
const lastTouchedAt = new Map<number, number>();

export function touchAdsRefresh(userId: number, role: Role): void {
  if (role === 'guest') return;
  const now = Date.now();
  const last = lastTouchedAt.get(userId);
  if (last !== undefined && now - last < THROTTLE_MS) return;

  if (lastTouchedAt.size >= MAX_ENTRIES && !lastTouchedAt.has(userId)) {
    const oldestKey = lastTouchedAt.keys().next().value;
    if (oldestKey !== undefined) lastTouchedAt.delete(oldestKey);
  }
  lastTouchedAt.set(userId, now);

  db.update(ads)
    .set({ lastRefreshedAt: new Date(now) })
    .where(and(eq(ads.userId, userId), eq(ads.status, 'active'), sql`NOT ${ads.permanent}`))
    .catch(() => {});
}
