-- ============================================================================
-- Demo podaci za "Prijava problema" (/problemi) — ~20 prijava + glasovi + komentari.
-- Namena: demo.zabari.net. Idempotentno — može se pustiti više puta, preskače
-- postojeće naslove/mejlove/parove glasova.
--
-- Pokretanje:  psql "$DATABASE_URL" -f scripts/demo-problemi.sql
--
-- Napomene:
--  * Prijave su anonimne (user_id NULL) — kao da su ih poslali građani bez naloga.
--  * Glasovi zahtevaju stvarne user redove, pa sekcija 2 kreva 12 demo "glasača"
--    (password_hash NULL → ne mogu da se uloguju; role='user' pa ih guest-cleanup
--    ne dira). Ako ih ne želiš, preskoči sekcije 2 i 3.
--  * solved_by / "opština" komentari koriste prvog admin korisnika.
-- ============================================================================

BEGIN;

-- ── 1) Prijave ──────────────────────────────────────────────────────────────
INSERT INTO problems (user_id, cat_id, title, description, village, address, lat, lng, status, solved_at, solved_by, created_at, updated_at)
SELECT
  NULL,
  v.cat_id, v.title, v.description, v.village, v.address, v.lat, v.lng, v.status,
  CASE WHEN v.status = 'solved' THEN NOW() - (v.solved_days_ago || ' days')::interval END,
  CASE WHEN v.status = 'solved' THEN (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1) END,
  NOW() - (v.days_ago || ' days')::interval,
  NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  -- cat_id      | title                                                      | description                                                                                                                        | village        | address              | lat      | lng      | status   | days_ago | solved_days_ago
  ('saobracaj', 'Velika rupa na kolovozu u ulici Kneza Miloša',               'Rupa je duboka preko 20cm i proteže se skoro celom širinom desne trake. Više vozila je već oštetilo gume, a noću nije obeležena.', 'Žabari',       'Kneza Miloša 24',     44.35720, 21.21480, 'open',   4,  NULL),
  ('vodovod',   'Poplavljena ulica posle kiše — začepljen slivnik',           'Kod raskrsnice voda se zadržava danima nakon svake veće kiše. Slivnik je začepljen lišćem i muljem, voda ulazi u dvorišta.',       'Porodin',      'Karađorđeva bb',      44.31400, 21.22250, 'open',   2,  NULL),
  ('zelenilo',  'Zaraslo granje na dečjem igralištu kod škole',               'Grane su toliko niske da deca ne mogu da koriste ljuljaške, a jedna suva grana preti da padne na klackalicu.',                     'Žabari',       'OŠ „Dude Jovića”',    44.35760, 21.21500, 'open',   5,  NULL),
  ('otpad',     'Divlja deponija pored puta ka groblju',                      'Neko redovno istovaruje građevinski otpad i kabastu ambalažu na zelenoj površini pored puta. Širi se neprijatan miris.',            'Žabari',       'Put ka groblju',      44.36010, 21.21180, 'open',   6,  NULL),
  ('otpad',     'Kontejner na trotoaru blokira prolaz',                       'Kontejner je pomeren na sredinu trotoara pa roditelji sa kolicima i osobe sa invaliditetom moraju da izlaze na kolovoz.',            'Žabari',       'Trg oslobođenja 3',   44.35850, 21.21620, 'open',   7,  NULL),
  ('urbana',    'Polomljena klupa i rasveta u centru sela',                   'Dve klupe su polomljene, a ulična svetiljka ne radi već mesec dana pa je uveče centar potpuno mračan.',                             'Simićevo',     'Centar',              44.38320, 21.20050, 'open',   9,  NULL),
  ('saobracaj', 'Nedostaje poklopac na šahtu kod pijace',                     'Otvoren šaht na pešačkom prelazu, veoma opasno za pešake i bicikliste.',                                                            'Žabari',       'Pijačni trg',         44.35560, 21.21410, 'solved', 12, 8),
  ('zelenilo',  'Palo drvo preko puta nakon nevremena',                       'Drvo je palo tokom olujnog vetra i potpuno preprečilo lokalni put ka selu.',                                                         'Oreovica',     'Put za Oreovicu',     44.42650, 21.20800, 'solved', 15, 13),
  ('saobracaj', 'Izbledele oznake pešačkog prelaza kod škole',                'Zebra ispred škole se skoro i ne vidi, a deca svakodnevno prelaze ulicu. Potrebno je hitno obnoviti horizontalnu signalizaciju.',   'Aleksandrovac', 'Kod osnovne škole',  44.44480, 21.21100, 'open',   3,  NULL),
  ('vodovod',   'Slab pritisak vode u gornjem delu sela',                     'Već dve nedelje voda jedva curi iz česme u domaćinstvima u gornjem delu sela. Uveče pritisak potpuno padne.',                       'Vlaški Do',    'Gornji kraj',         44.48600, 21.21250, 'open',   8,  NULL),
  ('urbana',    'Ulična svetiljka ne radi kod autobuske stanice',             'Svetiljka trepće i gasi se već nedelju dana. Putnici ujutru čekaju autobus u potpunom mraku.',                                      'Žabari',       'Autobuska stanica',   44.35600, 21.21720, 'open',   1,  NULL),
  ('ostalo',    'Napušteni psi lutalice kod prodavnice',                      'Čopor od pet-šest pasa se okuplja kod prodavnice. Deca se plaše da prođu, a bilo je i slučajeva nasrtanja na bicikliste.',           'Četereže',     'Kod prodavnice',      44.36880, 21.24300, 'open',   2,  NULL),
  ('otpad',     'Prepun kontejner se ne prazni redovno',                      'Kontejner kod doma kulture se prazni tek na dve nedelje. Smeće se prosipa okolo, a mačke i psi ga raznose po ulici.',                'Brzohode',     'Kod doma kulture',    44.36720, 21.27650, 'open',   4,  NULL),
  ('saobracaj', 'Udarne rupe na putu Porodin–Žabari',                         'Na deonici od oko kilometar ima više od deset udarnih rupa. Vozila prelaze u suprotnu traku da ih zaobiđu.',                          'Porodin',      'Put Porodin–Žabari',  44.32200, 21.22000, 'open',   10, NULL),
  ('zelenilo',  'Nepokošena trava na seoskom groblju',                        'Trava i korov su prerasli spomenike. Potrebno je organizovano košenje pre predstojeće slave.',                                       'Sibnica',      'Seosko groblje',      44.40450, 21.24950, 'open',   6,  NULL),
  ('vodovod',   'Curenje vode iz hidranta u Karađorđevoj',                    'Hidrant curi danima, voda se sliva niz ulicu i pravi led ujutru. Prijavljeno vodovodu ali niko nije izašao.',                       'Žabari',       'Karađorđeva 45',      44.35650, 21.21580, 'solved', 18, 14),
  ('urbana',    'Oštećena autobuska nadstrešnica',                            'Staklo na nadstrešnici je polomljeno i krhotine stoje pored klupe. Opasno za decu koja tu čekaju školski autobus.',                  'Mirijevo',     'Centar sela',         44.43500, 21.26980, 'open',   11, NULL),
  ('ostalo',    'Nelegalno postavljena tezga na javnoj površini',             'Tezga zauzima pola trotoara već mesec dana. Niko ne zna ko ju je postavio, a smeta i pešacima i snabdevanju prodavnice.',             'Tićevac',      'Centar',              44.46180, 21.25600, 'open',   5,  NULL),
  ('saobracaj', 'Odron zatrpao deo lokalnog puta',                            'Posle obilnih kiša zemlja i kamenje su se obrušili na put. Prohodna je samo jedna traka, bez ikakve signalizacije.',                 'Vitežovo',     'Put ka Vitežovu',     44.28320, 21.25050, 'solved', 20, 16),
  ('zelenilo',  'Suvo drvo preti da padne na dalekovod',                      'Veliko suvo drvo se nagnulo ka dalekovodu pored puta. Pri jačem vetru grane već dodiruju provodnike i varniči.',                     'Polatna',      'Pored dalekovoda',    44.42200, 21.24800, 'open',   3,  NULL),
  ('otpad',     'Spaljivanje smeća u dvorištu — širi se gust dim',            'Svako veče se u dvorištu pored škole spaljuje smeće i plastika. Dim se širi na ceo kraj i ne može da se diše.',                      'Kočetin',      'Kod škole',           44.39900, 21.29900, 'open',   2,  NULL)
) AS v(cat_id, title, description, village, address, lat, lng, status, days_ago, solved_days_ago)
WHERE NOT EXISTS (SELECT 1 FROM problems p WHERE p.title = v.title);

-- ── 2) Demo glasači (OPCIONO — preskoči ako ne želiš dodatne user redove) ───
-- password_hash NULL → nalog ne može da se uloguje; role='user' pa ga
-- guest-cleanup ne briše. Mejlovi su .local pa se ne sudaraju sa pravima.
INSERT INTO users (email, password_hash, display_name, role)
SELECT
  'demo.glasac' || n || '@example.local',
  NULL,
  (ARRAY['Milan J.','Ana P.','Dragan K.','Jelena M.','Nikola S.','Petar V.','Mira T.','Zoran D.','Sanja L.','Vlada R.','Olga N.','Saša B.'])[n],
  'user'
FROM generate_series(1, 12) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.email = 'demo.glasac' || n || '@example.local'
);

-- ── 3) Glasovi (OPCIONO — zavisi od sekcije 2) ──────────────────────────────
-- Svaki demo glasač glasa za deo prijava. Izbor je DETERMINISTIČKI (hash para
-- problem/korisnik, ne random()) da ponovni prolaz ne dodaje nove glasove —
-- ista formula uvek bira isti skup parova. Raspored ispadne ~2–11 glasova po
-- prijavi pa sortiranje "Najviše glasova" ima smisla.
INSERT INTO problem_votes (problem_id, user_id)
SELECT p.id, u.id
FROM problems p
JOIN users u ON u.email LIKE 'demo.glasac%@example.local'
WHERE p.user_id IS NULL
  AND (p.id * 7919 + u.id * 104729) % 13 < 2 + (p.id * 31) % 9
ON CONFLICT DO NOTHING;

-- ── 4) Komentari ────────────────────────────────────────────────────────────
-- "Opština" odgovori (autor: prvi admin — dobijaju zlatni bedž na sajtu).
INSERT INTO problem_comments (problem_id, user_id, body, created_at)
SELECT p.id, a.id, c.body, p.created_at + interval '1 day'
FROM (VALUES
  ('Nedostaje poklopac na šahtu kod pijace',           'Novi poklopac je postavljen. Zahvaljujemo na prijavi.'),
  ('Palo drvo preko puta nakon nevremena',             'Drvo je uklonjeno, put je ponovo prohodan.'),
  ('Odron zatrpao deo lokalnog puta',                  'Put je raščišćen i postavljena je zaštitna mreža.'),
  ('Curenje vode iz hidranta u Karađorđevoj',          'Hidrant je saniran, hvala na strpljenju.'),
  ('Poplavljena ulica posle kiše — začepljen slivnik', 'Prijava zavedena. Ekipa izlazi na teren u toku nedelje.'),
  ('Suvo drvo preti da padne na dalekovod',            'Obavešten je nadležni elektrodistributivni ogranak, seča je zakazana.')
) AS c(title, body)
JOIN problems p ON p.title = c.title
JOIN LATERAL (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1) a ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM problem_comments pc WHERE pc.problem_id = p.id AND pc.body = c.body
);

-- Komentari građana (autori: demo glasači iz sekcije 2).
INSERT INTO problem_comments (problem_id, user_id, body, created_at)
SELECT p.id, u.id, c.body, p.created_at + (c.hours_after || ' hours')::interval
FROM (VALUES
  ('Velika rupa na kolovozu u ulici Kneza Miloša',     3, 'Prošle nedelje sam probušio gumu baš tu. Hitno je.',                          6),
  ('Poplavljena ulica posle kiše — začepljen slivnik', 1, 'Isti problem je i kod pijace, treba očistiti sve slivnike u centru.',          10),
  ('Zaraslo granje na dečjem igralištu kod škole',     4, 'Molim vas rešite ovo pre raspusta, deca nemaju gde da se igraju.',             12),
  ('Divlja deponija pored puta ka groblju',            5, 'Trebalo bi postaviti kameru i tablu sa zabranom istovara.',                    20),
  ('Udarne rupe na putu Porodin–Žabari',               2, 'Autobuski prevoznik je već smanjio broj polazaka zbog stanja puta.',           15),
  ('Napušteni psi lutalice kod prodavnice',            7, 'Juče su potrčali za detetom na biciklu. Zvati zoohigijenu.',                   8),
  ('Prepun kontejner se ne prazni redovno',            6, 'Isto je i kod škole — raspored pražnjenja očigledno ne funkcioniše.',          24),
  ('Oštećena autobuska nadstrešnica',                  8, 'Staklo stoji polomljeno već drugi mesec, neko će se povrediti.',               30)
) AS c(title, voter_n, body, hours_after)
JOIN problems p ON p.title = c.title
JOIN users u ON u.email = 'demo.glasac' || c.voter_n || '@example.local'
WHERE NOT EXISTS (
  SELECT 1 FROM problem_comments pc WHERE pc.problem_id = p.id AND pc.body = c.body
);

COMMIT;

-- Brza provera:
--   SELECT status, COUNT(*) FROM problems GROUP BY status;
--   SELECT p.title, COUNT(v.user_id) AS glasova FROM problems p
--     LEFT JOIN problem_votes v ON v.problem_id = p.id
--     GROUP BY p.id ORDER BY glasova DESC LIMIT 10;
