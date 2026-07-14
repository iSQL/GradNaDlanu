import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { pino, multistream, type StreamEntry } from 'pino';
import { env } from './env.js';
import { createRollingFileStream } from './lib/rolling-log.js';
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
import { uslugeRoutes } from './routes/usluge.js';
import { settingsRoutes } from './routes/settings.js';
import { newsRoutes } from './routes/news.js';
import { newsletterRoutes } from './routes/newsletter.js';
import { alumniRoutes } from './routes/alumni.js';
import { villagesRoutes } from './routes/villages.js';
import { curatorRoutes } from './routes/curator.js';
import { oglasiRoutes } from './routes/oglasi.js';
import { problemiRoutes } from './routes/problemi.js';
import { biseriRoutes } from './routes/biseri.js';
import { conversationsRoutes } from './routes/conversations.js';
import { notificationsRoutes } from './routes/notifications.js';
import { startGuestCleanup } from './lib/guest-cleanup.js';
import { startDesavanjaCleanup } from './lib/desavanja-cleanup.js';
import { startOglasiCleanup } from './lib/oglasi-cleanup.js';
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

// Multistream logger: stdout (so Coolify's UI keeps working) + rolling daily
// file at ${LOG_DIR}/zabariYYYY-MM-DD.log with N-day retention. If the file
// stream can't be opened (perms/missing volume), we degrade to stdout-only
// and surface a one-line warning rather than refusing to boot.
function buildLogger(): FastifyBaseLogger {
  const streams: StreamEntry[] = [{ stream: process.stdout }];
  try {
    const file = createRollingFileStream({
      dir: env.logDir,
      prefix: 'zabari',
      retentionDays: env.logRetentionDays,
    });
    streams.push({ stream: file });
  } catch (err) {
    console.warn(
      `[log] file logging disabled (${env.logDir}): ${(err as Error).message}`,
    );
  }
  // pino's typed Logger doesn't satisfy Fastify's FastifyBaseLogger (missing
  // `msgPrefix` in the public type), but the instance does carry all the
  // methods Fastify uses at runtime.
  return pino(
    { level: env.isProduction ? 'info' : 'debug' },
    multistream(streams),
  ) as unknown as FastifyBaseLogger;
}

async function main() {
  // Fastify 5 splits the option: `logger` takes a config/boolean, while
  // `loggerInstance` takes a pre-built logger (our pino + multistream).
  // `disableRequestLogging` turns off the default per-request lines so we can
  // emit them ourselves and skip high-volume / low-value paths (see hook below).
  const app = Fastify({
    loggerInstance: buildLogger(),
    trustProxy: env.isProduction,
    disableRequestLogging: true,
  });

  // Mirror Fastify's default request logging, minus the paths that flood the
  // log without earning their keep: the health check (polled by Coolify) and
  // anything served as a static asset out of web/dist. Errors and explicit
  // `req.log.*` calls inside route handlers still surface normally.
  const skipLogExact = new Set(['/api/health', '/favicon.ico', '/robots.txt']);
  const skipLogPrefixes = ['/assets/'];
  const skipLogExts = /\.(?:js|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i;
  function shouldSkipLog(url: string): boolean {
    const path = url.split('?', 1)[0];
    if (skipLogExact.has(path)) return true;
    for (const p of skipLogPrefixes) if (path.startsWith(p)) return true;
    return skipLogExts.test(path);
  }
  app.addHook('onRequest', (req, _reply, done) => {
    if (!shouldSkipLog(req.url)) {
      req.log.info(
        {
          req: {
            method: req.method,
            url: req.url,
            host: req.headers.host,
            remoteAddress: req.ip,
            remotePort: req.socket.remotePort,
          },
        },
        'incoming request',
      );
    }
    done();
  });
  app.addHook('onResponse', (req, reply, done) => {
    if (!shouldSkipLog(req.url)) {
      req.log.info(
        { res: { statusCode: reply.statusCode }, responseTime: reply.elapsedTime },
        'request completed',
      );
    }
    done();
  });

  // Cache policy at the application layer so CDN/browser/intermediate proxies
  // get an explicit signal regardless of CDN-side rules.
  //   /api/*    → no-store. Avoids stale auth data, stale availability windows
  //              (reservations), and stale owner-edited content. Cost is
  //              negligible for this site's traffic profile.
  //   /assets/* → immutable, 1 year. Vite hashes the filename on every build, so
  //              old URLs are physically replaced — safe to cache forever.
  // Index.html and everything else: leave headers alone, CDN/browser defaults apply.
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      // /api/media/* sets its own Cache-Control per kind (public for ad/alumni
      // photos, private for the rest) — onSend runs after the handler, so a
      // blanket no-store here would clobber it and force every image to be
      // re-downloaded on each page view.
      if (!req.url.startsWith('/api/media/')) {
        reply.header('Cache-Control', 'no-store');
      }
    } else if (req.url.startsWith('/assets/')) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    }
  });
  app.log.info(
    { logDir: env.logDir, retentionDays: env.logRetentionDays },
    'Rolling file logger initialized',
  );

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
          // front of the app. Drop these two entries if you disable CF Analytics.
          // The sha256 covers the inline init snippet Cloudflare injects ahead of
          // the external beacon.js — if CF rotates the snippet, the browser
          // console will print the new hash; paste it here verbatim.
          'https://static.cloudflareinsights.com',
          "'sha256-AAQ0bLohq1NPfCZlO86bgOBHB9YIM7lOruWG2t/5xWM='",
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

  // Health check, polled by Coolify's Docker healthcheck.
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
  await app.register(uslugeRoutes);
  await app.register(settingsRoutes);
  await app.register(newsRoutes);
  await app.register(newsletterRoutes);
  await app.register(alumniRoutes);
  await app.register(villagesRoutes);
  await app.register(curatorRoutes);
  await app.register(oglasiRoutes);
  await app.register(problemiRoutes);
  await app.register(biseriRoutes);
  await app.register(conversationsRoutes);
  await app.register(notificationsRoutes);

  // Daily sweep: deletes guest accounts inactive for >7 days, CASCADE clears
  // their favorites/comments/checkins along with the row.
  startGuestCleanup(app);

  // Daily sweep: deletes news/events older than 30 days.
  startDesavanjaCleanup(app);

  // Daily sweep: soft-deletes (archives) ads not refreshed in >7 days.
  startOglasiCleanup(app);

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
