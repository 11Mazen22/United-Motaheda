-- =============================================================================
-- The BATCH_SIZE 20->50 bump in the previous migration didn't actually raise
-- throughput (measured real rate stayed ~15-16 items/tick either way).
-- Root cause: net.http_post's own `timeout_milliseconds` defaults to 5000ms.
-- Once that elapses, pg_net gives up waiting AND tears down the connection —
-- which kills the still-running generate-embeddings invocation with it,
-- since it never detaches via EdgeRuntime.waitUntil(). At ~300ms/item, 5
-- seconds caps every tick at ~15-16 products no matter what BATCH_SIZE asks
-- for, which is exactly what was observed (net._http_response rows for
-- recent ticks sitting permanently null — the connection was dropped before
-- a response could ever be recorded, even though the writes that did
-- complete before the cutoff succeeded).
--
-- Fix: explicitly raise timeout_milliseconds well above what a 50-item
-- batch needs (~50 * 300ms ~= 15s), with margin, while staying comfortably
-- under the 1-minute tick interval so invocations don't overlap.
-- =============================================================================

SELECT cron.unschedule('generate-embeddings-tick');

SELECT cron.schedule(
  'generate-embeddings-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gntpxffonjvnvadjclpl.supabase.co/functions/v1/generate-embeddings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
