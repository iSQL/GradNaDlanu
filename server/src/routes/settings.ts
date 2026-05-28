import type { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth.js';
import {
  guestsCanBook,
  isRegistrationEnabled,
  setGuestsCanBook,
  setRegistrationEnabled,
} from '../lib/settings.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => {
    const [registrationEnabled, guestsCanBookValue] = await Promise.all([
      isRegistrationEnabled(),
      guestsCanBook(),
    ]);
    return { registrationEnabled, guestsCanBook: guestsCanBookValue };
  });

  app.patch<{
    Body: { registrationEnabled?: unknown; guestsCanBook?: unknown };
  }>(
    '/api/admin/settings',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const body = req.body ?? {};
      const reg = body.registrationEnabled;
      const guests = body.guestsCanBook;
      if (reg !== undefined && typeof reg !== 'boolean') {
        return reply.code(400).send({ error: 'registrationEnabled must be a boolean' });
      }
      if (guests !== undefined && typeof guests !== 'boolean') {
        return reply.code(400).send({ error: 'guestsCanBook must be a boolean' });
      }
      if (reg === undefined && guests === undefined) {
        return reply.code(400).send({ error: 'nothing to update' });
      }
      if (typeof reg === 'boolean') await setRegistrationEnabled(reg);
      if (typeof guests === 'boolean') await setGuestsCanBook(guests);
      const [registrationEnabled, guestsCanBookValue] = await Promise.all([
        isRegistrationEnabled(),
        guestsCanBook(),
      ]);
      return { registrationEnabled, guestsCanBook: guestsCanBookValue };
    },
  );
}
