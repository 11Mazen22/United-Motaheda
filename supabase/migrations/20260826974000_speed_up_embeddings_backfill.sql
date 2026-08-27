-- =============================================================================
-- Speed up the embeddings backfill (8k+ products, was ~17/tick every 2 min —
-- ~16h to converge). Each product is written individually inside
-- generate-embeddings' loop (set_product_embedding per row, not one wrapping
-- transaction), so a longer/larger batch degrades gracefully: a slow or
-- timed-out invocation just leaves the remainder for the next tick rather
-- than losing already-completed work. Safe to raise both knobs together:
--   - BATCH_SIZE 20 -> 50 in the function itself (still well under
--     products_pending_embedding's hard cap of 200).
--   - cron interval 2 min -> 1 min (finest standard 5-field cron
--     granularity — avoids pg_cron's separate sub-minute interval syntax
--     for no real benefit here).
-- Combined ~5x throughput, dropping the estimated backfill to ~3 hours.
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
    body := '{}'::jsonb
  );
  $$
);
