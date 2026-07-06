-- =============================================================================
-- Migration: Fix has_permission() crashing on missing resolve_permissions(uuid)
-- Date: 2026-07-05
--
-- Root cause: public.has_permission(p_permission_key, p_user_id) falls through to
--   `select ... from public.resolve_permissions(p_user_id) ...`
-- for any caller that isn't a manager/admin. public.resolve_permissions(uuid) was
-- never created (no role_templates table backs it, and it is not wired to any UI
-- anywhere in the codebase). Every RLS policy that calls has_permission() therefore
-- raises "function public.resolve_permissions(uuid) does not exist" (42883)
-- whenever the is_manager() short-circuit inside has_permission() doesn't cover it:
--
--   - public.profiles "Profiles select" is a plain SQL OR-expression
--     ((auth.uid() = id) OR is_manager() OR has_permission(...)) — Postgres does not
--     guarantee OR clauses short-circuit in source order, so this can (and does, per
--     a manager's live console log) blow up on ordinary profile reads. Because
--     public.orders / public.order_items policies subquery public.profiles
--     internally, this cascades into 404s on orders and order_items too.
--   - public.inventory "Inventory read/insert/update staff" and public.products
--     "Products insert/update/delete staff" call has_permission() with no
--     is_manager() fallback at the SQL level at all, so any non-manager staff
--     role trying to write inventory/products crashes outright.
--   - public.integration_events "Integration events staff read" is similarly at
--     risk for non-managers.
--
-- Fix: has_permission() now simply returns is_manager(p_user_id). There is no
-- granular permission-management UI or role_templates table anywhere in this
-- codebase (resolvePermissions()/listRoleTemplates() in logisticsApi.ts are
-- unused dead exports — grep confirms zero callers), so "permission granted" and
-- "is manager/admin" are equivalent today. This is a no-op for managers/admins
-- (already true via the existing short-circuit) and turns a hard crash into a
-- safe `false` deny for every other role. All statements are idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public.is_manager(p_user_id);
end;
$function$;

-- ─── Consolidate public.profiles RLS ─────────────────────────────────────────
-- profiles has accumulated 7 overlapping policies from prior ad-hoc dashboard
-- edits (duplicate owner-select/insert/update policies plus the has_permission
-- -gated ones fixed above). Drop all and rebuild 3 clean policies with the same
-- effective access, following the same nuclear-rebuild pattern already used for
-- orders/order_items in 20260602_fix_orders_rls.sql.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END;
$$;

CREATE POLICY profiles_select
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR is_manager());

CREATE POLICY profiles_insert
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR is_manager());

CREATE POLICY profiles_update
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR is_manager())
  WITH CHECK (auth.uid() = id OR is_manager());

-- ─── Done ─────────────────────────────────────────────────────────────────────
