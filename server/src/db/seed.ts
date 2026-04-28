import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { categories, locations, moduleContent, users } from './schema.js';
import { CATEGORIES, LOCATIONS, buildModuleContent } from './seed-data.js';
import { env } from '../env.js';

export interface SeedResult {
  categoryCount: number;
  locationCount: number;
  moduleContentCount: number;
  adminInserted: boolean;
  adminEmail: string;
}

// Idempotent seed — safe to call on every boot or as a one-shot CLI command.
// Uses its own short-lived connection.
export async function runSeed(): Promise<SeedResult> {
  const sql = postgres(env.databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    await db
      .insert(categories)
      .values(CATEGORIES.map((c) => ({ id: c.id, label: c.label, short: c.short, color: c.color })))
      .onConflictDoNothing();

    let locCount = 0;
    let modCount = 0;
    for (const loc of LOCATIONS) {
      const [row] = await db
        .insert(locations)
        .values({
          slug: loc.slug,
          catId: loc.catId,
          name: loc.name,
          subtitle: loc.subtitle,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng,
          status: 'published',
        })
        .onConflictDoNothing({ target: locations.slug })
        .returning({ id: locations.id });

      if (!row) continue;
      locCount++;

      const content = buildModuleContent(loc.slug, loc.catId);
      await db
        .insert(moduleContent)
        .values({ locationId: row.id, content })
        .onConflictDoNothing();
      modCount++;
    }

    const passwordHash = await bcrypt.hash(env.adminPassword, 10);
    const adminEmail = `${env.adminUsername}@local`;
    const insertedUser = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        displayName: env.adminUsername,
        role: 'admin',
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    return {
      categoryCount: CATEGORIES.length,
      locationCount: locCount,
      moduleContentCount: modCount,
      adminInserted: insertedUser.length > 0,
      adminEmail,
    };
  } finally {
    await sql.end();
  }
}

const isCli = import.meta.url === `file://${process.argv[1]}`
           || process.argv[1]?.endsWith('seed.js')
           || process.argv[1]?.endsWith('seed.ts');
if (isCli) {
  runSeed()
    .then((r) => {
      console.log(
        `Seeded ${r.categoryCount} categories, ${r.locationCount} locations, ${r.moduleContentCount} module_content rows, ${r.adminInserted ? 1 : 0} admin user (email: ${r.adminEmail}).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
