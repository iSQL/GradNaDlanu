// Ported from prototype data.jsx + map.jsx (PIN_COORDS).

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
  // Cafés / restaurants
  { slug: 'kafana-stara-vodenica', catId: 'cafe', name: 'Stara Vodenica',  subtitle: 'Restoran · domaća kuhinja', address: 'Karađorđeva 14',     lat: 44.3563, lng: 21.2168 },
  { slug: 'kafic-trg',             catId: 'cafe', name: 'Kafić Trg',        subtitle: 'Kafić · centar',            address: 'Trg oslobođenja bb', lat: 44.3572, lng: 21.2155 },
  { slug: 'pizzeria-zabarka',      catId: 'cafe', name: 'Picerija Žabarka', subtitle: 'Picerija · porodična',      address: 'Karađorđeva 22',     lat: 44.3552, lng: 21.2172 },
  { slug: 'kafe-most',             catId: 'cafe', name: 'Kafe Most',        subtitle: 'Kafić uz glavnu ulicu',     address: 'Vojvođanska 3',      lat: 44.3578, lng: 21.2148 },

  // Public services
  { slug: 'opstina',         catId: 'public', name: 'Opština Žabari',     subtitle: 'Gradska uprava',         address: 'Karađorđeva 1',    lat: 44.3568, lng: 21.2160 },
  { slug: 'dom-zdravlja',    catId: 'public', name: 'Dom zdravlja',       subtitle: 'Zdravstvena ustanova',   address: 'Knez Mihailova 6', lat: 44.3560, lng: 21.2178 },
  { slug: 'policija',        catId: 'public', name: 'Policijska stanica', subtitle: 'MUP · ispostava',        address: 'Karađorđeva 8',    lat: 44.3555, lng: 21.2158 },
  { slug: 'vatrogasci',      catId: 'public', name: 'Vatrogasna stanica', subtitle: 'Profesionalna jedinica', address: 'Industrijska bb',  lat: 44.3562, lng: 21.2200 },
  { slug: 'posta',           catId: 'public', name: 'Pošta 12374',        subtitle: 'Šalter, paketi',         address: 'Karađorđeva 5',    lat: 44.3566, lng: 21.2163 },
  { slug: 'apoteka-melem',   catId: 'public', name: 'Apoteka Melem',      subtitle: 'Apoteka',                address: 'Karađorđeva 3',    lat: 44.3573, lng: 21.2163 },
  { slug: 'vrtic-leptiric',  catId: 'public', name: 'Vrtić Leptirić',     subtitle: 'Predškolsko',            address: 'Đure Jakšića 17',  lat: 44.3548, lng: 21.2150 },

  // Landmarks
  { slug: 'crkva-sv-arhandjel', catId: 'landmark', name: 'Crkva Sv. Arhanđela',     subtitle: 'Pravoslavna crkva, XIX vek', address: 'Crkveni trg',     lat: 44.3580, lng: 21.2162 },
  { slug: 'spomenik-palim',     catId: 'landmark', name: 'Spomenik palim borcima', subtitle: 'Centralni spomenik',         address: 'Trg oslobođenja', lat: 44.3570, lng: 21.2158 },
  { slug: 'mlin',               catId: 'landmark', name: 'Stari mlin',              subtitle: 'Vodenica iz 1898.',          address: 'Brezova bb',      lat: 44.3550, lng: 21.2120 },

  // Hotels
  { slug: 'hotel-morava',  catId: 'hotel', name: 'Hotel Morava',  subtitle: 'Smeštaj · 24 sobe', address: 'Karađorđeva 30', lat: 44.3576, lng: 21.2185 },
  { slug: 'pansion-breza', catId: 'hotel', name: 'Pansion Breza', subtitle: 'Pansion · doručak', address: 'Brezova 4',      lat: 44.3543, lng: 21.2148 },

  // Schools
  { slug: 'os-dositej', catId: 'school', name: 'OŠ "Dositej Obradović"', subtitle: 'Osnovna škola', address: 'Vojvođanska 2',  lat: 44.3574, lng: 21.2152 },
  { slug: 'gimnazija',  catId: 'school', name: 'Gimnazija Žabari',         subtitle: 'Srednja škola', address: 'Cara Lazara 14', lat: 44.3580, lng: 21.2178 },
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
  'kafic-trg': {
    tagline: 'Mali kafić na centralnom trgu — savršen za jutarnju kafu i sastanke u centru.',
    contact: { phone: '+381 12 250 803', web: 'kafictrg.rs' },
  },
  'pizzeria-zabarka': {
    tagline: 'Porodična picerija. Picu pečemo u kamenoj peći više od deset godina.',
    contact: { phone: '+381 12 251 940', web: 'zabarka.rs' },
  },
  'kafana-stara-vodenica': {
    tagline: 'Domaća kuhinja, riblji specijaliteti i miran ambijent uz reku Moravu.',
  },
  'kafe-most': {
    tagline: 'Kafić sa pogledom na most — okupljalište mlađih posetilaca.',
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
  'dom-zdravlja': {
    tagline: 'Primarna zdravstvena zaštita — opšta praksa, pedijatrija, stomatologija.',
    hours: [['pon — pet', '07:00 — 20:00'], ['subota', '07:00 — 13:00'], ['nedelja', 'dežurstvo']],
    contact: { phone: '+381 12 250 165', email: 'dz@zabari.rs', address: 'Vojvođanska 6' },
    services: ['Opšta praksa', 'Pedijatrija', 'Stomatologija', 'Ginekologija', 'Hitna pomoć (24h)', 'Apoteka'],
  },
  'policija': {
    tagline: 'Policijska ispostava Žabari — prijave, izdavanje dokumenata, dežurstvo 24h.',
    hours: [['svaki dan', '00:00 — 24:00 (dežurstvo)'], ['šalter za dokumenta', 'pon — pet, 08 — 15']],
    contact: { phone: '192', email: 'policija.zabari@mup.gov.rs', address: 'Karađorđeva 8' },
    services: ['Prijave krivičnih dela', 'Izdavanje ličnih karata', 'Saobraćajna dozvola', 'Putna isprava'],
  },
  'vatrogasci': {
    tagline: 'Profesionalna vatrogasno-spasilačka jedinica — dežurstvo 24h.',
    hours: [['svaki dan', '00:00 — 24:00']],
    contact: { phone: '193', email: 'vsj.zabari@mup.gov.rs', address: 'Industrijska bb' },
    services: ['Gašenje požara', 'Tehničke intervencije', 'Spasilačke akcije', 'Edukacija stanovništva'],
  },
  'posta': {
    tagline: 'Glavna pošta — slanje pošiljki, plaćanje računa, finansijske usluge.',
    hours: [['pon — pet', '07:30 — 18:00'], ['subota', '08:00 — 13:00'], ['nedelja', 'zatvoreno']],
    contact: { phone: '+381 12 250 222', email: 'pak.12374@posta.rs', address: 'Knez Mihailova 5' },
    services: ['Slanje paketa i pisama', 'Plaćanje računa', 'Penzije', 'Western Union', 'Postanska štedionica'],
  },
  'apoteka-melem': {
    tagline: 'Apoteka u centru grada — recepti, OTC, kućna nega.',
    hours: [['pon — pet', '07:00 — 21:00'], ['subota', '08:00 — 14:00'], ['nedelja', 'zatvoreno']],
    contact: { phone: '+381 12 251 001', email: 'apoteka.melem@gmail.com', address: 'Trg oslobođenja 3' },
    services: ['Recepti', 'Slobodna prodaja', 'Kućna nega', 'Saveti farmaceuta'],
  },
  'vrtic-leptiric': {
    tagline: 'Predškolska ustanova — jasle, mlađe i starije grupe.',
    hours: [['pon — pet', '06:00 — 17:00'], ['subota — nedelja', 'zatvoreno']],
    contact: { phone: '+381 12 250 466', email: 'leptiric@zabari.rs', address: 'Cara Lazara 17' },
    services: ['Jasle (1–3 god)', 'Vrtić (3–7 god)', 'Predškolski program', 'Letnji kamp'],
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
  'pansion-breza': {
    tagline: 'Mali porodični pansion — domaći doručak, mirno okruženje uz brezovu šumicu.',
    contact: { phone: '+381 64 220 4801', email: 'breza.zabari@gmail.com', address: 'Brezova 4' },
    rooms: [
      { name: 'Soba "Lipa"',  beds: '1 bračni',  area: '16 m²', price: '3.200', amen: 'TV · WiFi · doručak' },
      { name: 'Soba "Hrast"', beds: '2 zasebna', area: '18 m²', price: '3.600', amen: 'TV · WiFi · doručak' },
    ],
    facts: [
      { num: '6',  label: 'Sobe' },
      { num: '3',  em: '★', label: 'Kategorija' },
      { num: '24', label: 'Doručak (sati)' },
      { num: '5',  label: 'Min. od centra' },
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
  'spomenik-palim': {
    tagline: 'Centralni spomenik palim borcima u oslobodilačkim ratovima — srce gradskog trga.',
    facts: [
      { num: '1922', label: 'Otkriven' },
      { num: '8.4',  label: 'Visina (m)' },
      { num: '127',  label: 'Imena na spomeniku' },
      { num: '2',    em: '×', label: 'Reljefa, bronza' },
    ],
    story: [
      'Spomenik palim borcima podignut je 1922. godine, u znak sećanja na žitelje žabarskog kraja koji su izgubili živote u balkanskim ratovima i Prvom svetskom ratu. Autor je vajar Živojin Lukić.',
      'Centralni stub je od bele granitne stene, dok su dva bronzana reljefa rad istog autora — prikazuju ratnike u pokretu i scene ispraćaja. Na bočnim pločama uklesano je 127 imena.',
      'Spomenik je prošao temeljnu konzervaciju 2018. godine. Svake godine 11. novembra ovde se održava komemoracija.',
    ],
  },
  'mlin': {
    tagline: 'Stara vodenica iz 1898 — jedan od poslednjih sačuvanih objekata vodeničkog tipa u regionu.',
    facts: [
      { num: '1898', label: 'Sagrađen' },
      { num: '4',    label: 'Para mlinskih kola' },
      { num: '3',    label: 'Sprata' },
      { num: 'I',    em: '°', label: 'Kategorija zaštite' },
    ],
    story: [
      'Stari mlin podignut je 1898. godine porodicom Marković. Tokom najboljih godina, mlin je radio neprekidno — vodeni točak pokretao je četiri para mlinskih kola i mašine za stupanje sukna.',
      'Mlin je radio sve do 1972. godine. Restauracija je počela 2009, a od 2014. mlin je otvoren za posetioce. Mehanizam je delimično obnovljen i pokreće se za najavljene grupne posete.',
      'Iza mlina je kameni most preko mlinskog jaza i klupe — popularno mesto za odmor uz reku.',
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
  'gimnazija': {
    tagline: 'Gimnazija Žabari — opšti smer i prirodno-matematički smer.',
    contact: { phone: '+381 12 251 188', email: 'kancelarija@gimzabari.edu.rs', address: 'Vojvođanska 14' },
    facts: [
      { num: '1956', label: 'Osnovana' },
      { num: '286',  label: 'Učenika' },
      { num: '24',   label: 'Profesora' },
      { num: '2',    label: 'Smera' },
    ],
    programs: ['Opšti smer', 'Prirodno-matematički smer', 'Pripreme za maturu', 'Razmena sa školom u Mađarskoj', 'Klub mladih programera', 'Literarna sekcija'],
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
