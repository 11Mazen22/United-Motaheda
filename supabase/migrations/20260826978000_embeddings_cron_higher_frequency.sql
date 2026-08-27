-- =============================================================================
-- Neither the BATCH_SIZE 20->50 bump nor raising net.http_post's
-- timeout_milliseconds changed real throughput (measured rate stayed
-- ~15-16 items/min either way). Root cause, confirmed via a direct
-- synchronous call to the function that bypassed pg_net/pg_cron entirely:
-- the function itself gets killed by Supabase's own per-invocation
-- CPU/wall-clock execution limit after ~5 seconds, which comfortably fits
-- ~15-16 sequential embed() calls and no more — independent of what
-- BATCH_SIZE requests or how long the caller is willing to wait.
--
-- Since each invocation's throughput is a fixed ceiling regardless of
-- config, the only way to raise aggregate throughput for free is to run it
-- more often. pg_cron supports plain interval strings (not just 5-field
-- cron expressions) for sub-minute granularity. 15 seconds gives 3x the
-- tick rate of the previous 1-minute schedule, with generous headroom
-- against the ~5s worst-case invocation time (no overlap risk).
-- =============================================================================

SELECT cron.unschedule('generate-embeddings-tick');

SELECT cron.schedule(
  'generate-embeddings-tick',
  '15 seconds',
  $$
  SELECT net.http_post(
    url := 'https://gntpxffonjvnvadjclpl.supabase.co/functions/v1/generate-embeddings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
