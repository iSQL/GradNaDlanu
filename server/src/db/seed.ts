import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema.js';
import { comments, events, locations, moduleContent, news, users } from './schema.js';
import { CATEGORIES, COMMENTS, EVENTS, LOCATIONS, NEWS, USERS, buildModuleContent } from './seed-data.js';
import { env } from '../env.js';

export interface SeedResult {
  categoryCount: number;
  locationCount: number;
  moduleContentCount: number;
  eventCount: number;
  newsCount: number;
  userCount: number;
  commentCount: number;
  adminInserted: boolean;
  adminEmail: string;
}

// Idempotent seed — safe to call on every boot or as a one-shot CLI command.
// Uses its own short-lived connection.
export async function runSeed(): Promise<SeedResult> {
  const sql = postgres(env.databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    // Categories are inserted by migrate.ts on every boot — see comment there.
    // The seed only owns starter locations + admin user + events.

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

    // users.email lives behind a PARTIAL unique index (WHERE email IS NOT NULL)
    // so guests can have a NULL email. Postgres won't infer that index from a
    // bare ON CONFLICT (email) → manual existence check keeps the seed idempotent.
    const adminEmail = `${env.adminUsername}@local`;
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    let insertedUser: { id: number }[] = [];
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(env.adminPassword, 12);
      insertedUser = await db
        .insert(users)
        .values({
          email: adminEmail,
          passwordHash,
          displayName: env.adminUsername,
          role: 'admin',
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
    }

    // Seed news. Requires the admin row to exist (authorId is NOT NULL); resolve
    // it via either the freshly inserted row or the existing one. Idempotent —
    // skips rows whose globally-unique slug is already present.
    const adminId = insertedUser[0]?.id ?? existingAdmin?.id;
    let newsCount = 0;
    if (adminId) {
      for (const n of NEWS) {
        const [loc] = await db
          .select({ id: locations.id })
          .from(locations)
          .where(eq(locations.slug, n.locationSlug))
          .limit(1);
        if (!loc) continue;
        const [existing] = await db
          .select({ id: news.id })
          .from(news)
          .where(eq(news.slug, n.slug))
          .limit(1);
        if (existing) continue;
        await db.insert(news).values({
          locationId: loc.id,
          authorId: adminId,
          title: n.title,
          slug: n.slug,
          body: n.body,
          status: 'published',
          publishedAt: new Date(n.publishedAt),
        });
        newsCount++;
      }
    }

    // Demo visitor accounts + their comments. Visitor accounts populate the
    // "Najnoviji utisci" homepage row and per-location comment threads. Idempotent
    // on (users.email) and (userId, locationId, body).
    let userCount = 0;
    const userIdByEmail = new Map<string, number>();
    for (const u of USERS) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);
      if (existing) {
        userIdByEmail.set(u.email, existing.id);
        continue;
      }
      const passwordHash = await bcrypt.hash(u.password, 12);
      const [inserted] = await db
        .insert(users)
        .values({
          email: u.email,
          passwordHash,
          displayName: u.displayName,
          role: 'user',
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
      if (inserted) {
        userIdByEmail.set(u.email, inserted.id);
        userCount++;
      }
    }

    let commentCount = 0;
    for (const c of COMMENTS) {
      const userId = userIdByEmail.get(c.authorEmail);
      if (!userId) continue;
      const [loc] = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.slug, c.locationSlug))
        .limit(1);
      if (!loc) continue;
      const [existing] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(and(
          eq(comments.userId, userId),
          eq(comments.locationId, loc.id),
          eq(comments.body, c.body),
        ))
        .limit(1);
      if (existing) continue;
      await db.insert(comments).values({
        userId,
        locationId: loc.id,
        body: c.body,
        rating: c.rating ?? null,
        status: 'visible',
      });
      commentCount++;
    }

    return {
      categoryCount: CATEGORIES.length,
      locationCount: locCount,
      moduleContentCount: modCount,
      eventCount,
      newsCount,
      userCount,
      commentCount,
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
        `Seeded ${r.categoryCount} categories, ${r.locationCount} locations, ${r.moduleContentCount} module_content rows, ${r.eventCount} events, ${r.newsCount} news, ${r.userCount} demo users, ${r.commentCount} comments, ${r.adminInserted ? 1 : 0} admin user (email: ${r.adminEmail}).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
