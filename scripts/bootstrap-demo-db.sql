-- =====================================================================
-- bootstrap-demo-db.sql
-- ---------------------------------------------------------------------
-- Pravi izolovanu rolu + bazu za demo deploy (demo.zabari.net), na istom
-- Postgres serveru koji vec hostuje produkciju.
--
-- Pokreni kao superuser (postgres role) na produkcijskoj Postgres instanci.
-- Preporuceno: Coolify -> tvoj managed Postgres resource -> Terminal/Console.
--
-- PRE pokretanja: zameni 'REPLACE_ME_STRONG_PASSWORD' jakom lozinkom
-- (npr. `openssl rand -base64 32`). Tu lozinku stavljas u DATABASE_URL
-- demo aplikacije u Coolify-u.
-- =====================================================================

-- 1) Nova rola sa LOGIN pravom.
CREATE ROLE zabari_demo WITH LOGIN PASSWORD 'SomeStrongPasswordHere';

-- 2) Nova baza, vlasnik = nova rola. Vlasnistvo je vazno jer migrate.ts radi
--    CREATE TABLE / CREATE INDEX iz aplikacije; vlasnik to moze bez extra GRANT-ova.
CREATE DATABASE zabari_demo OWNER zabari_demo;

-- 3) Konektuj se na novu bazu i zategni privilegije na public schemi.
--    Na Postgres 15+ ovo je no-op (vlasnik bi vec imao sve), ali ne smeta.
--    NAPOMENA: \c je psql meta-komanda. Ako pokreces ovo iz web SQL runner-a
--    koji ne podrzava \c, izvrsi sledece dve linije zasebno nakon sto se
--    rekonektujes na bazu zabari_demo kao superuser.
\c zabari_demo
GRANT ALL ON SCHEMA public TO zabari_demo;
ALTER SCHEMA public OWNER TO zabari_demo;

-- =====================================================================
-- Provera (opciono, kao superuser):
--   \l zabari_demo
--   \du zabari_demo
-- =====================================================================
