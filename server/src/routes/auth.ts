import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, objectOwners } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password required' });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });
    const token = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  });

  app.post<{ Body: { email: string; password: string; displayName: string } }>(
    '/api/auth/register',
    async (req, reply) => {
      const { email, password, displayName } = req.body ?? {};
      if (!email || !password || !displayName) {
        return reply.code(400).send({ error: 'email, password, displayName required' });
      }
      if (!isValidEmail(email)) {
        return reply.code(400).send({ error: 'Invalid email' });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'Password must be at least 6 characters' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      try {
        const [user] = await db
          .insert(users)
          .values({
            email: email.toLowerCase(),
            passwordHash,
            displayName,
            role: 'user',
          })
          .returning();
        const token = app.jwt.sign(
          { sub: user.id, email: user.email, role: user.role },
          { expiresIn: '7d' },
        );
        return {
          token,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('unique') || message.includes('duplicate')) {
          return reply.code(409).send({ error: 'Email already registered' });
        }
        throw err;
      }
    },
  );

  app.get('/api/me', { preHandler: requireAuth }, async (req, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.sub)).limit(1);
    if (!user) return reply.code(404).send({ error: 'Not found' });
    const owned = await db
      .select({ locationId: objectOwners.locationId })
      .from(objectOwners)
      .where(eq(objectOwners.userId, user.id));
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      ownedLocationIds: owned.map((o) => o.locationId),
    };
  });

  app.patch<{ Body: { displayName?: string } }>(
    '/api/me',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { displayName } = req.body ?? {};
      if (!displayName || typeof displayName !== 'string') {
        return reply.code(400).send({ error: 'displayName required' });
      }
      const [user] = await db
        .update(users)
        .set({ displayName })
        .where(eq(users.id, req.user.sub))
        .returning();
      if (!user) return reply.code(404).send({ error: 'Not found' });
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
    },
  );
}
