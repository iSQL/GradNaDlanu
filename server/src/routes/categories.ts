import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { categories } from '../db/schema.js';

export async function categoriesRoutes(app: FastifyInstance) {
  app.get('/api/categories', async () => {
    return db.select().from(categories);
  });
}
