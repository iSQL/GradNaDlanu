// Kategorije usluga za broadcast zahteve ("Usluge"). Superset majstorskih
// kategorija objekata: 'bela-tehnika' i 'majstor-za-sve' postoje SAMO kao
// kategorije usluga (nemaju objekte na mapi ni red u `categories` tabeli).
// Mora odgovarati server/src/lib/usluge.ts — kopirano namerno, dva workspace-a.
export const SERVICE_CATEGORIES = [
  'vodoinstalater',
  'elektricar',
  'automehanicar',
  'bela-tehnika',
  'majstor-za-sve',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export function isServiceCategory(value: unknown): value is ServiceCategory {
  return typeof value === 'string' && (SERVICE_CATEGORIES as readonly string[]).includes(value);
}

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  vodoinstalater: 'Vodoinstalater',
  elektricar: 'Električar',
  automehanicar: 'Automehaničar',
  'bela-tehnika': 'Servis bele tehnike',
  'majstor-za-sve': 'Majstor za sve',
};

export const SERVICE_CATEGORY_SUBS: Record<ServiceCategory, string> = {
  vodoinstalater: 'Popravka česmi, bojlera, curenja i slično',
  elektricar: 'Instalacije i hitne popravke',
  automehanicar: 'Servis i popravka vozila',
  'bela-tehnika': 'Veš mašine, bojleri, šporeti',
  'majstor-za-sve': 'Sitne popravke u domaćinstvu',
};

// Čipovi "Šta ovaj majstor radi" — primeri poslova po kategoriji.
export const SERVICE_CATEGORY_EXAMPLES: Record<ServiceCategory, string[]> = {
  vodoinstalater: [
    'Popravka česmi',
    'Zamena bojlera',
    'Otklanjanje curenja',
    'Odčepljenje odvoda',
    'Ugradnja sanitarija',
  ],
  elektricar: [
    'Zamena instalacija',
    'Popravka prekidača i utičnica',
    'Ugradnja rasvete',
    'Hitne intervencije',
    'Sređivanje razvodnog ormana',
  ],
  automehanicar: [
    'Redovan servis',
    'Zamena ulja i filtera',
    'Kočnice i trap',
    'Dijagnostika kvara',
    'Zamena akumulatora',
  ],
  'bela-tehnika': [
    'Popravka veš mašine',
    'Servis bojlera',
    'Popravka šporeta',
    'Servis frižidera',
    'Čišćenje klima uređaja',
  ],
  'majstor-za-sve': [
    'Montaža nameštaja',
    'Sitne popravke u kući',
    'Kačenje slika i polica',
    'Zamena brave',
    'Farbanje manjih površina',
  ],
};
