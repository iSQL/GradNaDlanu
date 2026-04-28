import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { env } from './env.js';
import { categoriesRoutes } from './routes/categories.js';
import { locationsRoutes } from './routes/locations.js';
import { authRoutes } from './routes/auth.js';
import { socialRoutes } from './routes/social.js';
import { reservationsRoutes } from './routes/reservations.js';
import { ownerRoutes } from './routes/owner.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { objectMapsRoutes } from './routes/object-maps.js';
import { runMigrations } from './db/migrate.js';
import { runSeed } from './db/seed.js';

// Resolve web/dist relative to this file at runtime.
// Layout in the docker image: /app/web/dist + /app/server/dist/index.js
// Layout in source dev:        web/dist (after `npm run build`) + server/src/index.ts
function findWebDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../web/dist'),       // compiled: server/dist → ../../web/dist
    resolve(here, '../../../web/dist'),    // dev: server/src → ../../../web/dist
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

async function main() {
  const app = Fastify({ logger: true });

  if (env.runMigrationsOnBoot) {
    app.log.info('Running migrations…');
    await runMigrations();
    app.log.info('Migrations applied.');
  }
  if (env.runSeedOnBoot) {
    app.log.info('Running seed…');
    const result = await runSeed();
    app.log.info({ result }, 'Seed applied.');
  }

  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  await app.register(jwt, { secret: env.jwtSecret });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(categoriesRoutes);
  await app.register(locationsRoutes);
  await app.register(authRoutes);
  await app.register(socialRoutes);
  await app.register(reservationsRoutes);
  await app.register(ownerRoutes);
  await app.register(adminUsersRoutes);
  await app.register(objectMapsRoutes);

  // Static asset serving — production. In dev, the Vite dev server handles this on :5173
  // and proxies /api/* to us, so the directory simply won't exist and we skip registration.
  const webDist = findWebDist();
  if (webDist) {
    app.log.info({ webDist }, 'Serving SPA from web/dist');
    await app.register(fastifyStatic, { root: webDist, prefix: '/' });
    // Fallback for client-side routes — anything that isn't /api/* gets index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.log.info('web/dist not found — running API-only (dev mode).');
  }

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
