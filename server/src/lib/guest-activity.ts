import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { Role } from '../db/schema.js';

// `last_active_at` is the input to the 7-day inactivity sweep
// (server/src/lib/guest-cleanup.ts). We update it only on mutating
// guest-allowed actions (favorite, comment, check-in) — passive GETs don't
// count, otherwise a guest could keep an account alive indefinitely by reading
// the homepage in a background tab. Calling this for non-guest roles is a
// no-op so the call sites don't need a role check.
//
// The throttle Map is bounded with a simple FIFO eviction (cap at 10k entries).
// Worst case we do one extra UPDATE per evicted user — cheap.

const THROTTLE_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;
const lastTouchedAt = new Map<number, number>();

export function touchGuestActivity(userId: number, role: Role): void {
  if (role !== 'guest') return;
  const now = Date.now();
  const last = lastTouchedAt.get(userId);
  if (last !== undefined && now - last < THROTTLE_MS) return;

  // Bounded LRU-ish: when full, drop the oldest insertion.
  if (lastTouchedAt.size >= MAX_ENTRIES && !lastTouchedAt.has(userId)) {
    const oldestKey = lastTouchedAt.keys().next().value;
    if (oldestKey !== undefined) lastTouchedAt.delete(oldestKey);
  }
  lastTouchedAt.set(userId, now);

  // Fire-and-forget — the cleanup query tolerates "stale by one request" if
  // the UPDATE fails. Don't await; never let activity bookkeeping block the
  // user's request.
  db.update(users)
    .set({ lastActiveAt: new Date(now) })
    .where(eq(users.id, userId))
    .catch(() => {});
}
