import type { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth.js';
import { isRegistrationEnabled, setRegistrationEnabled } from '../lib/settings.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => {
    const registrationEnabled = await isRegistrationEnabled();
    return { registrationEnabled };
  });

  app.patch<{ Body: { registrationEnabled?: unknown } }>(
    '/api/admin/settings',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const next = req.body?.registrationEnabled;
      if (typeof next !== 'boolean') {
        return reply.code(400).send({ error: 'registrationEnabled (boolean) required' });
      }
      await setRegistrationEnabled(next);
      return { registrationEnabled: next };
    },
  );
}
