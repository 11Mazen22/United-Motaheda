-- notification_tokens is the canonical store for Expo push tokens (decided
-- 2026-09-10): both senders that actually deliver push (the Supabase Edge
-- Function notification-worker, whose own README says it's "deliberately
-- the only component that contacts Expo's push API", and apps/api's
-- NotificationWorker) already read from here -- but no current client code
-- wrote to it, so no freshly-registered device could ever receive a push.
-- pushNotificationService is being repointed here from user_devices
-- (apps/shopper-native/src/services/pushNotificationService.ts).
--
-- Two things block a clean upsert-by-token going forward:

-- 1. Three existing tokens each have two rows under different user_ids --
--    confirmed live: the same physical token re-registered under a
--    different account, minutes to hours apart, with the earlier
--    registration's row never reassigned or removed. That's the exact
--    failure mode an upsert keyed on expo_push_token prevents going
--    forward (a fresh registration REPLACES the previous owner's row
--    instead of leaving both live) -- this migration finishes that by
--    resolving the 3 that already exist: keep only the most-recently-
--    created row per token (the same "last registration wins" rule the
--    upsert itself will enforce from now on), drop the other.
delete from public.notification_tokens t
where exists (
  select 1 from public.notification_tokens newer
  where newer.expo_push_token = t.expo_push_token
    and (newer.created_at, newer.id) > (t.created_at, t.id)
);

-- 2. No unique constraint exists on expo_push_token, so
--    .upsert(..., { onConflict: 'expo_push_token' }) has nothing to
--    target (confirmed live: fails with "no unique or exclusion
--    constraint matching the ON CONFLICT specification").
create unique index if not exists notification_tokens_expo_push_token_key
  on public.notification_tokens (expo_push_token);
