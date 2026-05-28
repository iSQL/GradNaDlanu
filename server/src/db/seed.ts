import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema.js';
import { categories, events, locations, moduleContent, users } from './schema.js';
import { CATEGORIES, EVENTS, LOCATIONS, buildModuleContent } from './seed-data.js';
import { env } from '../env.js';

export interface SeedResult {
  categoryCount: number;
  locationCount: number;
  moduleContentCount: number;
  eventCount: number;
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

    // Match the cost used by the registration path (server/src/routes/auth.ts).
    // env.ts already refuses weak/missing ADMIN_PASSWORD in production.
    // Idempotent event seed: skip an event if one with the same (locationId, title, startsAt)
    // already exists. No unique constraint on the table, so we look it up first.
    let eventCount = 0;
    for (const ev of EVENTS) {
      const [loc] = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.slug, ev.slug))
        .limit(1);
      if (!loc) continue;
      const startsAt = new Date(ev.startsAt);
      const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(and(
          eq(events.locationId, loc.id),
          eq(events.title, ev.title),
          eq(events.startsAt, startsAt),
        ))
        .limit(1);
      if (existing.length > 0) continue;
      await db.insert(events).values({
        locationId: loc.id,
        title: ev.title,
        description: ev.description ?? null,
        startsAt,
        endsAt: ev.endsAt ? new Date(ev.endsAt) : null,
        status: 'published',
      });
      eventCount++;
    }

    const passwordHash = await bcrypt.hash(env.adminPassword, 12);
    const adminEmail = `${env.adminUsername}@local`;
    const insertedUser = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        displayName: env.adminUsername,
        role: 'admin',
        emailVerifiedAt: new Date(),
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    return {
      categoryCount: CATEGORIES.length,
      locationCount: locCount,
      moduleContentCount: modCount,
      eventCount,
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
        `Seeded ${r.categoryCount} categories, ${r.locationCount} locations, ${r.moduleContentCount} module_content rows, ${r.eventCount} events, ${r.adminInserted ? 1 : 0} admin user (email: ${r.adminEmail}).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
