import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './env.js';
import { categoriesRoutes } from './routes/categories.js';
import { locationsRoutes } from './routes/locations.js';
import { authRoutes } from './routes/auth.js';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  await app.register(jwt, { secret: env.jwtSecret });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(categoriesRoutes);
  await app.register(locationsRoutes);
  await app.register(authRoutes);

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
