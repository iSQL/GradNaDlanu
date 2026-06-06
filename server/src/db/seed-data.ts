// Source of truth for:
//   - CATEGORIES → inserted by migrate.ts on every boot (auto-syncs to prod
//     without RUN_SEED_ON_BOOT). Adding a new category here is a one-step
//     change: it appears on the next deploy.
//   - LOCATIONS / EVENTS → inserted by seed.ts, which only runs when
//     RUN_SEED_ON_BOOT=true (default off in prod after first deploy). To push
//     a new starter location to prod, either flip the flag for one boot or
//     create it through the admin panel.
// One starter location per category — minimal seed.
// Add more by editing this file and running `npm run db:reset`.

export const CATEGORIES = [
  { id: 'cafe',           label: 'Kafići i restorani',  short: 'Kafići',         color: '#B5532A' },
  { id: 'public',         label: 'Javne službe',         short: 'Javne službe',   color: '#1E3A5F' },
  { id: 'landmark',       label: 'Znamenitosti',         short: 'Znamenitosti',   color: '#C9A961' },
  { id: 'hotel',          label: 'Smeštaj',              short: 'Smeštaj',        color: '#6B8E5A' },
  { id: 'school',         label: 'Obrazovanje',          short: 'Obrazovanje',    color: '#8B4A88' },
  { id: 'vodoinstalater', label: 'Vodoinstalateri',      short: 'Vodoinst.',      color: '#3B82F6' },
  { id: 'elektricar',     label: 'Električari',          short: 'Električ.',      color: '#F59E0B' },
  { id: 'automehanicar',  label: 'Automehaničari',       short: 'Auto-mehan.',    color: '#EF4444' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export interface SeedLocation {
  slug: string;
  catId: CategoryId;
  name: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
}

export const LOCATIONS: SeedLocation[] = [
  { slug: 'caffe-bar-magacin',          catId: 'cafe',           name: 'Caffe-Bar Magacin',           subtitle: 'Restoran · domaća kuhinja',   address: 'Karađorđeva 14', lat: 44.3563, lng: 21.2168 },
  { slug: 'opstina',                    catId: 'public',         name: 'Opština Žabari',              subtitle: 'Gradska uprava',              address: 'Karađorđeva 1',  lat: 44.3568, lng: 21.2160 },
  { slug: 'crkva-vaznesenja-gospodnjeg', catId: 'landmark',      name: 'Crkva Vaznesenja Gospodnjeg', subtitle: 'Pravoslavna crkva, XIX vek',  address: 'Crkveni trg',    lat: 44.3580, lng: 21.2162 },
  { slug: 'hotel-miroc',                catId: 'hotel',          name: 'Hotel Miroč',                 subtitle: 'Smeštaj · 24 sobe',           address: 'Karađorđeva 30', lat: 44.3576, lng: 21.2185 },
  { slug: 'os-dude-jovica',             catId: 'school',         name: 'OŠ "Dude Jovića"',            subtitle: 'Osnovna škola',               address: 'Đure Jakšića 2', lat: 44.3574, lng: 21.2152 },
  { slug: 'vodoinstalater-marko',  catId: 'vodoinstalater', name: 'Vodoinstalater Marko',    subtitle: 'Vodovod i kanalizacija',      address: 'Vojvode Mišića 7', lat: 44.3559, lng: 21.2175 },
  { slug: 'elektro-stojan',        catId: 'elektricar',     name: 'Elektro Stojan',          subtitle: 'Elektroinstalacije i servis', address: 'Cara Lazara 12',  lat: 44.3571, lng: 21.2148 },
  { slug: 'auto-servis-zika',      catId: 'automehanicar',  name: 'Auto-servis Žika',        subtitle: 'Mehanika i dijagnostika',     address: 'Industrijska 4',  lat: 44.3554, lng: 21.2192 },
];

// Module content keyed by slug.
export const CAFE_DEFAULT = {
  hours: [
    { day: 'Ponedeljak', hours: '08 — 23' },
    { day: 'Utorak',     hours: '08 — 23' },
    { day: 'Sreda',      hours: '08 — 23' },
    { day: 'Četvrtak',   hours: '08 — 23' },
    { day: 'Petak',      hours: '08 — 01' },
    { day: 'Subota',     hours: '09 — 01' },
    { day: 'Nedelja',    hours: '09 — 22' },
  ],
  menu: [
    { cat: 'topli napici', items: [
      { name: 'Domaća kafa',    desc: 'mlevena, džezva',           price: '120 din' },
      { name: 'Espresso',       desc: 'jednostruki',               price: '140 din' },
      { name: 'Kafa sa mlekom', desc: 'sa penom, dvostruki shot',  price: '180 din' },
      { name: 'Topla čokolada', desc: 'gusta, sa šlagom',          price: '220 din' },
    ]},
    { cat: 'osvežavajuća pića', items: [
      { name: 'Domaća limunada',  desc: 'sveže ceđena, sa nanom',   price: '230 din' },
      { name: 'Bazga sa limunom', desc: 'lokalno, ručno pravljeno', price: '180 din' },
    ]},
    { cat: 'kuhinja', items: [
      { name: 'Sarma sa kiselim kupusom', desc: 'tradicionalna, sa hlebom',     price: '720 din' },
      { name: 'Karađorđeva šnicla',       desc: 'sa kajmakom i pomfritom',      price: '980 din' },
      { name: 'Riblja čorba sa Morave',   desc: 'od smuđa i šarana, paprikaš',  price: '650 din' },
      { name: 'Pljeskavica sa lukom',     desc: 'sa kačkavaljem, lepinja',      price: '690 din' },
    ]},
  ],
  contact: { phone: '+381 12 250 142', web: 'staravodenica.rs' },
};

export const CAFE_OVERRIDES: Record<string, { tagline?: string; contact?: { phone?: string; web?: string } }> = {
  'caffe-bar-magacin': {
    tagline: 'Domaća kuhinja, riblji specijaliteti i miran ambijent uz reku Moravu.',
  },
};

export const PUBLIC_BY_SLUG = {
  'opstina': {
    tagline: 'Centralna gradska uprava — usluge za građane, matičar, pisarnica, lokalni porez.',
    hours: [['pon — pet', '07:30 — 15:30'], ['subota', 'zatvoreno'], ['nedelja', 'zatvoreno']],
    contact: { phone: '+381 12 250 130', email: 'info@zabari.rs', address: 'Knez Mihailova 1, 12374 Žabari' },
    services: [
      'Izdavanje izvoda iz matičnih knjiga',
      'Lična stanja i venčanja',
      'Naknada za korišćenje građevinskog zemljišta',
      'Lokalni komunalni porez',
      'Prijava prebivališta',
      'Overene kopije i potpisi',
    ],
  },
};

export const HOTEL_BY_SLUG = {
  'hotel-miroc': {
    tagline: 'Hotel sa 4 zvezdice u centru — restoran, sala za sastanke, parking.',
    contact: { phone: '+381 12 251 500', email: 'rezervacije@hotelmiroc.rs', address: 'Karađorđeva 30' },
    rooms: [
      { name: 'Standard sa pogledom',  beds: '1 bračni',          area: '22 m²', price: '6.800',  amen: 'TV · WiFi · klima' },
      { name: 'Twin sa parkingom',     beds: '2 zasebna',         area: '24 m²', price: '7.200',  amen: 'TV · WiFi · klima' },
      { name: 'Komfor sa balkonom',    beds: '1 bračni',          area: '28 m²', price: '8.400',  amen: 'TV · WiFi · balkon' },
      { name: 'Apartman Miroč',        beds: '1 bračni + kauč',   area: '38 m²', price: '11.200', amen: 'kuhinja · dnevna' },
    ],
    facts: [
      { num: '24', label: 'Sobe' },
      { num: '4',  em: '★', label: 'Kategorija' },
      { num: '7',  label: 'Dana godišnje (otvoreno)' },
      { num: '12', label: 'Min. od centra' },
    ],
  },
};

export const LANDMARK_BY_SLUG = {
  'crkva-vaznesenja-gospodnjeg': {
    tagline: 'Pravoslavna crkva posvećena Vaznesenju Gospodnjem, podignuta sredinom XIX veka.',
    facts: [
      { num: '1847', label: 'Godina osvećenja' },
      { num: '32',   label: 'Visina zvonika (m)' },
      { num: 'III',  label: 'Stepen zaštite' },
      { num: '1',    em: '×', label: 'Ikonostas, originalan' },
    ],
    story: [
      'Crkva Vaznesenja Gospodnjeg je podignuta na temeljima starije bogomolje, koja je porušena u Prvom srpskom ustanku. Kamen je dovožen iz okoline Bele Crkve — što daje karakterističan svetlo-okerni ton fasadi.',
      'Ikonostas je delo lokalnog majstora Petra Nikolića, završen 1851. godine. U crkvi se čuva i originalna srebrna kandila iz druge polovine XIX veka, donacija porodice Stojanović.',
      'Tokom letnjih meseci u crkvi se održavaju koncerti duhovne muzike — termini se objavljuju u kalendaru kulturnih dešavanja.',
    ],
  },
};

export const SCHOOL_BY_SLUG = {
  'os-dude-jovica': {
    tagline: 'Osnovna škola "Dude Jovića" — najstarija škola u opštini, osnovana 1857.',
    contact: { phone: '+381 12 250 277', email: 'skola@osdudejovica.edu.rs', address: 'Đure Jakšića 2' },
    facts: [
      { num: '1857', label: 'Osnovana' },
      { num: '412',  label: 'Učenika' },
      { num: '38',   label: 'Nastavnika' },
      { num: '8',    label: 'Razreda' },
    ],
    programs: ['Redovna nastava 1—8', 'Produženi boravak 1—4', 'Sportske sekcije', 'Hor i orkestar', 'Robotika i programiranje', 'Engleski od 1. razreda'],
  },
};

export const MAJSTOR_BY_SLUG = {
  'vodoinstalater-marko': {
    tagline: 'Vodoinstalaterske usluge — popravke, ugradnja i hitne intervencije.',
    contact: { phone: '+381 63 123 4567', address: 'Vojvode Mišića 7' },
    hours: [
      { day: 'Ponedeljak — Petak', hours: '08 — 17' },
      { day: 'Subota',              hours: '09 — 13' },
      { day: 'Nedelja',             hours: 'po pozivu (hitne intervencije)' },
    ],
    services: [
      'Popravka bojlera i grejača vode',
      'Zamena cevi i ventila',
      'Otpušavanje sudopere i kupatila',
      'Ugradnja sanitarija (WC šolja, lavabo, tuš)',
      'Renoviranje kupatila',
      'Hitne intervencije 24/7',
    ],
    note: 'Iskustvo 15+ godina, koriste se proverene Geberit, Grohe i lokalne komponente.',
  },
  'elektro-stojan': {
    tagline: 'Električarske usluge — kućne instalacije, servis bele tehnike, hitne popravke.',
    contact: { phone: '+381 64 987 6543', address: 'Cara Lazara 12' },
    hours: [
      { day: 'Ponedeljak — Petak', hours: '08 — 18' },
      { day: 'Subota',              hours: '09 — 14' },
      { day: 'Nedelja',             hours: 'zatvoreno' },
    ],
    services: [
      'Postavljanje i popravka električnih instalacija',
      'Servis bele tehnike (frižider, veš mašina, šporet)',
      'Ugradnja osvetljenja i LED rasvete',
      'Zamena osigurača i razvodnih ormana',
      'Pregled instalacija i atest',
      'Hitne intervencije',
    ],
    note: 'Atestiran električar, garancija na ugrađene komponente 12 meseci.',
  },
  'auto-servis-zika': {
    tagline: 'Automehaničarska radnja — mehanika, dijagnostika, sezonske provere.',
    contact: { phone: '+381 65 222 3344', address: 'Industrijska 4' },
    hours: [
      { day: 'Ponedeljak — Petak', hours: '07 — 18' },
      { day: 'Subota',              hours: '08 — 13' },
      { day: 'Nedelja',             hours: 'zatvoreno' },
    ],
    services: [
      'Kompjuterska dijagnostika OBD2',
      'Zamena ulja i filtera',
      'Servis kočnica i diskova',
      'Zamena pločica, akumulatora i guma',
      'Sezonske provere (klima, hladnjak, zimska oprema)',
      'Pripreme za tehnički pregled',
    ],
    note: 'Specijalizacija za VW grupu i francuske marke — Renault, Peugeot, Citroën.',
  },
};

/** Build the per-location module content blob for the DB. */
export interface SeedEvent {
  slug: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
}

export interface SeedNews {
  /** Location slug this news item belongs to. */
  locationSlug: string;
  /** Globally unique news slug (URL path under /obavestenje/...). */
  slug: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface SeedUser {
  email: string;
  displayName: string;
  /** Plain text — gets bcrypt-hashed at insert time. Shared across all demo users. */
  password: string;
}

export interface SeedComment {
  locationSlug: string;
  /** Matches a SeedUser email; resolved to user_id at insert. */
  authorEmail: string;
  body: string;
  rating?: number;
}

// Sample upcoming events shipped with the seed so the Pregled panel and module
// calendars have visible content out of the box. Dates are deliberately a few
// months out from the seed date; if you re-seed in late 2026+ you should
// refresh these or accept that includePast=1 is required to see them.
export const EVENTS: SeedEvent[] = [
  {
    slug: 'os-dude-jovica',
    title: 'Otvoreni dan za buduće đake',
    description: 'Roditelji i deca mogu da pogledaju učionice i razgovaraju sa nastavnicima.',
    startsAt: '2026-06-08T08:00:00Z',
    endsAt:   '2026-06-08T11:00:00Z',
  },
  {
    slug: 'os-dude-jovica',
    title: 'Roditeljski sastanak (5—8 razred)',
    startsAt: '2026-06-15T16:00:00Z',
    endsAt:   '2026-06-15T18:00:00Z',
  },
  {
    slug: 'os-dude-jovica',
    title: 'Završna priredba i izložba',
    description: 'Predstava đaka i izložba radova iz likovne i muzičke sekcije.',
    startsAt: '2026-06-22T15:30:00Z',
  },
  {
    slug: 'os-dude-jovica',
    title: 'Svečana predaja svedočanstava',
    startsAt: '2026-06-29T09:00:00Z',
  },
  {
    slug: 'opstina',
    title: 'Javna rasprava: budžet za 2027.',
    description: 'Otvorena rasprava o predlogu lokalnog budžeta — sala opštine.',
    startsAt: '2026-06-12T16:00:00Z',
    endsAt:   '2026-06-12T18:00:00Z',
  },
  {
    slug: 'opstina',
    title: 'Plansko isključenje vode',
    description: 'Centralni deo Žabara — radovi na vodovodnoj mreži.',
    startsAt: '2026-06-04T06:00:00Z',
    endsAt:   '2026-06-04T14:00:00Z',
  },
  {
    slug: 'crkva-vaznesenja-gospodnjeg',
    title: 'Hramska slava — Spasovdan (Vaznesenje Gospodnje)',
    description: 'Liturgija i osvećenje slavskog kolača.',
    startsAt: '2026-06-21T08:00:00Z',
    endsAt:   '2026-06-21T11:00:00Z',
  },
  {
    slug: 'caffe-bar-magacin',
    title: 'Letnja muzička večer',
    description: 'Akustična svirka pred baštom, ulaz besplatan.',
    startsAt: '2026-06-14T19:00:00Z',
    endsAt:   '2026-06-14T23:00:00Z',
  },
];

// Sample published news so the homepage "Najnovija dešavanja" tile grid and the
// per-location "Obaveštenja" tab have content out of the box. Authored by the
// seeded admin (authorId resolved in seed.ts at insert time). publishedAt is set
// to recent past dates so listNews ORDER BY publishedAt DESC keeps them at top.
export const NEWS: SeedNews[] = [
  {
    locationSlug: 'opstina',
    slug: 'opstina-plansko-iskljucenje-vode',
    title: 'Plansko isključenje vode u centru Žabara',
    body: 'U sredu, 3. juna 2026. godine, planirano je isključenje vode u centralnom delu Žabara od 06:00 do 14:00 zbog radova na vodovodnoj mreži. Preporučuje se da građani obezbede zalihe vode za pijenje i osnovne potrebe.',
    publishedAt: '2026-06-02T08:00:00Z',
  },
  {
    locationSlug: 'hotel-miroc',
    slug: 'hotel-miroc-nova-terasa',
    title: 'Nova letnja terasa otvorena za rezervacije',
    body: 'Hotel Miroč je obnovio letnju terasu sa pogledom na Moravu. Kapacitet 60 mesta, otvorena svakog dana od 10 do 23h. Rezervacije se primaju preko sajta i recepcije.',
    publishedAt: '2026-06-01T10:00:00Z',
  },
  {
    locationSlug: 'caffe-bar-magacin',
    slug: 'caffe-bar-magacin-ziva-muzika-cetvrtkom',
    title: 'Svakog četvrtka — živa muzika u Magacinu',
    body: 'Od 1. juna pa do kraja avgusta, svakog četvrtka od 20h sviraju lokalni bendovi. Ulaz besplatan, rezervacija stola preporučena preko sajta.',
    publishedAt: '2026-05-30T18:00:00Z',
  },
  {
    locationSlug: 'os-dude-jovica',
    slug: 'os-dude-jovica-upis-2026',
    title: 'Upis u prvi razred za 2026/2027',
    body: 'Prijava i upis učenika u prvi razred za školsku 2026/2027. godinu počinju 1. juna. Potrebna dokumenta: izvod iz matične knjige rođenih, potvrda o prebivalištu i lekarsko uverenje.',
    publishedAt: '2026-05-28T09:00:00Z',
  },
  {
    locationSlug: 'crkva-vaznesenja-gospodnjeg',
    slug: 'crkva-vaznesenja-bogosluzenje-jun',
    title: 'Raspored bogosluženja za jun',
    body: 'Sveta liturgija nedeljom u 9h. Večernje subotom u 18h. Krštenja se obavljaju nedeljom posle liturgije — kontakt na +381 12 250 100.',
    publishedAt: '2026-06-03T07:00:00Z',
  },
];

// Sample visitor accounts that author the seeded comments. Same password for
// all so a demo reviewer can log in as any of them — useful when poking at
// favorites / reservations from the visitor perspective. Do NOT use these
// credentials in production seeds.
export const DEMO_USER_PASSWORD = 'demo1234';
export const USERS: SeedUser[] = [
  { email: 'marko@example.com',  displayName: 'Marko P.',  password: DEMO_USER_PASSWORD },
  { email: 'jelena@example.com', displayName: 'Jelena S.', password: DEMO_USER_PASSWORD },
  { email: 'milos@example.com',  displayName: 'Miloš M.',  password: DEMO_USER_PASSWORD },
  { email: 'ana@example.com',    displayName: 'Ana R.',    password: DEMO_USER_PASSWORD },
];

// Sample comments authored by USERS above. Powers the homepage "Najnoviji utisci"
// row and per-location comment list. Idempotent at insert time via
// (userId, locationId, body) tuple — same body from same user on same location
// is skipped. status defaults to 'visible'.
export const COMMENTS: SeedComment[] = [
  { locationSlug: 'caffe-bar-magacin',           authorEmail: 'marko@example.com',  rating: 5, body: 'Najbolja kafa u Žabarima i opuštena atmosfera. Konobari su izuzetno ljubazni.' },
  { locationSlug: 'caffe-bar-magacin',           authorEmail: 'jelena@example.com', rating: 4, body: 'Sviđa mi se bašta uveče, preporučujem koktel "Magacin". Muzika ume da bude malo glasna.' },
  { locationSlug: 'hotel-miroc',                 authorEmail: 'ana@example.com',    rating: 5, body: 'Soba prostrana, pogled odličan. Doručak bogat i osoblje veoma profesionalno.' },
  { locationSlug: 'hotel-miroc',                 authorEmail: 'milos@example.com',  rating: 4, body: 'Dobar smeštaj za poslovnu posetu. Parking i WiFi rade bez zamerke.' },
  { locationSlug: 'os-dude-jovica',              authorEmail: 'jelena@example.com', rating: 5, body: 'Učiteljica naše ćerke je sjajna — dete jedva čeka da pođe u školu svaki dan.' },
  { locationSlug: 'crkva-vaznesenja-gospodnjeg', authorEmail: 'marko@example.com',  rating: 5, body: 'Predivna crkva, mirno mesto za molitvu. Sveštenik veoma srdačan prema posetiocima.' },
  { locationSlug: 'opstina',                     authorEmail: 'ana@example.com',    rating: 3, body: 'Procedure su brze, ali parking u centru je problem ujutru.' },
];

export function buildModuleContent(slug: string, catId: CategoryId): unknown {
  if (catId === 'cafe') {
    const o = CAFE_OVERRIDES[slug] ?? {};
    return {
      tagline: o.tagline,
      hours: CAFE_DEFAULT.hours,
      menu: CAFE_DEFAULT.menu,
      contact: { ...CAFE_DEFAULT.contact, ...o.contact },
    };
  }
  if (catId === 'public')   return (PUBLIC_BY_SLUG as Record<string, unknown>)[slug] ?? {};
  if (catId === 'hotel')    return (HOTEL_BY_SLUG as Record<string, unknown>)[slug] ?? {};
  if (catId === 'landmark') return (LANDMARK_BY_SLUG as Record<string, unknown>)[slug] ?? {};
  if (catId === 'school')   return (SCHOOL_BY_SLUG as Record<string, unknown>)[slug] ?? {};
  if (catId === 'vodoinstalater' || catId === 'elektricar' || catId === 'automehanicar') {
    return (MAJSTOR_BY_SLUG as Record<string, unknown>)[slug] ?? {};
  }
  return {};
}
