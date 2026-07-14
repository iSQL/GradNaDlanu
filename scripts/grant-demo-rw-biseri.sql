-- ============================================================================
-- Dograni GRANT za "Zaboravljeni biseri" tabele koje su dodate posle poslednjeg
-- pokretanja create-demo-rw-role.sql — zabari_demo_rw trenutno nema pristup
-- (SELECT/INSERT/UPDATE/DELETE) na biseri / biser_likes / biser_comments.
--
-- Pokretanje (kao superuser ili vlasnik baze, povezan na zabari_demo):
--   psql "postgres://postgres:...@host:5432/zabari_demo" -f scripts/grant-demo-rw-biseri.sql
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON biseri, biser_likes, biser_comments TO zabari_demo_rw;
GRANT USAGE, SELECT ON biseri_id_seq, biser_comments_id_seq TO zabari_demo_rw;
