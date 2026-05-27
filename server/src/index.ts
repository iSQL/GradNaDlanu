import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
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
import { mediaRoutes } from './routes/media.js';
import { eventsRoutes } from './routes/events.js';
import { serviceRequestsRoutes } from './routes/service-requests.js';
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
  const app = Fastify({ logger: true, trustProxy: env.isProduction });

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

  // Security headers. CSP allows the Esri tile CDNs the map needs, plus inline
  // styles for Leaflet's marker shadow CSS and SVG-as-img tiles.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Cloudflare Web Analytics — injected automatically by Cloudflare in
          // front of the app. Drop this entry if you disable CF Analytics.
          'https://static.cloudflareinsights.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          // Esri serves World Imagery tiles from server.arcgisonline.com but
          // some regions / load-balanced responses redirect to other arcgis
          // subdomains; allow the umbrella so tiles never silently fail.
          'https://*.arcgisonline.com',
          'https://*.arcgis.com',
        ],
        connectSrc: [
          "'self'",
          // Cloudflare beacon POSTs back to here.
          'https://cloudflareinsights.com',
        ],
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
        ],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Esri tiles set no CORP header
    strictTransportSecurity: env.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
  });

  // Global rate limit — cheap defense against floods. Per-route hooks below
  // tighten this further on auth and upload endpoints.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  });

  // CORS: in production this is `false` unless an operator explicitly opts in
  // with a single concrete https:// origin (validated in env.ts). The SPA is
  // served same-origin in production, so CORS shouldn't be needed at all.
  // `credentials: true` is removed — we use Bearer tokens, not cookies.
  if (env.corsOrigin !== false) {
    await app.register(cors, { origin: env.corsOrigin });
  }

  await app.register(jwt, { secret: env.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(categoriesRoutes);
  await app.register(locationsRoutes);
  await app.register(authRoutes);
  await app.register(socialRoutes);
  await app.register(reservationsRoutes);
  await app.register(ownerRoutes);
  await app.register(adminUsersRoutes);
  await app.register(objectMapsRoutes);
  await app.register(mediaRoutes);
  await app.register(eventsRoutes);
  await app.register(serviceRequestsRoutes);

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
