/**
 * Module-level (not component-instance) guard for the "leave the driver/
 * pharmacist section after sign-out" navigation.
 *
 * (driver)/_layout.tsx and (pharmacist)/_layout.tsx each already guard their
 * own router.replace("/") call with a per-instance ref so a single mounted
 * instance never fires it twice. That's not enough on its own: reproduced
 * live (web) that after a sign-out, a slow trickle of aborted `HEAD /`
 * requests and climbing "Throttling navigation" warnings kept going well
 * past 10+ seconds even with those per-instance guards in place -- which
 * only makes sense if the layout itself is being remounted (a fresh
 * instance gets a fresh ref, so the guard doesn't survive the remount).
 * The most likely driver is a stale/queued onAuthStateChange callback
 * (already in flight before signOut() was called) racing the SIGNED_OUT
 * event and briefly restoring a non-null `user` with the old role, which
 * would send index.tsx back into (driver)/(pharmacist) for one more mount
 * before the real sign-out state lands -- each such bounce re-triggers a
 * "leave" decision from a brand-new component instance.
 *
 * This flag survives remounts (it's module state, not component state), so
 * once any instance claims the transition, no later remount can re-fire
 * it -- regardless of how many more bounces the underlying auth-state race
 * produces. Re-armed on the next real sign-in so a later sign-out is
 * guarded fresh.
 */

let hasNavigatedAwayThisSignOut = false;

/** Returns true only for the first caller since the last sign-in (or app start). */
export function claimPostSignOutNavigation(): boolean {
  if (hasNavigatedAwayThisSignOut) return false;
  hasNavigatedAwayThisSignOut = true;
  return true;
}

/** Call once a real (non-null) user is set, so the next sign-out is guarded fresh. */
export function rearmPostSignOutNavigation(): void {
  hasNavigatedAwayThisSignOut = false;
}
