import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { objectOwners, users } from '../db/schema.js';
import type { Role } from '../db/schema.js';

// Small in-process cache for token_version lookups. Each authenticated request
// would otherwise be one PK lookup against `users`. TTL is short enough that a
// role demotion / forced logout takes effect within seconds without hammering
// the DB.
const TOKEN_VERSION_TTL_MS = 5_000;
const tokenVersionCache = new Map<number, { v: number; expires: number }>();

async function currentTokenVersion(userId: number): Promise<number | null> {
  const cached = tokenVersionCache.get(userId);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.v;
  const [row] = await db
    .select({ tv: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  tokenVersionCache.set(userId, { v: row.tv, expires: now + TOKEN_VERSION_TTL_MS });
  return row.tv;
}

export function invalidateTokenVersionCache(userId: number): void {
  tokenVersionCache.delete(userId);
}

// Bumps the user's token_version so any outstanding JWT is rejected on next use.
// Call after role change, ownership revoke, or forced logout.
export async function bumpTokenVersion(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, userId));
  invalidateTokenVersionCache(userId);
}

async function verifyAndCheckVersion(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  const claimed = (req.user as { tv?: number }).tv;
  const current = await currentTokenVersion(req.user.sub);
  if (current === null || claimed === undefined || claimed !== current) {
    reply.code(401).send({ error: 'Session expired' });
    return false;
  }
  return true;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  await verifyAndCheckVersion(req, reply);
}

// Admin always passes role checks. Otherwise the user's role must match.
export function requireRole(role: Exclude<Role, 'user'>): preHandlerHookHandler {
  return async (req, reply) => {
    if (!(await verifyAndCheckVersion(req, reply))) return;
    if (req.user.role !== 'admin' && req.user.role !== role) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

// Gate by object ownership. Admin always passes. `locationParam` is the route
// param holding the location id (defaults to ':id').
export function requireOwner(locationParam = 'id'): preHandlerHookHandler {
  return async (req, reply) => {
    if (!(await verifyAndCheckVersion(req, reply))) return;
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

// Best-effort JWT verification for endpoints that work both anonymously and authenticated.
// Returns the decoded user, or null when no/invalid token is present.
export async function getOptionalUser(req: FastifyRequest) {
  try {
    await req.jwtVerify();
    const claimed = (req.user as { tv?: number }).tv;
    const current = await currentTokenVersion(req.user.sub);
    if (current === null || claimed === undefined || claimed !== current) return null;
    return req.user;
  } catch {
    return null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // email is null for guest accounts (one-click signup, no email). Becomes
    // non-null after a guest upgrades and verifies the address.
    payload: { sub: number; email: string | null; role: Role; tv: number };
    user: { sub: number; email: string | null; role: Role; tv: number };
  }
}
