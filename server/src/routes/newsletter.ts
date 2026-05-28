import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { newsletterSubscribers } from '../db/schema.js';

// Conservative email shape check — full RFC validation belongs in the verifier
// (e.g. Resend-side double opt-in), this just rejects obviously-malformed input.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function newsletterRoutes(app: FastifyInstance) {
  app.post<{ Body: { email?: unknown } }>(
    '/api/newsletter/subscribe',
    {
      // Tighter than the global limit — newsletter sign-up is a public unauthed
      // POST, easy enumeration target without per-IP throttling.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const raw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!raw || raw.length > 254 || !EMAIL_RE.test(raw)) {
        return reply.code(400).send({ error: 'Neispravna email adresa' });
      }
      // ON CONFLICT DO NOTHING — return success for duplicates to avoid leaking
      // whether the address is already registered.
      await db
        .insert(newsletterSubscribers)
        .values({ email: raw })
        .onConflictDoNothing({ target: newsletterSubscribers.email });
      return { ok: true };
    },
  );
}
