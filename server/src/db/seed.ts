import bcrypt from 'bcryptjs';
import { db, sql } from './client.js';
import { categories, locations, moduleContent, users } from './schema.js';
import { CATEGORIES, LOCATIONS, buildModuleContent } from './seed-data.js';
import { env } from '../env.js';

async function main() {
  // Categories
  await db
    .insert(categories)
    .values(CATEGORIES.map((c) => ({ id: c.id, label: c.label, short: c.short, color: c.color })))
    .onConflictDoNothing();

  // Locations + module content
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

    if (!row) continue; // already seeded
    locCount++;

    const content = buildModuleContent(loc.slug, loc.catId);
    await db
      .insert(moduleContent)
      .values({ locationId: row.id, content })
      .onConflictDoNothing();
    modCount++;
  }

  // Admin user.
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

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${locCount} locations, ${modCount} module_content rows, ${insertedUser.length} admin user (email: ${adminEmail}).`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
