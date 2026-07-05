import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema.js';
import { alumni, comments, events, locations, majstorCategories, moduleContent, news, serviceJobs, serviceOffers, users, villages } from './schema.js';
import { ALUMNI, CATEGORIES, COMMENTS, EVENTS, LOCATIONS, MAJSTORI, MAJSTOR_REVIEWS, NEWS, USERS, VILLAGES, buildModuleContent } from './seed-data.js';
import { env } from '../env.js';

export interface SeedResult {
  categoryCount: number;
  locationCount: number;
  moduleContentCount: number;
  eventCount: number;
  newsCount: number;
  userCount: number;
  majstorCount: number;
  majstorReviewCount: number;
  commentCount: number;
  alumniCount: number;
  villageCount: number;
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

    // Demo majstori za "Usluge": nalog sa rolom 'majstor' + grantovi kategorija.
    // Idempotentno na (users.email) i PK (user_id, category_id).
    let majstorCount = 0;
    for (const m of MAJSTORI) {
      let [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, m.email))
        .limit(1);
      if (!row) {
        const passwordHash = await bcrypt.hash(m.password, 12);
        [row] = await db
          .insert(users)
          .values({
            email: m.email,
            passwordHash,
            displayName: m.displayName,
            role: 'majstor',
            emailVerifiedAt: new Date(),
          })
          .returning({ id: users.id });
        if (row) majstorCount++;
      }
      if (!row) continue;
      for (const categoryId of m.categories) {
        await db
          .insert(majstorCategories)
          .values({ userId: row.id, categoryId })
          .onConflictDoNothing();
      }
    }

    // Demo ocene majstora: završen service_job + prihvaćena ocenjena ponuda po
    // stavci — hrani metrike (avgRating/completedJobs/avgResponseMinutes) i
    // recenzije na /majstori. Idempotentno na (naručilac, kategorija, opis
    // kvara) — nema unique constrainta, pa se postojanje proverava ručno.
    let majstorReviewCount = 0;
    for (const r of MAJSTOR_REVIEWS) {
      const reviewerId = userIdByEmail.get(r.reviewerEmail);
      if (!reviewerId) continue;
      const [majstor] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, r.majstorEmail))
        .limit(1);
      if (!majstor) continue;

      const existing = await db
        .select({ payload: serviceJobs.payload })
        .from(serviceJobs)
        .where(and(eq(serviceJobs.userId, reviewerId), eq(serviceJobs.categoryId, r.categoryId)));
      if (existing.some((j) => (j.payload as { description?: string }).description === r.description)) {
        continue;
      }

      // Vremena raspršena unazad: zahtev → ponuda (responseMinutes) → završeno
      // sutradan → ocena par sati kasnije. Sve u prošlosti, deluje prirodno.
      const createdAt = new Date(Date.now() - r.daysAgo * 86_400_000);
      const offerAt = new Date(createdAt.getTime() + r.responseMinutes * 60_000);
      const completedAt = new Date(createdAt.getTime() + 86_400_000);
      const ratedAt = new Date(completedAt.getTime() + 3 * 3_600_000);

      const [job] = await db
        .insert(serviceJobs)
        .values({
          userId: reviewerId,
          categoryId: r.categoryId,
          payload: { description: r.description, photoIds: [] },
          targetUserIds: null,
          status: 'completed',
          createdAt,
          completedAt,
          completedBy: majstor.id,
        })
        .returning({ id: serviceJobs.id });
      if (!job) continue;
      const [offer] = await db
        .insert(serviceOffers)
        .values({
          jobId: job.id,
          majstorUserId: majstor.id,
          quote: { priceRsd: r.priceRsd, note: '', availableDate: offerAt.toISOString().slice(0, 10) },
          status: 'accepted',
          createdAt: offerAt,
          updatedAt: completedAt,
          ratingStars: r.stars,
          ratingComment: r.comment,
          ratedAt,
        })
        .returning({ id: serviceOffers.id });
      if (!offer) continue;
      await db
        .update(serviceJobs)
        .set({ acceptedOfferId: offer.id })
        .where(eq(serviceJobs.id, job.id));
      majstorReviewCount++;
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

    // Demo alumni — populates the school's Alumni tab. Idempotent on
    // (locationId, fullName, graduationYear). Skips silently if the alumni
    // table doesn't exist yet (e.g. running an older migration locally).
    let alumniCount = 0;
    for (const a of ALUMNI) {
      const [loc] = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.slug, a.schoolSlug))
        .limit(1);
      if (!loc) continue;
      const [existing] = await db
        .select({ id: alumni.id })
        .from(alumni)
        .where(and(
          eq(alumni.locationId, loc.id),
          eq(alumni.fullName, a.fullName),
          eq(alumni.graduationYear, a.graduationYear),
        ))
        .limit(1);
      if (existing) continue;
      await db.insert(alumni).values({
        locationId: loc.id,
        fullName: a.fullName,
        graduationYear: a.graduationYear,
        homeroomTeacher: a.homeroomTeacher,
        motto: a.motto,
        email: a.email ?? null,
      });
      alumniCount++;
    }

    // Naselja — statički fakti za /naselja stranicu. ON CONFLICT DO NOTHING
    // znači da admin/kustos edit kroz UI (jednom kad uvedemo PATCH) preživljava
    // ponovne seedove.
    let villageCount = 0;
    for (const v of VILLAGES) {
      const [row] = await db
        .insert(villages)
        .values({
          name: v.name,
          populationCensus2002: v.populationCensus2002,
          populationCensus2022: v.populationCensus2022,
          areaKm2: String(v.areaKm2),
          distanceKm: String(v.distanceKm),
          direction: v.direction,
          lat: String(v.lat),
          lon: String(v.lon),
          isSeat: v.isSeat,
        })
        .onConflictDoNothing({ target: villages.name })
        .returning({ name: villages.name });
      if (row) villageCount++;
    }

    return {
      categoryCount: CATEGORIES.length,
      locationCount: locCount,
      moduleContentCount: modCount,
      eventCount,
      newsCount,
      userCount,
      majstorCount,
      majstorReviewCount,
      commentCount,
      alumniCount,
      villageCount,
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
        `Seeded ${r.categoryCount} categories, ${r.locationCount} locations, ${r.moduleContentCount} module_content rows, ${r.eventCount} events, ${r.newsCount} news, ${r.userCount} demo users, ${r.majstorCount} demo majstora, ${r.majstorReviewCount} majstor reviews, ${r.commentCount} comments, ${r.alumniCount} alumni, ${r.villageCount} villages, ${r.adminInserted ? 1 : 0} admin user (email: ${r.adminEmail}).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
