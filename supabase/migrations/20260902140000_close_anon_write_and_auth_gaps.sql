-- Closes a set of critical, live, anonymously-exploitable gaps found during
-- a full RLS/RBAC audit run against the production database. Every item
-- below was verified against the LIVE database (policies, grants, function
-- bodies) and cross-checked against actual callers in this repo before
-- being touched -- nothing here is a guess. See the audit's findings for
-- full detail; this migration implements the "confirmed real issue" rows.
--
-- Ordered roughly worst-first.

-- ── 1. products: RLS was disabled entirely. anon held DELETE/UPDATE/INSERT/
-- TRUNCATE with zero row filtering -- anyone with just the public anon key
-- (embedded in every client build by design) could rewrite prices, flip
-- requires_prescription off, or wipe the catalog outright. Confirmed no
-- client anywhere writes to products directly (grepped apps/**/*.ts for
-- .from("products").insert/update/upsert/delete -- zero matches); every
-- legitimate write goes through apps/api, which connects as supabase_admin
-- over a direct Postgres connection and never goes through PostgREST/RLS
-- at all -- so this is a pure hole-close with no legitimate path affected.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select_all
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY products_write_staff
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- ── 2. execute_order_cancellation: a signature change (CREATE OR REPLACE
-- with a different parameter list) left the OLD 6-param overload live
-- alongside the new, correctly-guarded 4-param one instead of replacing it
-- -- a classic Postgres gotcha. The old overload trusts a client-supplied
-- p_actor_type/p_actor_id with zero auth.uid() check, and its guard
-- ("IF NOT v_can_cancel AND p_actor_type != 'admin'") is trivially
-- defeated by just passing p_actor_type: 'admin'. Confirmed dead: the real
-- caller (supabase/functions/cancel-order/index.ts) already calls the safe
-- 4-param version exclusively, and no other tracked code calls this
-- function by name at all.
DROP FUNCTION IF EXISTS public.execute_order_cancellation(uuid, text, uuid, text, text, text);

-- ── 3. transition_return_status: zero auth.uid() check, trusts client-
-- supplied p_actor_type/p_actor_id completely -- lets anyone push any
-- return through the full state machine and insert a real refunds row.
-- Confirmed the ONLY real caller (supabase/functions/process-return)
-- already authenticates the user, looks up their real role from profiles
-- via its own service-role client, and enforces isStaff/actorType checks
-- BEFORE calling this RPC using ITS OWN service-role client -- meaning the
-- edge function is the actual authorization boundary and this RPC was
-- only ever meant to be reached through it. Restricting EXECUTE to
-- service_role closes the direct-call bypass without touching that flow
-- at all (it already calls in as service_role).
REVOKE EXECUTE ON FUNCTION public.transition_return_status(uuid, return_status, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_return_status(uuid, return_status, text, uuid, text, jsonb) TO service_role;

-- ── 4. claim_notification_outbox: zero auth check on a function that
-- claims + locks pending notification jobs and returns their full payload
-- (recipient_id, title, body, data -- 123 rows queued at audit time). Only
-- ever meant to be polled by a trusted background worker using the
-- service-role key. No client-side caller exists (grepped -- none).
REVOKE EXECUTE ON FUNCTION public.claim_notification_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(integer) TO service_role;

-- ── 5. get_orders_dashboard: zero auth check, leaks total order count +
-- total revenue + 30-day daily sales to any caller. UNLIKE the two above,
-- this genuinely is called by a real authenticated browser session --
-- apps/shopper-web's adminDashboardApi.getSupabaseDashboardStats() calls
-- it directly with the logged-in user's own JWT -- so it can't be
-- restricted to service_role without breaking that dashboard. Converted
-- from `language sql` to `language plpgsql` purely to add the is_manager()
-- gate; the query logic itself is untouched.
CREATE OR REPLACE FUNCTION public.get_orders_dashboard()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    select json_build_object(
      'total_orders', (
        select count(*)::int from public.orders
      ),
      'total_sales', (
        select coalesce(sum(total), 0)::float from public.orders
      ),
      'orders_by_day', (
        select coalesce(json_agg(d order by d.day), '[]'::json)
        from (
          select
            (created_at at time zone 'Africa/Cairo')::date::text as day,
            count(*)::int                                         as orders,
            coalesce(sum(total), 0)::float                        as sales
          from public.orders
          where created_at >= now() - interval '30 days'
          group by (created_at at time zone 'Africa/Cairo')::date
        ) d
      )
    )
  );
END;
$$;

-- ── 6. notifications_insert_admin: trusted a self-editable JWT claim.
-- auth user_metadata (as opposed to app_metadata) can be set by any user
-- themselves via the standard Supabase Auth updateUser()/signup `data`
-- field -- so any signed-up user could set user_metadata.role = 'admin'
-- on their own account and pass this check, letting them insert forged
-- notifications into any other user's feed (a phishing vector). Every
-- other policy in this schema correctly checks profiles.role instead;
-- this one just didn't match that pattern.
DROP POLICY IF EXISTS notifications_insert_admin ON public.notifications;
CREATE POLICY notifications_insert_admin
  ON public.notifications FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_manager()
  );

-- ── 7. DeliveryZone, NotificationToken, Branch, NotificationLog: RLS
-- disabled, full anon/authenticated CRUD, zero policies. Confirmed no
-- client anywhere reads or writes any of these four via supabase-js
-- (grepped .from("<table>") across apps/** -- zero matches for all four);
-- everything that touches them goes through apps/api's service-role
-- Postgres connection, which never passes through RLS. Enabling RLS with
-- no policies makes them deny-by-default for anon/authenticated (the same
-- pattern already used correctly elsewhere in this schema) without adding
-- any policy that could accidentally be wrong -- if a real client-side use
-- case shows up later, a scoped policy can be added then.
ALTER TABLE public."DeliveryZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationLog" ENABLE ROW LEVEL SECURITY;

-- ── 8. create_checkout_order, record_coupon_redemption: no auth.uid()
-- binding on p_user_id (order/redemption impersonation), and
-- create_checkout_order computes its total purely from client-supplied
-- unit_price in p_cart_lines (price tampering). Confirmed ZERO callers
-- anywhere in this repo (grepped apps/** and supabase/functions/** for
-- both names -- no matches) -- the real order-creation path is the
-- create-order edge function, which does not call either of these.
-- These read as an earlier, abandoned checkout implementation
-- (create_checkout_order hardcodes source: 'shopper_web'). Revoking
-- EXECUTE from anon/authenticated closes the hole; nothing currently
-- calls them so nothing breaks. Flagged for the team to confirm dead and
-- drop outright, rather than dropping unilaterally here.
REVOKE EXECUTE ON FUNCTION public.create_checkout_order(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_coupon_redemption(text, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

-- ── 9. Internal loyalty/inventory helpers (leading underscore = "not a
-- public entry point" by this codebase's own naming convention) were
-- directly EXECUTE-able by anon/authenticated. These are only meant to be
-- called FROM WITHIN other SECURITY DEFINER functions -- an internal call
-- like that always works regardless of the original client's own grants,
-- since it runs with the calling function's privileges, not the original
-- caller's. Revoking direct access here is pure least-privilege cleanup;
-- every legitimate call path is a function calling these internally, none
-- of which are affected by revoking the *direct* grant.
REVOKE EXECUTE ON FUNCTION public._inventory_ensure_state(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._inventory_lock(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_audit(uuid, text, text, boolean, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_ensure_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_idempotency_begin(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_idempotency_end(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_lock_idem(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._loyalty_recompute_tier(bigint) FROM PUBLIC, anon, authenticated;
