-- =============================================================================
-- generate-embeddings-tick was still calling the OLD, pre-migration Supabase
-- Cloud project's edge function URL (gntpxffonjvnvadjclpl.supabase.co) --
-- written on 2026-08-26, before the 2026-08-29 cutover to a self-hosted
-- Supabase stack on Railway, and never updated afterward. It kept silently
-- succeeding this whole time because that old Cloud project was never
-- actually decommissioned and stayed reachable -- meaning production has
-- had an undocumented runtime dependency on an account nobody intended to
-- keep using, discovered 2026-09-05 while auditing which accounts a new
-- engineer actually needs access to.
--
-- Confirmed via a direct curl call (before writing this migration) that the
-- self-hosted Envoy gateway's own generate-embeddings deployment already
-- has a matching CRON_SECRET configured and responds 200 with the same
-- vault cron_secret value used below -- this is a pure repoint, not a new
-- deployment.
-- =============================================================================

SELECT cron.unschedule('generate-embeddings-tick');

SELECT cron.schedule(
  'generate-embeddings-tick',
  '15 seconds',
  $$
  SELECT net.http_post(
    url := 'https://envoy-production-1cbe.up.railway.app/functions/v1/generate-embeddings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
