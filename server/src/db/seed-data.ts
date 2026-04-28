// One starter location per category — minimal seed.
// Add more by editing this file and running `npm run db:reset`.

export const CATEGORIES = [
  { id: 'cafe',     label: 'Kafići i restorani', short: 'Kafići',       color: '#B5532A' },
  { id: 'public',   label: 'Javne službe',        short: 'Javne službe', color: '#1E3A5F' },
  { id: 'landmark', label: 'Znamenitosti',        short: 'Znamenitosti', color: '#C9A961' },
  { id: 'hotel',    label: 'Smeštaj',             short: 'Smeštaj',      color: '#6B8E5A' },
  { id: 'school',   label: 'Obrazovanje',         short: 'Obrazovanje',  color: '#8B4A88' },
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
  { slug: 'kafana-stara-vodenica', catId: 'cafe',     name: 'Stara Vodenica',     subtitle: 'Restoran · domaća kuhinja',  address: 'Karađorđeva 14', lat: 44.3563, lng: 21.2168 },
  { slug: 'opstina',               catId: 'public',   name: 'Opština Žabari',     subtitle: 'Gradska uprava',             address: 'Karađorđeva 1',  lat: 44.3568, lng: 21.2160 },
  { slug: 'crkva-sv-arhandjel',    catId: 'landmark', name: 'Crkva Sv. Arhanđela', subtitle: 'Pravoslavna crkva, XIX vek', address: 'Crkveni trg',    lat: 44.3580, lng: 21.2162 },
  { slug: 'hotel-morava',          catId: 'hotel',    name: 'Hotel Morava',        subtitle: 'Smeštaj · 24 sobe',          address: 'Karađorđeva 30', lat: 44.3576, lng: 21.2185 },
  { slug: 'os-dositej',            catId: 'school',   name: 'OŠ "Dositej Obradović"', subtitle: 'Osnovna škola',          address: 'Đure Jakšića 2', lat: 44.3574, lng: 21.2152 },
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
  'kafana-stara-vodenica': {
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
  'hotel-morava': {
    tagline: 'Hotel sa 4 zvezdice u centru — restoran, sala za sastanke, parking.',
    contact: { phone: '+381 12 251 500', email: 'rezervacije@hotelmorava.rs', address: 'Karađorđeva 30' },
    rooms: [
      { name: 'Standard sa pogledom',  beds: '1 bračni',          area: '22 m²', price: '6.800',  amen: 'TV · WiFi · klima' },
      { name: 'Twin sa parkingom',     beds: '2 zasebna',         area: '24 m²', price: '7.200',  amen: 'TV · WiFi · klima' },
      { name: 'Komfor sa balkonom',    beds: '1 bračni',          area: '28 m²', price: '8.400',  amen: 'TV · WiFi · balkon' },
      { name: 'Apartman Morava',       beds: '1 bračni + kauč',   area: '38 m²', price: '11.200', amen: 'kuhinja · dnevna' },
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
  'crkva-sv-arhandjel': {
    tagline: 'Pravoslavna crkva posvećena Svetom Arhanđelu, podignuta sredinom XIX veka.',
    facts: [
      { num: '1847', label: 'Godina osvećenja' },
      { num: '32',   label: 'Visina zvonika (m)' },
      { num: 'III',  label: 'Stepen zaštite' },
      { num: '1',    em: '×', label: 'Ikonostas, originalan' },
    ],
    story: [
      'Crkva Svetog Arhanđela je podignuta na temeljima starije bogomolje, koja je porušena u Prvom srpskom ustanku. Kamen je dovožen iz okoline Bele Crkve — što daje karakterističan svetlo-okerni ton fasadi.',
      'Ikonostas je delo lokalnog majstora Petra Nikolića, završen 1851. godine. U crkvi se čuva i originalna srebrna kandila iz druge polovine XIX veka, donacija porodice Stojanović.',
      'Tokom letnjih meseci u crkvi se održavaju koncerti duhovne muzike — termini se objavljuju u kalendaru kulturnih dešavanja.',
    ],
  },
};

export const SCHOOL_BY_SLUG = {
  'os-dositej': {
    tagline: 'Osnovna škola "Dositej Obradović" — najstarija škola u opštini, osnovana 1857.',
    contact: { phone: '+381 12 250 277', email: 'skola@osdositej.edu.rs', address: 'Đure Jakšića 2' },
    facts: [
      { num: '1857', label: 'Osnovana' },
      { num: '412',  label: 'Učenika' },
      { num: '38',   label: 'Nastavnika' },
      { num: '8',    label: 'Razreda' },
    ],
    programs: ['Redovna nastava 1—8', 'Produženi boravak 1—4', 'Sportske sekcije', 'Hor i orkestar', 'Robotika i programiranje', 'Engleski od 1. razreda'],
  },
};

/** Build the per-location module content blob for the DB. */
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
  return {};
}
