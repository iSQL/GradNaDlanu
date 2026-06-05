-- =====================================================================
-- reset-demo-password.sql
-- ---------------------------------------------------------------------
-- Postavlja novu lozinku za zabari_demo rolu. Pokreni kao superuser
-- (postgres) na Coolify Postgres terminalu, ili kao zabari_demo (rola
-- moze da menja sopstvenu lozinku).
--
-- PRE pokretanja: zameni 'REPLACE_ME_STRONG_PASSWORD'. Generisi je
-- npr. sa `openssl rand -base64 32`.
--
-- POSLE pokretanja: ne zaboravi da apdejtujes DATABASE_URL u Coolify
-- env-u demo aplikacije (lozinka mora da matchuje), pa redeploy.
-- =====================================================================

ALTER ROLE zabari_demo WITH PASSWORD 'REPLACE_ME_STRONG_PASSWORD';

-- Provera (kao superuser): u psql ukucaj `\du zabari_demo` — videces
-- atribute role, ali NE i hash lozinke. Da testiras logovanje:
--   psql "postgres://zabari_demo:NEW_PASSWORD@<host>:5432/zabari_demo" -c '\conninfo'
