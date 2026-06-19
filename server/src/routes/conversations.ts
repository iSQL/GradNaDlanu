import type { FastifyInstance } from 'fastify';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ads, conversations, messages, users } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';
import { validateMessageBody } from '../lib/oglasi.js';

// Bump a conversation's activity and mark the conversation read for the sender.
async function touchConversationForSender(conversationId: number, isLow: boolean): Promise<void> {
  await db
    .update(conversations)
    .set(
      isLow
        ? { lastMessageAt: new Date(), lastReadLowAt: new Date() }
        : { lastMessageAt: new Date(), lastReadHighAt: new Date() },
    )
    .where(eq(conversations.id, conversationId));
}

export async function conversationsRoutes(app: FastifyInstance) {
  // Start a conversation (or reuse an existing one for the same pair+ad) and
  // post its first message. Guests may read threads but not start/post.
  app.post<{ Body: { recipientId?: number; adId?: number; body?: unknown } }>(
    '/api/conversations',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (req.user.role === 'guest') {
        return reply.code(403).send({
          error: 'Za slanje poruka je potreban trajan nalog.',
          code: 'guest_not_allowed',
        });
      }
      const me = req.user.sub;
      const v = validateMessageBody(req.body?.body);
      if (!v.ok) return reply.code(400).send({ error: v.error });

      let recipientId: number | null = null;
      let adId: number | null = null;
      let adTitleSnapshot: string | null = null;

      if (req.body?.adId !== undefined && req.body?.adId !== null) {
        const id = Number(req.body.adId);
        const [ad] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
        if (!ad) return reply.code(404).send({ error: 'Oglas ne postoji' });
        recipientId = ad.userId;
        adId = ad.id;
        adTitleSnapshot = ad.title;
      } else if (req.body?.recipientId !== undefined && req.body?.recipientId !== null) {
        recipientId = Number(req.body.recipientId);
      } else {
        return reply.code(400).send({ error: 'Navedite adId ili recipientId' });
      }

      if (!Number.isInteger(recipientId) || recipientId <= 0) {
        return reply.code(400).send({ error: 'Neispravan primalac' });
      }
      if (recipientId === me) {
        return reply.code(400).send({ error: 'Ne možete poslati poruku sami sebi' });
      }
      const [recipient] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, recipientId))
        .limit(1);
      if (!recipient) return reply.code(404).send({ error: 'Primalac ne postoji' });

      const low = Math.min(me, recipientId);
      const high = Math.max(me, recipientId);

      // Find an existing thread for this exact pair + ad (NULL ad treated as 0).
      let [conv] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userLowId, low),
            eq(conversations.userHighId, high),
            sql`coalesce(${conversations.adId}, 0) = ${adId ?? 0}`,
          ),
        )
        .limit(1);

      if (!conv) {
        try {
          [conv] = await db
            .insert(conversations)
            .values({ adId, adTitleSnapshot, userLowId: low, userHighId: high })
            .returning();
        } catch {
          // Lost a race on the unique index — re-select the row the winner made.
          [conv] = await db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.userLowId, low),
                eq(conversations.userHighId, high),
                sql`coalesce(${conversations.adId}, 0) = ${adId ?? 0}`,
              ),
            )
            .limit(1);
        }
      }
      if (!conv) return reply.code(500).send({ error: 'Greška pri kreiranju razgovora' });

      await db.insert(messages).values({ conversationId: conv.id, senderId: me, body: v.body });
      await touchConversationForSender(conv.id, me === low);

      return reply.code(201).send({ id: conv.id });
    },
  );

  // List my conversations with counterparty, last snippet, and unread count.
  app.get('/api/me/conversations', { preHandler: requireAuth }, async (req) => {
    const me = req.user.sub;
    const rows = await db.execute(sql`
      SELECT
        c.id AS "id",
        c.ad_id AS "adId",
        c.ad_title_snapshot AS "adTitleSnapshot",
        c.last_message_at AS "lastMessageAt",
        cp.id AS "counterpartyId",
        cp.display_name AS "counterpartyName",
        lm.body AS "lastSnippet",
        lm.created_at AS "lastSnippetAt",
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id <> ${me}
            AND (
              CASE WHEN c.user_low_id = ${me} THEN c.last_read_low_at ELSE c.last_read_high_at END IS NULL
              OR m.created_at > CASE WHEN c.user_low_id = ${me} THEN c.last_read_low_at ELSE c.last_read_high_at END
            )
        ) AS "unreadCount",
        (c.ad_id IS NOT NULL AND EXISTS (SELECT 1 FROM ads a WHERE a.id = c.ad_id AND a.status = 'active')) AS "adActive"
      FROM conversations c
      JOIN users cp ON cp.id = CASE WHEN c.user_low_id = ${me} THEN c.user_high_id ELSE c.user_low_id END
      LEFT JOIN LATERAL (
        SELECT body, created_at FROM messages m2
        WHERE m2.conversation_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) lm ON TRUE
      WHERE c.user_low_id = ${me} OR c.user_high_id = ${me}
      ORDER BY c.last_message_at DESC
    `);
    return rows;
  });

  // Full thread: conversation + counterparty + ordered messages.
  app.get<{ Params: { id: string } }>(
    '/api/conversations/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const me = req.user.sub;
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!conv) return reply.code(404).send({ error: 'Not found' });
      if (conv.userLowId !== me && conv.userHighId !== me) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const counterpartyId = conv.userLowId === me ? conv.userHighId : conv.userLowId;
      const [counterparty] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, counterpartyId))
        .limit(1);
      const msgs = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          body: messages.body,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(asc(messages.createdAt));

      let adActive = false;
      if (conv.adId !== null) {
        const [ad] = await db
          .select({ status: ads.status })
          .from(ads)
          .where(eq(ads.id, conv.adId))
          .limit(1);
        adActive = !!ad && ad.status === 'active';
      }

      return {
        id: conv.id,
        adId: conv.adId,
        adTitleSnapshot: conv.adTitleSnapshot,
        adActive,
        counterpartyId,
        counterpartyName: counterparty?.displayName ?? 'Korisnik',
        messages: msgs,
      };
    },
  );

  // Post a message to an existing conversation.
  app.post<{ Params: { id: string }; Body: { body?: unknown } }>(
    '/api/conversations/:id/messages',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (req.user.role === 'guest') {
        return reply.code(403).send({
          error: 'Za slanje poruka je potreban trajan nalog.',
          code: 'guest_not_allowed',
        });
      }
      const id = Number(req.params.id);
      const me = req.user.sub;
      const v = validateMessageBody(req.body?.body);
      if (!v.ok) return reply.code(400).send({ error: v.error });
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!conv) return reply.code(404).send({ error: 'Not found' });
      if (conv.userLowId !== me && conv.userHighId !== me) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const [row] = await db
        .insert(messages)
        .values({ conversationId: id, senderId: me, body: v.body })
        .returning();
      await touchConversationForSender(id, me === conv.userLowId);
      return reply.code(201).send(row);
    },
  );

  // Delete a conversation. Either participant may delete it; it's removed for
  // both (messages cascade). Mutual by design — a chat one side abandons
  // shouldn't linger for the other.
  app.delete<{ Params: { id: string } }>(
    '/api/conversations/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const me = req.user.sub;
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!conv) return reply.code(404).send({ error: 'Not found' });
      if (conv.userLowId !== me && conv.userHighId !== me) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await db.delete(conversations).where(eq(conversations.id, id));
      return { ok: true };
    },
  );

  // Mark a conversation read up to now for the current participant.
  app.post<{ Params: { id: string } }>(
    '/api/conversations/:id/read',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number(req.params.id);
      const me = req.user.sub;
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!conv) return reply.code(404).send({ error: 'Not found' });
      if (conv.userLowId !== me && conv.userHighId !== me) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await db
        .update(conversations)
        .set(conv.userLowId === me ? { lastReadLowAt: new Date() } : { lastReadHighAt: new Date() })
        .where(eq(conversations.id, id));
      return { ok: true };
    },
  );
}
