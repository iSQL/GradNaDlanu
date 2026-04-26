import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  checkins,
  comments,
  favorites,
  locations,
  objectOwners,
  users,
} from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';
import { getLocationBySlug } from '../lib/locations.js';

interface CommentNode {
  id: number;
  body: string;
  rating: number | null;
  createdAt: Date;
  author: { id: number; displayName: string };
  replies: CommentNode[];
}

export async function socialRoutes(app: FastifyInstance) {
  // Toggle favorite — POST adds, DELETE removes. Both idempotent.
  app.post<{ Params: { slug: string } }>(
    '/api/locations/:slug/favorite',
    { preHandler: requireAuth },
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      await db
        .insert(favorites)
        .values({ userId: req.user.sub, locationId: loc.id })
        .onConflictDoNothing();
      return { favorited: true };
    },
  );

  app.delete<{ Params: { slug: string } }>(
    '/api/locations/:slug/favorite',
    { preHandler: requireAuth },
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, req.user.sub), eq(favorites.locationId, loc.id)));
      return { favorited: false };
    },
  );

  app.get('/api/me/favorites', { preHandler: requireAuth }, async (req) => {
    const rows = await db
      .select({
        id: locations.id,
        slug: locations.slug,
        catId: locations.catId,
        name: locations.name,
        subtitle: locations.subtitle,
        address: locations.address,
        lat: locations.lat,
        lng: locations.lng,
        status: locations.status,
        createdAt: locations.createdAt,
        favoritedAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(locations, eq(favorites.locationId, locations.id))
      .where(eq(favorites.userId, req.user.sub))
      .orderBy(desc(favorites.createdAt));
    return rows;
  });

  // Public — tree shape: top-level comments with replies[]
  app.get<{ Params: { slug: string } }>(
    '/api/locations/:slug/comments',
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      const rows = await db
        .select({
          id: comments.id,
          body: comments.body,
          rating: comments.rating,
          createdAt: comments.createdAt,
          parentId: comments.parentId,
          authorId: users.id,
          authorName: users.displayName,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.locationId, loc.id), eq(comments.status, 'visible')))
        .orderBy(comments.createdAt);

      const byId = new Map<number, CommentNode>();
      const top: CommentNode[] = [];
      for (const r of rows) {
        const node: CommentNode = {
          id: r.id,
          body: r.body,
          rating: r.rating,
          createdAt: r.createdAt,
          author: { id: r.authorId, displayName: r.authorName },
          replies: [],
        };
        byId.set(r.id, node);
        if (r.parentId === null) top.push(node);
      }
      // Second pass — attach replies. Skip orphans (parent hidden/deleted).
      for (const r of rows) {
        if (r.parentId === null) continue;
        const parent = byId.get(r.parentId);
        const child = byId.get(r.id);
        if (parent && child) parent.replies.push(child);
      }
      return top;
    },
  );

  app.post<{
    Params: { slug: string };
    Body: { body: string; rating?: number; parentId?: number };
  }>(
    '/api/locations/:slug/comments',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { body, rating, parentId } = req.body ?? {};
      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        return reply.code(400).send({ error: 'body required' });
      }
      if (body.length > 2000) {
        return reply.code(400).send({ error: 'body too long (max 2000 chars)' });
      }
      if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
        return reply.code(400).send({ error: 'rating must be 1..5' });
      }
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });

      // Replies are restricted to the object owner (or admin). Visitors create top-level only.
      if (parentId !== undefined && parentId !== null) {
        const [parent] = await db
          .select({ locationId: comments.locationId })
          .from(comments)
          .where(eq(comments.id, parentId))
          .limit(1);
        if (!parent || parent.locationId !== loc.id) {
          return reply.code(400).send({ error: 'parentId does not belong to this location' });
        }
        if (req.user.role !== 'admin') {
          const [owner] = await db
            .select()
            .from(objectOwners)
            .where(
              and(
                eq(objectOwners.userId, req.user.sub),
                eq(objectOwners.locationId, loc.id),
              ),
            )
            .limit(1);
          if (!owner) return reply.code(403).send({ error: 'Only the object owner can reply' });
        }
      }

      const [row] = await db
        .insert(comments)
        .values({
          userId: req.user.sub,
          locationId: loc.id,
          body: body.trim(),
          rating: rating ?? null,
          parentId: parentId ?? null,
        })
        .returning();

      // Fetch author for the response so the UI can render immediately.
      const [author] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, req.user.sub))
        .limit(1);

      return {
        id: row.id,
        body: row.body,
        rating: row.rating,
        parentId: row.parentId,
        createdAt: row.createdAt,
        author,
      };
    },
  );

  app.get('/api/me/comments', { preHandler: requireAuth }, async (req) => {
    const rows = await db
      .select({
        id: comments.id,
        body: comments.body,
        rating: comments.rating,
        createdAt: comments.createdAt,
        locationId: locations.id,
        locationSlug: locations.slug,
        locationName: locations.name,
      })
      .from(comments)
      .innerJoin(locations, eq(comments.locationId, locations.id))
      .where(and(eq(comments.userId, req.user.sub), eq(comments.status, 'visible')))
      .orderBy(desc(comments.createdAt));
    // Suppress unused warning for isNull (kept around for future filtering)
    void isNull;
    return rows;
  });

  app.post<{ Params: { slug: string } }>(
    '/api/locations/:slug/checkin',
    { preHandler: requireAuth },
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      const [row] = await db
        .insert(checkins)
        .values({ userId: req.user.sub, locationId: loc.id })
        .returning();
      return { id: row.id, createdAt: row.createdAt };
    },
  );
}
