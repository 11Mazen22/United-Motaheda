-- Backfill: an account can have profiles.role = 'driver' (settable directly
-- from shopper-web's UsersManager.tsx with zero vetting -- a known gap) with
-- no corresponding DriverProfile row, since that row is normally only ever
-- created by the real driver-application + admin-approval flow
-- (approveDriver() in admin-operations.service.ts). The native app's
-- (driver)/_layout.tsx gate correctly requires BOTH role='driver' AND a live
-- DriverProfile before granting access -- with no profile row, it correctly
-- (if silently) bounces the account to the customer tabs. That's not a bug;
-- it's a driver account that was never actually onboarded.
--
-- Confirmed live for edrakmaze@gmail.com: role='driver', zero DriverProfile
-- rows. This creates one, approved, so the account can actually reach the
-- driver interface. Safe to re-run -- ON CONFLICT (userId) does nothing if
-- a row already exists.
insert into public."DriverProfile" (
  "userId", "vehicleType", status, "approvedAt"
)
select p.id, 'motorcycle', 'APPROVED', now()
from public.profiles p
where p.email = 'edrakmaze@gmail.com'
  and p.role = 'driver'
on conflict ("userId") do nothing;
