import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray } from 'drizzle-orm';
import * as schema from './schema.js';
import { ads, users } from './schema.js';
import { env } from '../env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Demo seed for the "Oglasna tabla" (bulletin board). Standalone + idempotent:
// run it as many times as you like, it always leaves exactly this set of demo
// ads on the board. Safe for the local/demo DB only — DO NOT point it at prod.
//
//   npm --workspace server run seed:ads
//
// It (1) ensures a handful of demo resident accounts, (2) deletes any ads those
// demo users currently own (cascading their conversations/messages), then
// (3) inserts the fixed list below. Real users' ads are never touched.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = 'demo1234';

const DEMO_USERS = [
  { email: 'petar.demo@example.com', displayName: 'Petar Petrović' },
  { email: 'jelena.demo@example.com', displayName: 'Jelena Jovanović' },
  { email: 'marko.demo@example.com', displayName: 'Marko Marković' },
  { email: 'ana.demo@example.com', displayName: 'Ana Anić' },
  { email: 'nikola.demo@example.com', displayName: 'Nikola Nikolić' },
  { email: 'milica.demo@example.com', displayName: 'Milica Milić' },
];

type AdSeed = {
  title: string;
  description: string;
  category: schema.AdCategory;
  priceRsd: number | null;
  village: string;
  contactMethod: schema.AdContactMethod;
  contactValue: string | null;
};

const ADS: AdSeed[] = [
  // — prodajem —
  { title: 'Prodajem žensku biciklu', description: 'Polovna bicikla, 26 inča, malo korišćena, ispravna. Žabari.', category: 'prodajem', priceRsd: 9000, village: 'Žabari', contactMethod: 'phone', contactValue: '+381 64 123 4567' },
  { title: 'Plac 12 ari, papiri uredni', description: 'Građevinski plac na ulazu u selo, struja i voda na placu.', category: 'prodajem', priceRsd: 450000, village: 'Porodin', contactMethod: 'phone', contactValue: '+381 63 222 1144' },
  { title: 'Golf 5, 1.9 TDI', description: 'Registrovan do kraja godine, prešao 230.000 km, klima radi.', category: 'prodajem', priceRsd: 380000, village: 'Simićevo', contactMethod: 'phone', contactValue: '+381 60 555 0099' },
  { title: 'Bukova drva za ogrev', description: 'Suva bukova drva, isečena i iscepana. Mogućnost dostave.', category: 'prodajem', priceRsd: 6500, village: 'Oreovica', contactMethod: 'phone', contactValue: '+381 65 410 2030' },
  { title: 'Traktor IMT 539', description: 'U dobrom stanju, redovno održavan, sve ispravno.', category: 'prodajem', priceRsd: 320000, village: 'Tićevac', contactMethod: 'phone', contactValue: '+381 64 777 8810' },
  { title: 'Domaći med, bagrem i livada', description: 'Med iz sopstvenog pčelinjaka, tegla 1kg. Bagrem i livada.', category: 'prodajem', priceRsd: 1200, village: 'Viteževo', contactMethod: 'message', contactValue: null },
  { title: 'Domaća rakija šljivovica', description: 'Prepečenica, jačina ~25 stepeni gradi. Probano, ima i kruškovača.', category: 'prodajem', priceRsd: 1500, village: 'Kočetin', contactMethod: 'phone', contactValue: '+381 62 300 4455' },
  { title: 'Štenci nemačkog ovčara', description: 'Tri muška, jedno žensko. Vakcinisani i očišćeni od parazita.', category: 'prodajem', priceRsd: 8000, village: 'Aleksandrovac', contactMethod: 'message', contactValue: null },
  { title: 'Polovan trosed na razvlačenje', description: 'Očuvan, bez oštećenja, pogodan za dnevnu sobu. Lično preuzimanje.', category: 'prodajem', priceRsd: 15000, village: 'Žabari', contactMethod: 'phone', contactValue: '+381 64 909 1212' },
  { title: 'Samsung A52, 128GB', description: 'Telefon u garanciji, sa maskom i folijom. Bez ogrebotina.', category: 'prodajem', priceRsd: 18000, village: 'Porodin', contactMethod: 'message', contactValue: null },
  { title: 'Plastenik 6x30m, konstrukcija', description: 'Pocinkovana konstrukcija plastenika, bez najlona. Demontiran.', category: 'prodajem', priceRsd: 60000, village: 'Brzohode', contactMethod: 'phone', contactValue: '+381 60 144 2200' },
  { title: 'Kokoške nosilje', description: 'Mlade nosilje, pred nošenje. Cena po komadu, popust za veću količinu.', category: 'prodajem', priceRsd: 700, village: 'Svinjarevo', contactMethod: 'phone', contactValue: '+381 63 818 7766' },
  { title: 'Traktorska prikolica 3.5t', description: 'Kiper prikolica, registrovana, gume dobre.', category: 'prodajem', priceRsd: 210000, village: 'Mirijevo', contactMethod: 'phone', contactValue: '+381 64 233 6677' },
  { title: 'Jaja domaća', description: 'Sveža jaja od koka iz dvorišta. Dostava u Žabare sredom.', category: 'prodajem', priceRsd: 350, village: 'Vlaški Do', contactMethod: 'message', contactValue: null },

  // — kupujem —
  { title: 'Kupujem kukuruz', description: 'Kupujem kukuruz u zrnu, veća količina. Dolazim po robu.', category: 'kupujem', priceRsd: null, village: 'Porodin', contactMethod: 'phone', contactValue: '+381 65 700 1188' },
  { title: 'Kupujem polovan bojler', description: 'Tražim ispravan bojler 80l, povoljno.', category: 'kupujem', priceRsd: null, village: 'Žabari', contactMethod: 'message', contactValue: null },
  { title: 'Kupujem seno u balama', description: 'Potrebno seno, manje četvrtaste bale. Okolina Žabara.', category: 'kupujem', priceRsd: null, village: 'Sibnica', contactMethod: 'phone', contactValue: '+381 64 511 9090' },
  { title: 'Kupujem staru ciglu', description: 'Tražim staru punu ciglu za zidanje, veća količina.', category: 'kupujem', priceRsd: null, village: 'Četereže', contactMethod: 'phone', contactValue: '+381 60 332 4848' },

  // — usluge —
  { title: 'Vodoinstalater — brze intervencije', description: 'Popravke, zamena baterija, odgušenja. Izlazak na teren ceo dan.', category: 'usluge', priceRsd: null, village: 'Žabari', contactMethod: 'phone', contactValue: '+381 64 600 2233' },
  { title: 'Prevoz robe kombijem', description: 'Selidbe i prevoz robe do 1.5t. Žabari i okolina, po dogovoru i dalje.', category: 'usluge', priceRsd: null, village: 'Simićevo', contactMethod: 'phone', contactValue: '+381 63 404 5050' },
  { title: 'Krečenje i gletovanje', description: 'Molerski radovi, uredno i čisto. Besplatna procena.', category: 'usluge', priceRsd: null, village: 'Oreovica', contactMethod: 'message', contactValue: null },
  { title: 'Časovi matematike', description: 'Privatni časovi za osnovce i srednjoškolce. Priprema za malu maturu.', category: 'usluge', priceRsd: 1000, village: 'Porodin', contactMethod: 'email', contactValue: 'casovi.matematike@example.com' },
  { title: 'Cepanje i slaganje drva', description: 'Mašinsko cepanje drva, dolazim sa svojom mašinom.', category: 'usluge', priceRsd: null, village: 'Tićevac', contactMethod: 'phone', contactValue: '+381 65 121 3434' },
  { title: 'Frizer na kućnoj adresi', description: 'Šišanje i feniranje u udobnosti vašeg doma. Zakazivanje preko Instagrama.', category: 'usluge', priceRsd: null, village: 'Žabari', contactMethod: 'link', contactValue: 'https://instagram.com/frizer.zabari.demo' },
  { title: 'Popravka računara i laptopa', description: 'Čišćenje od virusa, reinstalacija, zamena delova. Dolazak na adresu.', category: 'usluge', priceRsd: null, village: 'Aleksandrovac', contactMethod: 'message', contactValue: null },

  // — poslovi —
  { title: 'Potreban radnik za berbu', description: 'Sezonski posao, berba u voćnjaku. Plaćanje dnevno.', category: 'poslovi', priceRsd: null, village: 'Viteževo', contactMethod: 'phone', contactValue: '+381 64 818 2727' },
  { title: 'Traži se konobar/konobarica', description: 'Kafić u centru traži konobara. Prijatna atmosfera, stalan posao.', category: 'poslovi', priceRsd: null, village: 'Žabari', contactMethod: 'phone', contactValue: '+381 63 707 6161' },
  { title: 'Potrebna pomoć u domaćinstvu', description: 'Tražim osobu za povremenu pomoć starijem licu, par sati dnevno.', category: 'poslovi', priceRsd: null, village: 'Kočetin', contactMethod: 'message', contactValue: null },
  { title: 'Traži se vozač C kategorije', description: 'Firma iz Porodina traži vozača kamiona. Iskustvo poželjno.', category: 'poslovi', priceRsd: null, village: 'Porodin', contactMethod: 'email', contactValue: 'posao.transport@example.com' },

  // — ostalo —
  { title: 'Poklanjam mačiće', description: 'Tri umiljata mačeta traže dom. Navikli na ljude.', category: 'ostalo', priceRsd: null, village: 'Polatna', contactMethod: 'message', contactValue: null },
  { title: 'Izgubljen pas, žuti mešanac', description: 'Nestao u okolini škole. Nosi crvenu ogrlicu. Nagrada za nalazača.', category: 'ostalo', priceRsd: null, village: 'Žabari', contactMethod: 'phone', contactValue: '+381 64 999 0001' },
  { title: 'Izdajem salu za proslave', description: 'Sala za rođendane i proslave do 50 mesta. Slobodni termini vikendom.', category: 'ostalo', priceRsd: null, village: 'Simićevo', contactMethod: 'link', contactValue: 'https://facebook.com/sala.zabari.demo' },
];

async function run(): Promise<void> {
  const sql = postgres(env.databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    // 1) Ensure demo users (idempotent on email).
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const userIds: number[] = [];
    for (const u of DEMO_USERS) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);
      if (existing) {
        userIds.push(existing.id);
        continue;
      }
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
      userIds.push(inserted.id);
    }

    // 2) Clear this demo set's previous ads (cascades their conversations/messages).
    const deleted = await db
      .delete(ads)
      .where(inArray(ads.userId, userIds))
      .returning({ id: ads.id });

    // 3) Insert the fixed demo set, round-robin across the demo users, with
    //    staggered createdAt so the board has a natural recent-first order.
    const now = Date.now();
    const rows = ADS.map((ad, i) => {
      const createdAt = new Date(now - i * 3 * 60 * 60 * 1000); // 3h apart
      return {
        userId: userIds[i % userIds.length],
        title: ad.title,
        description: ad.description,
        category: ad.category,
        priceRsd: ad.priceRsd,
        village: ad.village,
        contactMethod: ad.contactMethod,
        contactValue: ad.contactValue,
        status: 'active' as const,
        lastRefreshedAt: new Date(now),
        createdAt,
        updatedAt: createdAt,
      };
    });
    await db.insert(ads).values(rows);

    console.log(
      `Demo ads seeded: ${rows.length} ads across ${userIds.length} demo users ` +
      `(removed ${deleted.length} prior demo ads). ` +
      `Demo login: any of ${DEMO_USERS.map((u) => u.email).join(', ')} / password "${DEMO_PASSWORD}".`,
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
