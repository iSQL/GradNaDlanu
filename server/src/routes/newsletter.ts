import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import {
  confirmByToken,
  defaultPrefs,
  getByEmail,
  getByToken,
  listConfirmedForCategory,
  setPrefsByToken,
  subscriberCounts,
  unsubscribeByToken,
  upsertSubscriber,
  type NewsletterCategory,
  type NewsletterPrefs,
} from '../lib/newsletter.js';
import { sendNewsletterConfirmEmail, sendNewsletterEmail } from '../lib/email.js';

// Conservative email shape check — full RFC validation belongs in the verifier
// (double opt-in), this just rejects obviously-malformed input.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES: NewsletterCategory[] = ['desavanja', 'poruke', 'marketing'];

function coercePrefs(raw: unknown): NewsletterPrefs {
  const base = defaultPrefs();
  if (raw && typeof raw === 'object') {
    const p = raw as Record<string, unknown>;
    return {
      desavanja: typeof p.desavanja === 'boolean' ? p.desavanja : base.desavanja,
      poruke: typeof p.poruke === 'boolean' ? p.poruke : base.poruke,
      marketing: typeof p.marketing === 'boolean' ? p.marketing : base.marketing,
    };
  }
  return base;
}

function confirmUrl(token: string): string {
  return `${env.appUrl}/newsletter/potvrda?token=${encodeURIComponent(token)}`;
}
function manageUrl(token: string): string {
  return `${env.appUrl}/newsletter/podesavanja?token=${encodeURIComponent(token)}`;
}
function unsubscribeUrl(token: string): string {
  return `${env.appUrl}/newsletter/podesavanja?token=${encodeURIComponent(token)}&odjava=1`;
}

export async function newsletterRoutes(app: FastifyInstance) {
  // ── Public: footer sign-up (double opt-in) ───────────────────────────────
  app.post<{ Body: { email?: unknown; prefs?: unknown; consent?: unknown } }>(
    '/api/newsletter/subscribe',
    {
      // Tighter than the global limit — public unauthed POST, easy enumeration
      // target without per-IP throttling.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const raw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!raw || raw.length > 254 || !EMAIL_RE.test(raw)) {
        return reply.code(400).send({ error: 'Neispravna email adresa' });
      }
      if (req.body?.consent !== true) {
        return reply.code(400).send({ error: 'Potrebna je saglasnost za prijavu na bilten.' });
      }
      const prefs = coercePrefs(req.body?.prefs);

      // Already confirmed → don't resend and don't reveal membership; just succeed.
      const existing = await getByEmail(raw);
      if (existing && existing.status === 'confirmed') {
        return { ok: true };
      }

      const sub = await upsertSubscriber(raw, prefs, { autoConfirm: false });
      try {
        await sendNewsletterConfirmEmail({ to: sub.email, confirmUrl: confirmUrl(sub.token) });
      } catch (err) {
        req.log.error({ err, email: sub.email }, 'failed to send newsletter confirm email');
      }
      // Same generic shape regardless of prior state — never leaks whether the
      // address was already pending.
      return { ok: true };
    },
  );

  // ── Public: confirm double opt-in ────────────────────────────────────────
  app.post<{ Body: { token?: unknown } }>(
    '/api/newsletter/confirm',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!token) return reply.code(400).send({ error: 'token required' });
      const sub = await confirmByToken(token);
      if (!sub) return reply.code(400).send({ error: 'Link nije važeći.', code: 'invalid_token' });
      return { ok: true, email: sub.email, prefs: sub.prefs };
    },
  );

  // ── Public: unsubscribe by token (one-click friendly) ────────────────────
  app.post<{ Body: { token?: unknown } }>(
    '/api/newsletter/unsubscribe',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!token) return reply.code(400).send({ error: 'token required' });
      const sub = await unsubscribeByToken(token);
      if (!sub) return reply.code(400).send({ error: 'Link nije važeći.', code: 'invalid_token' });
      return { ok: true };
    },
  );

  // ── Public: read / update preferences by token (anonymous manage page) ────
  app.get<{ Querystring: { token?: string } }>('/api/newsletter/prefs', async (req, reply) => {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const sub = token ? await getByToken(token) : null;
    if (!sub) return reply.code(404).send({ error: 'Link nije važeći.', code: 'invalid_token' });
    return { email: sub.email, status: sub.status, prefs: sub.prefs };
  });

  app.post<{ Body: { token?: unknown; prefs?: unknown } }>(
    '/api/newsletter/prefs',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!token) return reply.code(400).send({ error: 'token required' });
      const current = await getByToken(token);
      if (!current) return reply.code(404).send({ error: 'Link nije važeći.', code: 'invalid_token' });
      const sub = await setPrefsByToken(token, coercePrefs(req.body?.prefs));
      return { ok: true, prefs: sub?.prefs };
    },
  );

  // ── Authenticated: manage own subscription via "Moj prostor" ─────────────
  // Keyed by the user's already-verified email → auto-confirmed (no double opt-in).
  app.get('/api/me/newsletter', { preHandler: requireAuth }, async (req) => {
    const email = req.user.email;
    if (!email) return { subscribed: false, prefs: defaultPrefs() };
    const sub = await getByEmail(email);
    if (!sub || sub.status !== 'confirmed') {
      return { subscribed: false, prefs: sub?.prefs ?? defaultPrefs() };
    }
    return { subscribed: true, prefs: sub.prefs };
  });

  app.put<{ Body: { subscribed?: unknown; prefs?: unknown } }>(
    '/api/me/newsletter',
    { preHandler: requireAuth },
    async (req, reply) => {
      const email = req.user.email;
      if (!email) {
        return reply.code(400).send({ error: 'Nalog nema potvrđenu e-poštu.', code: 'no_email' });
      }
      const subscribed = req.body?.subscribed === true;
      const prefs = coercePrefs(req.body?.prefs);
      if (!subscribed) {
        const existing = await getByEmail(email);
        if (existing) await unsubscribeByToken(existing.token);
        return { subscribed: false, prefs };
      }
      const sub = await upsertSubscriber(email, prefs, {
        autoConfirm: true,
        userId: req.user.sub,
      });
      return { subscribed: true, prefs: sub.prefs };
    },
  );

  // ── Admin: subscriber counts + manual send ───────────────────────────────
  app.get(
    '/api/admin/newsletter/subscribers',
    { preHandler: requireRole('admin') },
    async () => {
      return { counts: await subscriberCounts() };
    },
  );

  app.post<{ Body: { category?: unknown; subject?: unknown; bodyText?: unknown } }>(
    '/api/admin/newsletter/send',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const category = req.body?.category;
      const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
      const bodyText = typeof req.body?.bodyText === 'string' ? req.body.bodyText.trim() : '';
      if (!CATEGORIES.includes(category as NewsletterCategory)) {
        return reply.code(400).send({ error: 'Nepoznata kategorija.' });
      }
      if (!subject || !bodyText) {
        return reply.code(400).send({ error: 'Naslov i telo poruke su obavezni.' });
      }
      const recipients = await listConfirmedForCategory(category as NewsletterCategory);
      let sent = 0;
      let failed = 0;
      for (const r of recipients) {
        try {
          await sendNewsletterEmail({
            to: r.email,
            subject,
            bodyText,
            manageUrl: manageUrl(r.token),
            unsubscribeUrl: unsubscribeUrl(r.token),
          });
          sent++;
        } catch (err) {
          failed++;
          req.log.error({ err, email: r.email }, 'failed to send newsletter email');
        }
      }
      req.log.info({ category, subject, sent, failed }, 'newsletter blast sent');
      return { ok: true, sent, failed, total: recipients.length };
    },
  );
}
