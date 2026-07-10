-- Migration: make is_admin() SECURITY DEFINER - 2026-07-10
--
-- Bug-hunt audit finding (after fixing the notifications RLS bug): is_admin()
-- was NOT security definer, unlike is_manager() (which is, and is the exact
-- function that fixed notifications by letting the permission check read
-- profiles without being subject to profiles' own RLS during evaluation).
-- is_admin() is called directly inside ~14 other tables' RLS policies
-- (anti_fraud_events, coupon_batches, coupons, gift_catalog,
-- gift_redemptions, inventory_reservations, loyalty_accounts, loyalty_ledger,
-- referral_codes, referral_rewards, reward_audit_logs, reward_campaigns,
-- reward_idempotency_keys, reward_rules, stock_movements) — all of them
-- inherit the same risk class that broke notifications.
--
-- This is a same-body, additive-only change: SECURITY DEFINER only changes
-- HOW the internal `select ... from profiles` is evaluated (bypassing
-- profiles' RLS instead of being subject to it), not the logic itself — a
-- caller who wasn't admin before still isn't admin after. It can only fix
-- false negatives, never grant anything new.

create or replace function public.is_admin(p_user_id uuid default null::uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = coalesce(p_user_id, auth.uid())
      and role = 'admin'
  );
$$;

-- ─── Done ─────────────────────────────────────────────────────────────────────
