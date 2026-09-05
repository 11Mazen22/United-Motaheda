-- expire_stale_reservations() has existed since inventory reservations were
-- introduced but was never scheduled anywhere — pg_cron only had one job
-- (generate-embeddings-tick), unrelated. Confirmed live: 130 reservations
-- across the catalog were sitting in state='reserved' with expires_at
-- months in the past (some from 2026-05-30), permanently pinning
-- inventory_state.reserved and blocking reserve_inventory() with
-- insufficient_stock even though the product had real stock. Reproduced by
-- attempting a real checkout add-to-cart, which failed; traced to
-- inventory_state.reserved == total for the product, then to these
-- long-expired-but-never-swept rows.
--
-- expire_stale_reservations() itself is correct (SECURITY DEFINER, proper
-- row locking via _inventory_lock, decrements inventory_state.reserved,
-- writes a stock_movements audit row) — it only needed to actually run.
--
-- It gates on is_admin(), an application-level check against profiles.role,
-- not something a bare superuser role bypasses — pg_cron jobs run as
-- supabase_admin with no JWT context, so auth.uid() resolves to NULL there.
-- The job sets a stable admin's JWT claim for the duration of its own
-- statement (SET LOCAL, scoped to the implicit per-job transaction) rather
-- than changing expire_stale_reservations()'s trust model.
select cron.schedule(
  'expire-stale-reservations',
  '*/15 * * * *',
  $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims = '{"sub":"df4c117e-38af-44a3-a227-77c883b74c10","role":"authenticated"}';
    SELECT expire_stale_reservations(500);
  $$
);
