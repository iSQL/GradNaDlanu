import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, objectOwners } from '../db/schema.js';
import { requireAuth } from '../lib/auth.js';
import { isRegistrationEnabled } from '../lib/settings.js';
import { sendVerificationEmail } from '../lib/email.js';
import { consumeVerificationToken, createVerificationToken } from '../lib/verification.js';
import { env } from '../env.js';

const BCRYPT_COST = 12;
const MAX_DISPLAY_NAME = 60;

// Bcrypt hash of a random string, generated at module load. Used to run a real
// bcrypt compare on the no-user branch of login so the response time matches
// the user-exists branch — closes the timing oracle that previously let an
// attacker enumerate registered emails. Generated at the same cost factor as
// real password hashes so the timing actually matches.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), BCRYPT_COST);

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeDisplayName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'displayName required' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: 'displayName required' };
  if (trimmed.length > MAX_DISPLAY_NAME) return { ok: false, error: `displayName too long (max ${MAX_DISPLAY_NAME})` };
  return { ok: true, value: trimmed };
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          // Per-IP. We don't key by email because the body isn't parsed yet
          // when the rate-limit hook runs in some configs, and keying by IP
          // is what prevents distributed brute force from a single attacker.
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return reply.code(400).send({ error: 'email and password required' });
      }
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);
      if (!user) {
        // Constant-time-ish: always do a bcrypt compare so the response time
        // doesn't reveal whether the email exists.
        await bcrypt.compare(password, DUMMY_HASH);
        return reply.code(401).send({ error: 'Invalid credentials' });
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });
      // Block login until the email has been verified. Separate error code so
      // the frontend can offer a "resend verification" affordance rather than
      // looking like a bad-password failure.
      if (!user.emailVerifiedAt) {
        return reply.code(403).send({
          error: 'Email nije potvrđen. Proverite poštu i potvrdite nalog.',
          code: 'email_not_verified',
        });
      }
      const token = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role, tv: user.tokenVersion },
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
    },
  );

  app.post<{ Body: { email: string; password: string; displayName: string } }>(
    '/api/auth/register',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    async (req, reply) => {
      if (!(await isRegistrationEnabled())) {
        return reply.code(403).send({ error: 'Registracija je trenutno onemogućena.' });
      }
      const { email, password, displayName } = req.body ?? {};
      if (!email || !password) {
        return reply.code(400).send({ error: 'email, password, displayName required' });
      }
      if (!isValidEmail(email)) {
        return reply.code(400).send({ error: 'Invalid email' });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'Password must be at least 6 characters' });
      }
      const nameCheck = normalizeDisplayName(displayName);
      if (!nameCheck.ok) return reply.code(400).send({ error: nameCheck.error });
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      let userId: number;
      let userEmail: string;
      let userDisplayName: string;
      try {
        const [user] = await db
          .insert(users)
          .values({
            email: email.toLowerCase(),
            passwordHash,
            displayName: nameCheck.value,
            role: 'user',
          })
          .returning();
        userId = user.id;
        userEmail = user.email;
        userDisplayName = user.displayName;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === '23505') {
          return reply.code(409).send({ error: 'Email already registered' });
        }
        throw err;
      }

      // User row is in place but unverified. Generate a token and email it.
      // If email sending fails we still return success — the user exists and
      // can request a new email via /api/auth/resend-verification.
      try {
        const rawToken = await createVerificationToken(userId);
        const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
        await sendVerificationEmail({ to: userEmail, displayName: userDisplayName, verifyUrl });
      } catch (err) {
        req.log.error({ err, email: userEmail }, 'failed to send verification email at register time');
      }

      return {
        ok: true,
        email: userEmail,
        message: 'Poslali smo vam email sa linkom za potvrdu.',
      };
    },
  );

  app.post<{ Body: { token: string } }>(
    '/api/auth/verify-email',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 hour',
        },
      },
    },
    async (req, reply) => {
      const raw = req.body?.token;
      if (typeof raw !== 'string' || raw.length === 0) {
        return reply.code(400).send({ error: 'token required' });
      }
      const userId = await consumeVerificationToken(raw);
      if (userId === null) {
        return reply.code(400).send({
          error: 'Link je istekao ili nije važeći.',
          code: 'invalid_or_expired',
        });
      }
      const [user] = await db
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (!user) {
        return reply.code(404).send({ error: 'Korisnik više ne postoji.' });
      }
      // Issue a JWT so the verifier is auto-logged in on the device that
      // clicked the link. Whoever holds the token proved they own the email.
      const token = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role, tv: user.tokenVersion },
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
    },
  );

  app.post<{ Body: { email: string } }>(
    '/api/auth/resend-verification',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    async (req, reply) => {
      const rawEmail = req.body?.email;
      // Always respond with the same 200 shape, regardless of whether the
      // email exists or is already verified — prevents address enumeration.
      const ok = { ok: true, message: 'Ako nalog postoji, poslali smo novi email.' };
      if (typeof rawEmail !== 'string' || !isValidEmail(rawEmail)) {
        return reply.code(400).send({ error: 'Invalid email' });
      }
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, rawEmail.toLowerCase()))
        .limit(1);
      if (!user || user.emailVerifiedAt) {
        return ok;
      }
      try {
        const rawToken = await createVerificationToken(user.id);
        const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
        await sendVerificationEmail({ to: user.email, displayName: user.displayName, verifyUrl });
      } catch (err) {
        req.log.error({ err, email: user.email }, 'failed to resend verification email');
      }
      return ok;
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
      const nameCheck = normalizeDisplayName(req.body?.displayName);
      if (!nameCheck.ok) return reply.code(400).send({ error: nameCheck.error });
      const [user] = await db
        .update(users)
        .set({ displayName: nameCheck.value })
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
