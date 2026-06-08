import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, villageCurators, villages } from '../db/schema.js';

// Javna ruta za /naselja stranicu. Vraća statičke fakte iz
// `villages` tabele plus, za svako selo, niz kustosa ({ id, displayName }).
// Email se NE vraća javno (privacy).
export async function villagesRoutes(app: FastifyInstance) {
  app.get('/api/villages', async () => {
    const rows = await db.select().from(villages).orderBy(asc(villages.name));

    const curatorRows = await db
      .select({
        villageName: villageCurators.villageName,
        userId: users.id,
        displayName: users.displayName,
      })
      .from(villageCurators)
      .innerJoin(users, eq(villageCurators.userId, users.id));

    const byVillage = new Map<string, Array<{ id: number; displayName: string }>>();
    for (const c of curatorRows) {
      const arr = byVillage.get(c.villageName) ?? [];
      arr.push({ id: c.userId, displayName: c.displayName });
      byVillage.set(c.villageName, arr);
    }

    return rows.map((r) => ({
      name: r.name,
      populationCensus2002: r.populationCensus2002,
      populationCensus2022: r.populationCensus2022,
      // NUMERIC stupci dolaze kao string iz postgres-js — pretvaramo u Number
      // za JSON klijent (tačke u CSS-u ne radi sa string vrednostima).
      areaKm2: r.areaKm2 !== null ? Number(r.areaKm2) : null,
      distanceKm: r.distanceKm !== null ? Number(r.distanceKm) : null,
      direction: r.direction,
      lat: r.lat !== null ? Number(r.lat) : null,
      lon: r.lon !== null ? Number(r.lon) : null,
      isSeat: r.isSeat,
      story: r.story,
      curators: byVillage.get(r.name) ?? [],
    }));
  });
}
