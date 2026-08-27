-- =============================================================================
-- Product Intelligence — Stage 4 (continued): schedule generate-embeddings
-- Date: 2026-08-26
--
-- Without this, someone would have to remember to manually invoke
-- generate-embeddings every time a product is added or edited — not
-- production-quality. This schedules it to run automatically every 2
-- minutes via pg_cron + pg_net, both of which are Supabase-managed Postgres
-- extensions (no external service).
--
-- OPTIONAL, one-time manual step required before this actually works: store
-- this project's service-role key in Supabase Vault (never inline a secret
-- in a migration file / git history):
--
--   select vault.create_secret('<paste-the-service-role-key-here>', 'service_role_key');
--
-- Run that once in the Supabase SQL Editor. Until it's done, this cron job
-- will fire every 2 minutes and get a 401 from generate-embeddings — harmless
-- (search itself is completely unaffected either way; embeddings just won't
-- backfill until the secret is set). If your plan doesn't have pg_cron/pg_net
-- available, skip this migration entirely and instead call
-- `supabase functions invoke generate-embeddings` manually/periodically —
-- everything else in this system works identically without it.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'generate-embeddings-tick',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gntpxffonjvnvadjclpl.supabase.co/functions/v1/generate-embeddings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
