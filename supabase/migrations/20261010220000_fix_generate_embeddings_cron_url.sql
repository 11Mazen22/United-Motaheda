-- pg_cron job 8 ("generate-embeddings-tick") has been calling the old,
-- decommissioned self-hosted instance every 15 seconds:
--   https://envoy-production-1cbe.up.railway.app/functions/v1/generate-embeddings
-- Confirmed live via cron.job -- this is a real, active server-side leftover
-- from before the production migration, not just a stale client-side cache
-- (the separate stale AsyncStorage session found on a test device is a
-- distinct, client-only artifact). The generate-embeddings function is
-- confirmed ACTIVE on the current project (gntpxffonjvnvadjclpl), so this
-- job has been silently failing against a dead/wrong host every 15 seconds
-- since the migration -- meaning embeddings have not been auto-refreshed on
-- schedule, and each failed call holds its own 10s timeout window.

SELECT cron.alter_job(
  job_id := 8,
  command := $cron$
  SELECT net.http_post(
    url := 'https://gntpxffonjvnvadjclpl.supabase.co/functions/v1/generate-embeddings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);
