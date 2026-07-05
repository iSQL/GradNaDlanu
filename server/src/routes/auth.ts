import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, objectOwners, villageCurators, majstorCategories } from '../db/schema.js';
import { bumpTokenVersion, requireAuth } from '../lib/auth.js';
import { touchAdsRefresh } from '../lib/oglasi-activity.js';
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

// Kontakt telefon: null/prazan string briše broj; inače 5–30 znakova iz skupa
// cifre/razmak/+-/(). Namerno labavo — samo da spreči očigledno đubre.
function normalizePhone(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'phone: tekst ili null' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length < 5 || trimmed.length > 30) {
    return { ok: false, error: 'phone: 5–30 znakova' };
  }
  if (!/^[+0-9][0-9 ()/.-]*$/.test(trimmed)) {
    return { ok: false, error: 'phone: dozvoljene su cifre, razmak i + - / ( ) .' };
  }
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
      if (!user || !user.passwordHash) {
        // Constant-time-ish: always do a bcrypt compare so the response time
        // doesn't reveal whether the email exists. The !user.passwordHash
        // branch shouldn't be reachable in practice (guests have no email so
        // the lookup wouldn't match), but we treat a passwordless row as
        // "no credentials match" rather than crashing.
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
        // We just inserted with email.toLowerCase() so the column is
        // non-null on this row; the assertion narrows the now-nullable type.
        userEmail = user.email!;
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

      req.log.info({ userId, email: userEmail }, 'user registered');
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
      const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) {
        return reply.code(404).send({ error: 'Korisnik više ne postoji.' });
      }
      // Promote guest → user on first successful verification. This is the
      // single point in the system where guest accounts transition; keeping
      // the role flip here means an abandoned upgrade (email saved but never
      // verified) still gets caught by the 7-day guest GC. Bumping
      // tokenVersion invalidates the guest's old JWT — including any sessions
      // open in other tabs/devices — so they pick up the new role on next use.
      const wasGuest = existing.role === 'guest';
      const [user] = await db
        .update(users)
        .set({
          emailVerifiedAt: new Date(),
          ...(wasGuest ? { role: 'user' as const } : {}),
        })
        .where(eq(users.id, userId))
        .returning();
      if (!user) {
        return reply.code(404).send({ error: 'Korisnik više ne postoji.' });
      }
      if (wasGuest) await bumpTokenVersion(user.id);
      // Re-read tokenVersion if we bumped it; the .returning() row predates the bump.
      const freshTv = wasGuest ? user.tokenVersion + 1 : user.tokenVersion;
      // Issue a JWT so the verifier is auto-logged in on the device that
      // clicked the link. Whoever holds the token proved they own the email.
      const token = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role, tv: freshTv },
        { expiresIn: '7d' },
      );
      req.log.info(
        { userId: user.id, email: user.email, wasGuest },
        wasGuest ? 'guest upgraded and email verified' : 'user email verified',
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
      if (!user || user.emailVerifiedAt || !user.email) {
        return ok;
      }
      const userEmail = user.email;
      try {
        const rawToken = await createVerificationToken(user.id);
        const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
        await sendVerificationEmail({ to: userEmail, displayName: user.displayName, verifyUrl });
      } catch (err) {
        req.log.error({ err, email: userEmail }, 'failed to resend verification email');
      }
      return ok;
    },
  );

  app.get('/api/me', { preHandler: requireAuth }, async (req, reply) => {
    // Refresh-on-visit: a logged-in user loading the app keeps their active ads
    // alive for another 7 days. Throttled + fire-and-forget (lib/oglasi-activity).
    touchAdsRefresh(req.user.sub, req.user.role);
    const [user] = await db.select().from(users).where(eq(users.id, req.user.sub)).limit(1);
    if (!user) return reply.code(404).send({ error: 'Not found' });
    const owned = await db
      .select({ locationId: objectOwners.locationId })
      .from(objectOwners)
      .where(eq(objectOwners.userId, user.id));
    const curated = await db
      .select({ village: villageCurators.villageName })
      .from(villageCurators)
      .where(eq(villageCurators.userId, user.id));
    const majstorske = await db
      .select({ categoryId: majstorCategories.categoryId })
      .from(majstorCategories)
      .where(eq(majstorCategories.userId, user.id));
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      phone: user.phone,
      ownedLocationIds: owned.map((o) => o.locationId),
      curatedVillages: curated.map((c) => c.village),
      majstorCategories: majstorske.map((m) => m.categoryId),
    };
  });

  app.patch<{ Body: { displayName?: string; phone?: string | null } }>(
    '/api/me',
    { preHandler: requireAuth },
    async (req, reply) => {
      const patch: { displayName?: string; phone?: string | null } = {};
      if (req.body?.displayName !== undefined) {
        const nameCheck = normalizeDisplayName(req.body.displayName);
        if (!nameCheck.ok) return reply.code(400).send({ error: nameCheck.error });
        patch.displayName = nameCheck.value;
      }
      if (req.body !== null && typeof req.body === 'object' && 'phone' in req.body) {
        const phoneCheck = normalizePhone(req.body.phone);
        if (!phoneCheck.ok) return reply.code(400).send({ error: phoneCheck.error });
        patch.phone = phoneCheck.value;
      }
      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'Nema izmena' });
      }
      const [user] = await db
        .update(users)
        .set(patch)
        .where(eq(users.id, req.user.sub))
        .returning();
      if (!user) return reply.code(404).send({ error: 'Not found' });
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        phone: user.phone,
      };
    },
  );

  // One-click guest signup. Creates a `role='guest'` row with no email and no
  // password. Auto-logs in via JWT. Gated by the same `registration_enabled`
  // kill switch as full register so an admin can shut both off in one click
  // during a spam wave.
  app.post<{ Body: { displayName: string } }>(
    '/api/auth/guest',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
        },
      },
    },
    async (req, reply) => {
      if (!(await isRegistrationEnabled())) {
        return reply.code(403).send({ error: 'Registracija je trenutno onemogućena.' });
      }
      if (!consumeGuestSlot()) {
        return reply.code(429).send({ error: 'Trenutno previše gost naloga. Pokušajte ponovo kasnije.' });
      }
      const nameCheck = normalizeDisplayName(req.body?.displayName);
      if (!nameCheck.ok) return reply.code(400).send({ error: nameCheck.error });
      const [user] = await db
        .insert(users)
        .values({
          email: null,
          passwordHash: null,
          displayName: nameCheck.value,
          role: 'guest',
        })
        .returning();
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

  // Upgrade a guest to a permanent account. We stash the email + password_hash
  // on the existing row but keep `role='guest'` until they click the
  // verification link — that way an abandoned upgrade is still swept by the
  // 7-day inactivity GC instead of becoming a zombie 'user' row with
  // `email_verified_at = null` and no path to deletion.
  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/upgrade',
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    async (req, reply) => {
      if (req.user.role !== 'guest') {
        return reply.code(400).send({
          error: 'Samo gost nalozi mogu biti nadograđeni.',
          code: 'not_a_guest',
        });
      }
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return reply.code(400).send({ error: 'email i password su obavezni' });
      }
      if (!isValidEmail(email)) {
        return reply.code(400).send({ error: 'Invalid email' });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'Password must be at least 6 characters' });
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const lowered = email.toLowerCase();
      let updated;
      try {
        [updated] = await db
          .update(users)
          .set({ email: lowered, passwordHash })
          .where(eq(users.id, req.user.sub))
          .returning();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === '23505') {
          // Same generic message as register so we don't leak which addresses
          // are already in use.
          return reply.code(409).send({ error: 'Email already registered' });
        }
        throw err;
      }
      if (!updated || !updated.email) {
        return reply.code(404).send({ error: 'Korisnik više ne postoji.' });
      }
      const userEmail = updated.email;
      try {
        const rawToken = await createVerificationToken(updated.id);
        const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
        await sendVerificationEmail({ to: userEmail, displayName: updated.displayName, verifyUrl });
      } catch (err) {
        req.log.error({ err, email: userEmail }, 'failed to send verification email at upgrade time');
      }
      return {
        ok: true,
        email: userEmail,
        message: 'Poslali smo vam email sa linkom za potvrdu.',
      };
    },
  );
}

// --- Global guest-signup throttle ---
// Per-IP rate limit already caps a single attacker, but a botnet across many
// IPs could still spike the user table. This adds a small in-process token
// bucket: a hard ceiling on guest signups per hour across the whole process.
// Lives in-memory; resets on restart, which is fine for an aggregator-style
// defence.
const GUEST_SIGNUP_HOURLY_CAP = 200;
let guestBucket = { windowStart: Date.now(), count: 0 };
function consumeGuestSlot(): boolean {
  const now = Date.now();
  if (now - guestBucket.windowStart >= 60 * 60 * 1000) {
    guestBucket = { windowStart: now, count: 0 };
  }
  if (guestBucket.count >= GUEST_SIGNUP_HOURLY_CAP) return false;
  guestBucket.count++;
  return true;
}
