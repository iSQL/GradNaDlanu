import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';

// Powers the "Moj prostor" nav badge. Five independently-cleared counters:
//  - unreadMessages: messages from the other party newer than my read mark
//    (per-conversation last_read_*_at).
//  - reservationUpdates: my reservations decided (approved/declined) since I last
//    opened the Rezervacije tab (users.reservations_seen_at).
//  - followedUpdates: news/events from followed locations newer than I last
//    opened the Pratim tab (users.feed_seen_at).
//  - uslugeUpdates: counter-offers on my open service jobs newer than I last
//    opened the Usluge tab (users.usluge_seen_at). GREATEST(created, updated)
//    so an updated (re-sent) offer re-notifies.
//  - majstorJobs: open service jobs visible to me as a majstor, created since I
//    last opened /majstor (users.majstor_seen_at). Naturally 0 for non-majstori.
export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/api/me/notifications', { preHandler: requireAuth }, async (req) => {
    const me = req.user.sub;
    const rows = await db.execute<{
      unreadMessages: number;
      reservationUpdates: number;
      followedUpdates: number;
      uslugeUpdates: number;
      majstorJobs: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
           WHERE (c.user_low_id = ${me} OR c.user_high_id = ${me})
             AND m.sender_id <> ${me}
             AND m.created_at > COALESCE(
               CASE WHEN c.user_low_id = ${me} THEN c.last_read_low_at ELSE c.last_read_high_at END,
               to_timestamp(0))
        ) AS "unreadMessages",
        (SELECT COUNT(*)::int FROM reservations r
           WHERE r.user_id = ${me}
             AND r.decided_at IS NOT NULL
             AND r.decided_at > (SELECT reservations_seen_at FROM users WHERE id = ${me})
        ) AS "reservationUpdates",
        (
          (SELECT COUNT(*) FROM news n
             JOIN favorites f ON f.location_id = n.location_id
             WHERE f.user_id = ${me}
               AND COALESCE(n.published_at AT TIME ZONE 'UTC', n.created_at)
                   > (SELECT feed_seen_at FROM users WHERE id = ${me}))
          +
          (SELECT COUNT(*) FROM events e
             JOIN favorites f ON f.location_id = e.location_id
             WHERE f.user_id = ${me}
               AND e.created_at > (SELECT feed_seen_at FROM users WHERE id = ${me}))
        )::int AS "followedUpdates",
        (SELECT COUNT(*)::int FROM service_offers o
           JOIN service_jobs j ON j.id = o.job_id
           WHERE j.user_id = ${me}
             AND GREATEST(o.created_at, o.updated_at)
                 > (SELECT usluge_seen_at FROM users WHERE id = ${me})
        ) AS "uslugeUpdates",
        (SELECT COUNT(*)::int FROM service_jobs j
           WHERE j.status = 'open'
             AND j.user_id <> ${me}
             AND j.category_id IN (SELECT category_id FROM majstor_categories WHERE user_id = ${me})
             AND (j.target_user_ids IS NULL OR j.target_user_ids @> ${JSON.stringify([me])}::jsonb)
             AND j.created_at > (SELECT majstor_seen_at FROM users WHERE id = ${me})
        ) AS "majstorJobs"
    `);
    return (
      rows[0] ?? {
        unreadMessages: 0,
        reservationUpdates: 0,
        followedUpdates: 0,
        uslugeUpdates: 0,
        majstorJobs: 0,
      }
    );
  });

  app.post<{ Body: { section?: string } }>(
    '/api/me/seen',
    { preHandler: requireAuth },
    async (req, reply) => {
      const section = req.body?.section;
      const patch =
        section === 'reservations'
          ? { reservationsSeenAt: new Date() }
          : section === 'feed'
            ? { feedSeenAt: new Date() }
            : section === 'usluge'
              ? { uslugeSeenAt: new Date() }
              : section === 'majstor'
                ? { majstorSeenAt: new Date() }
                : null;
      if (!patch) {
        return reply
          .code(400)
          .send({ error: "section mora biti 'reservations', 'feed', 'usluge' ili 'majstor'" });
      }
      await db.update(users).set(patch).where(eq(users.id, req.user.sub));
      return { ok: true };
    },
  );
}
