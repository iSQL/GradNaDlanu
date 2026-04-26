import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { objectOwners } from '../db/schema.js';
import type { Role } from '../db/schema.js';

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// Admin always passes role checks. Otherwise the user's role must match.
export function requireRole(role: Exclude<Role, 'user'>): preHandlerHookHandler {
  return async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (req.user.role !== 'admin' && req.user.role !== role) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

// Gate by object ownership. Admin always passes. `locationParam` is the route
// param holding the location id (defaults to ':id').
export function requireOwner(locationParam = 'id'): preHandlerHookHandler {
  return async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (req.user.role === 'admin') return;
    const params = req.params as Record<string, string>;
    const locationId = Number(params[locationParam]);
    if (!Number.isFinite(locationId)) {
      return reply.code(400).send({ error: `Invalid ${locationParam}` });
    }
    const [row] = await db
      .select()
      .from(objectOwners)
      .where(and(eq(objectOwners.userId, req.user.sub), eq(objectOwners.locationId, locationId)))
      .limit(1);
    if (!row) return reply.code(403).send({ error: 'Forbidden' });
  };
}

// Backwards-compat alias used by v1 admin routes. Equivalent to requireRole('admin').
export const requireAdmin = requireRole('admin');

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; email: string; role: Role };
    user: { sub: number; email: string; role: Role };
  }
}
