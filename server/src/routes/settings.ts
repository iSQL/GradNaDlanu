import type { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth.js';
import {
  guestsCanBook,
  guestsCanPostAds,
  isRegistrationEnabled,
  setGuestsCanBook,
  setGuestsCanPostAds,
  setRegistrationEnabled,
} from '../lib/settings.js';

async function readSettings() {
  const [registrationEnabled, guestsCanBookValue, guestsCanPostAdsValue] = await Promise.all([
    isRegistrationEnabled(),
    guestsCanBook(),
    guestsCanPostAds(),
  ]);
  return {
    registrationEnabled,
    guestsCanBook: guestsCanBookValue,
    guestsCanPostAds: guestsCanPostAdsValue,
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => readSettings());

  app.patch<{
    Body: { registrationEnabled?: unknown; guestsCanBook?: unknown; guestsCanPostAds?: unknown };
  }>(
    '/api/admin/settings',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const body = req.body ?? {};
      const reg = body.registrationEnabled;
      const guests = body.guestsCanBook;
      const guestsAds = body.guestsCanPostAds;
      if (reg !== undefined && typeof reg !== 'boolean') {
        return reply.code(400).send({ error: 'registrationEnabled must be a boolean' });
      }
      if (guests !== undefined && typeof guests !== 'boolean') {
        return reply.code(400).send({ error: 'guestsCanBook must be a boolean' });
      }
      if (guestsAds !== undefined && typeof guestsAds !== 'boolean') {
        return reply.code(400).send({ error: 'guestsCanPostAds must be a boolean' });
      }
      if (reg === undefined && guests === undefined && guestsAds === undefined) {
        return reply.code(400).send({ error: 'nothing to update' });
      }
      if (typeof reg === 'boolean') await setRegistrationEnabled(reg);
      if (typeof guests === 'boolean') await setGuestsCanBook(guests);
      if (typeof guestsAds === 'boolean') await setGuestsCanPostAds(guestsAds);
      return readSettings();
    },
  );
}
