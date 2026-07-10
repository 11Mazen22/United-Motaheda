-- Migration: fix staff-triggered notification inserts - 2026-07-10
--
-- Bug: apps/shopper-web/src/services/orderNotificationsApi.ts's insertNotification()
-- — the single shared chokepoint for all 6 automated notification triggers
-- (order status, payment status, driver assigned/unassigned, issue resolved)
-- — does a plain client-side .insert() into public.notifications on behalf of
-- a DIFFERENT user (the customer or driver being notified). The existing
-- policy "Admins can insert notifications for any user" checks
-- `EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND
-- profiles.role = ANY(...))` directly inside the INSERT's WITH CHECK clause
-- (not security definer) — confirmed via direct simulation that this
-- EXISTS check evaluates correctly as a standalone SELECT but still fails
-- when embedded in the live INSERT's RLS enforcement, so the insert is
-- rejected (42501) even for a genuine admin/manager caller. First observed
-- when assigning a driver to an order: the assignment itself succeeds
-- (that path is already on the correct Supabase-backed logisticsApi.ts,
-- unrelated to this table), but notifyDriverAssigned()'s notification
-- insert silently fails, so the driver is never actually alerted.
--
-- Fix: route the insert through a SECURITY DEFINER function instead of
-- relying on the in-policy subquery. Reuses the already-proven
-- public.is_manager() (see database/20260710_admin_role_rpcs.sql, verified
-- working live in StaffManager/UsersManager this session) rather than
-- re-deriving the same admin/manager check a third way.

create or replace function public.insert_staff_notification(
  p_user_id uuid,
  p_type text,
  p_category text,
  p_title text,
  p_body text,
  p_data jsonb,
  p_action_url text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if not public.is_manager() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into public.notifications (user_id, type, category, title, body, data, action_url, is_read)
  values (p_user_id, p_type, p_category, p_title, p_body, p_data, p_action_url, false)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_staff_notification(uuid, text, text, text, text, jsonb, text) to authenticated;

-- ─── Done ─────────────────────────────────────────────────────────────────────
