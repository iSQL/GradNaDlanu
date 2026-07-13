-- ============================================================================
-- Kreira login rolu sa READ/WRITE pristupom ISKLJUČIVO nad bazom zabari_demo.
--
-- Pokretanje (kao superuser ili vlasnik baze, npr. postgres):
--   psql "postgres://postgres:...@host:5432/postgres" -f scripts/create-demo-rw-role.sql
--
-- PRE pokretanja zameni lozinku ispod (PROMENI-ME). Ako ti se baza ne zove
-- 'zabari_demo', zameni ime na svim mestima (i u \connect liniji).
--
-- Šta rola SME: connect na zabari_demo, SELECT/INSERT/UPDATE/DELETE na sve
-- postojeće I BUDUĆE tabele u schema public, korišćenje sekvenci (serial id).
-- Šta NE SME: DDL (CREATE/DROP/ALTER — migracije i dalje idu kroz app rolu),
-- TRUNCATE, pristup drugim bazama na istom serveru.
-- ============================================================================

-- 1) Rola (idempotentno — preskače ako već postoji).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zabari_demo_rw') THEN
    CREATE ROLE zabari_demo_rw LOGIN PASSWORD 'PROMENI-ME' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 2) Pristup samo ovoj bazi.
-- VAŽNO: Postgres po default-u daje PUBLIC-u CONNECT na svaku bazu, pa sama
-- GRANT CONNECT ovde ne "zaključava" ostale baze. Da rola stvarno ne može na
-- druge baze, mora se PUBLIC-u oduzeti CONNECT na NJIMA (odkomentariši i
-- prilagodi imena — pazi: to utiče na sve role bez eksplicitnog granta!):
--   REVOKE CONNECT ON DATABASE postgres      FROM PUBLIC;
--   REVOKE CONNECT ON DATABASE neka_druga_db FROM PUBLIC;
GRANT CONNECT ON DATABASE zabari_demo TO zabari_demo_rw;

-- 3) Prava unutar baze — mora da se izvrši POVEZAN NA zabari_demo.
\connect zabari_demo

GRANT USAGE ON SCHEMA public TO zabari_demo_rw;

-- Postojeće tabele i sekvence.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zabari_demo_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zabari_demo_rw;

-- BUDUĆE tabele/sekvence: default privilegije važe za objekte koje kreira
-- rola koja izvršava ovaj skript (superuser). Pošto migracije na demo serveru
-- pokreće APP rola (vlasnik tabela), dodaj i FOR ROLE varijantu — zameni
-- 'zabari_demo_app' imenom role kojom se aplikacija povezuje (vlasnik tabela;
-- proveri sa: SELECT tableowner FROM pg_tables WHERE schemaname='public' LIMIT 1).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zabari_demo_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO zabari_demo_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE zabari_demo_app IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zabari_demo_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE zabari_demo_app IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO zabari_demo_rw;

-- 4) Provera.
--   \du zabari_demo_rw
--   Test konekcije:  psql "postgres://zabari_demo_rw:LOZINKA@host:5432/zabari_demo" -c "SELECT COUNT(*) FROM problems"
--   Test da DDL ne prolazi (očekuje se "permission denied"):
--   psql "...zabari_demo_rw..." -c "CREATE TABLE proba(x int)"
