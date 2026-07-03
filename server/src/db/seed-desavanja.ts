import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { events, locations, news, users } from './schema.js';
import { env } from '../env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Demo seed for the "/desavanja" feed: obaveštenja (news) + događaji (events).
// Standalone + idempotent — always leaves exactly this demo set. Local/demo DB
// only. Events/news attach to existing published locations.
//
//   npm --workspace server run seed:desavanja           (local dev)
//   npm --workspace server run seed:desavanja:prod       (deployed container)
//
// Idempotency is keyed on a dedicated demo author user: the script deletes that
// author's news + events, then re-inserts. Real content is never touched.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_AUTHOR = { email: 'demo.redakcija@example.com', displayName: 'Demo redakcija' };
const DEMO_PASSWORD = 'demo1234';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/č|ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// startInDays: negative = past (still within the 30-day retention window).
const EVENTS: {
  slug: string;
  title: string;
  description: string;
  startInDays: number;
  durationHours?: number;
}[] = [
  { slug: 'opstina', title: 'Prolećni vašar u Žabarima', description: 'Tradicionalni vašar na centralnom trgu — štandovi, hrana i muzika.', startInDays: 3, durationHours: 8 },
  { slug: 'caffe-bar-magacin', title: 'Veče poezije', description: 'Otvoreni mikrofon i druženje uz stihove domaćih autora.', startInDays: 2, durationHours: 3 },
  { slug: 'setaliste-velika-morava', title: "Koncert KUD „Morava”", description: 'Celovečernji nastup folklornog ansambla na šetalištu.', startInDays: 7, durationHours: 2 },
  { slug: 'os-dositej', title: 'Turnir u malom fudbalu', description: 'Ekipe iz svih naselja opštine. Prijave do petka.', startInDays: 10, durationHours: 6 },
  { slug: 'crkva-svete-trojice-aleksandrovac', title: 'Seoska slava — Sveta Trojica', description: 'Liturgija i narodno veselje u Aleksandrovcu.', startInDays: 9 },
  { slug: 'stara-vodenica-porodin', title: 'Sabor kod Stare vodenice', description: 'Okupljanje meštana uz Moravu, kotlić i tamburaši.', startInDays: 14, durationHours: 10 },
  { slug: 'kafana-stara-vodenica', title: 'Takmičenje u kuvanju kotlića', description: 'Ekipe se nadmeću u kuvanju riblje čorbe i paprikaša.', startInDays: 21, durationHours: 5 },
  { slug: 'os-dude-jovica', title: 'Radionica za decu', description: 'Kreativna radionica i predstava za najmlađe.', startInDays: 12, durationHours: 3 },
  { slug: 'hotel-morava', title: 'Retro žurka', description: 'Muzika osamdesetih i devedesetih u sali hotela.', startInDays: -3, durationHours: 5 },
  { slug: 'setaliste-velika-morava', title: 'Ekološka akcija — čišćenje obale', description: 'Zajednička akcija uređenja obale Velike Morave.', startInDays: -10, durationHours: 4 },
];

// publishedDaysAgo > 7 lands under the "Prikaži stara obaveštenja" toggle.
const NEWS: { slug: string; title: string; body: string; publishedDaysAgo: number }[] = [
  { slug: 'opstina', title: 'Privremeni prekid vodosnabdevanja', body: 'Zbog radova na mreži, u delu Žabara moguć je prekid vode sutra od 9 do 14h. Molimo za razumevanje.', publishedDaysAgo: 0 },
  { slug: 'opstina', title: 'Radno vreme uprave tokom praznika', body: 'Opštinska uprava neće raditi u ponedeljak. Hitne prijave i dalje na dežurni telefon.', publishedDaysAgo: 1 },
  { slug: 'kafana-stara-vodenica', title: 'Otvorena letnja bašta i novi meni', body: 'Od ovog vikenda radimo i baštu uz reku, sa osveženim menijem i roštiljem.', publishedDaysAgo: 1 },
  { slug: 'opstina', title: 'Nova autobuska linija Žabari–Požarevac', body: 'Od 1. u mesecu uvodi se dodatni jutarnji polazak. Red vožnje dostupan na oglasnoj tabli uprave.', publishedDaysAgo: 2 },
  { slug: 'os-dositej', title: 'Obaveštenje za roditelje — kraj polugodišta', body: 'Podela đačkih knjižica u petak od 10h. Roditeljski sastanci po rasporedu odeljenja.', publishedDaysAgo: 3 },
  { slug: 'opstina', title: 'Akcija dobrovoljnog davanja krvi', body: 'Mobilna ekipa Zavoda za transfuziju u Domu kulture, u sredu od 9 do 13h.', publishedDaysAgo: 4 },
  { slug: 'hotel-morava', title: 'Vikend popust na noćenje', body: 'Tokom juna, drugo noćenje uz 30% popusta. Rezervacije telefonom ili na recepciji.', publishedDaysAgo: 5 },
  { slug: 'spomen-cesma-oreovica', title: 'Uređena spomen-česma u Oreovici', body: 'Meštani su, uz pomoć opštine, obnovili spomen-česmu i okolni plato.', publishedDaysAgo: 6 },
  { slug: 'os-dude-jovica', title: 'Upis u prvi razred', body: 'Prijave za upis budućih prvaka traju do kraja meseca. Potrebna dokumentacija u sekretarijatu škole.', publishedDaysAgo: 12 },
  { slug: 'opstina', title: 'Rekonstrukcija seoskog puta', body: 'Počinju radovi na deonici prema Porodinu. Za vreme radova moguća su privremena preusmeravanja saobraćaja.', publishedDaysAgo: 15 },
];

async function run(): Promise<void> {
  const sql = postgres(env.databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    // Demo author (idempotent on email).
    let authorId: number;
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, DEMO_AUTHOR.email))
      .limit(1);
    if (existing) {
      authorId = existing.id;
    } else {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
      const [inserted] = await db
        .insert(users)
        .values({
          email: DEMO_AUTHOR.email,
          passwordHash,
          displayName: DEMO_AUTHOR.displayName,
          role: 'user',
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
      authorId = inserted.id;
    }

    // Map location slug → id for the slugs we reference.
    const wantedSlugs = Array.from(new Set([...EVENTS.map((e) => e.slug), ...NEWS.map((n) => n.slug)]));
    const locRows = await db
      .select({ id: locations.id, slug: locations.slug })
      .from(locations);
    const locBySlug = new Map(locRows.map((l) => [l.slug, l.id]));
    const missing = wantedSlugs.filter((s) => !locBySlug.has(s));
    if (missing.length > 0) {
      console.warn(`Nedostaju lokacije (preskačem stavke za njih): ${missing.join(', ')}`);
    }

    // Clear previous demo content (keyed on the demo author), then re-insert.
    const delNews = await db.delete(news).where(eq(news.authorId, authorId)).returning({ id: news.id });
    const delEvents = await db
      .delete(events)
      .where(eq(events.createdByUserId, authorId))
      .returning({ id: events.id });

    const now = Date.now();

    let eventCount = 0;
    for (const ev of EVENTS) {
      const locationId = locBySlug.get(ev.slug);
      if (!locationId) continue;
      const startsAt = new Date(now + ev.startInDays * DAY);
      const endsAt = ev.durationHours ? new Date(startsAt.getTime() + ev.durationHours * HOUR) : null;
      await db.insert(events).values({
        locationId,
        title: ev.title,
        description: ev.description,
        startsAt,
        endsAt,
        status: 'published',
        createdByUserId: authorId,
      });
      eventCount++;
    }

    let newsCount = 0;
    for (let i = 0; i < NEWS.length; i++) {
      const n = NEWS[i];
      const locationId = locBySlug.get(n.slug);
      if (!locationId) continue;
      const publishedAt = new Date(now - n.publishedDaysAgo * DAY);
      await db.insert(news).values({
        locationId,
        authorId,
        title: n.title,
        slug: `demo-${i + 1}-${slugify(n.title)}`,
        body: n.body,
        status: 'published',
        publishedAt,
      });
      newsCount++;
    }

    console.log(
      `Demo dešavanja seeded: ${eventCount} događaja + ${newsCount} obaveštenja ` +
      `(uklonjeno prethodnih: ${delEvents.length} događaja, ${delNews.length} obaveštenja). ` +
      `Autor: ${DEMO_AUTHOR.email}.`,
    );
  } finally {
    await sql.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
