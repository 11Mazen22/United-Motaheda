-- =============================================================================
-- Fix generate-embeddings' persistent 401: it was gated by comparing the
-- incoming request's Authorization header against Deno.env.get(
-- "SUPABASE_SERVICE_ROLE_KEY") inside the function. That env var is
-- auto-injected by the Supabase platform and its *format* depends on which
-- key system the project is on — this project's dashboard shows the legacy
-- service-role key marked "DEPRECATED" in favor of the new JWT Signing Keys
-- / sb_secret_... format. Confirmed live via diagnostic logging: the cron
-- job's header was a correctly-built 226-char "Bearer <legacy-219-char-JWT>"
-- (pulled from the 'service_role_key' Vault secret), while
-- Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") inside the function resolved to
-- a 41-char value — the new-format key, not the legacy one. Both are
-- legitimate service-role credentials; they just don't byte-match each
-- other, so every comparison failed with 401.
--
-- Fix: stop authenticating the HTTP trigger against the service-role key at
-- all. Use a dedicated CRON_SECRET this project mints and controls on both
-- ends (a Vault secret here, and a matching Edge Function secret) so it
-- never drifts regardless of what Supabase's key system does. The
-- service-role key itself is still used inside the function only to build
-- the privileged Postgres client (createClient), which works with either
-- key format — it's simply no longer used for the HTTP auth check.
--
-- Manual one-time steps required (cannot be done from a SQL migration):
--   1. Generate a random secret value yourself (do not send it in chat).
--   2. In the SQL Editor, run:
--        select vault.create_secret('<your-random-value>', 'cron_secret');
--   3. In Dashboard -> Edge Functions -> Secrets (or via
--        `supabase secrets set CRON_SECRET=<your-random-value>`),
--      add a secret named CRON_SECRET with the SAME value.
--   4. Redeploy generate-embeddings so it picks up the new auth check:
--        supabase functions deploy generate-embeddings
-- =============================================================================

SELECT cron.unschedule('generate-embeddings-tick');

SELECT cron.schedule(
  'generate-embeddings-tick',
  '*/2 * * * *',
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
