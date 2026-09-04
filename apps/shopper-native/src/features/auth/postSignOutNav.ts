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
 * a rapid-fire burst of claims (many within the same throttle-storm window)
 * only actually navigates once. It is a *debounce*, not a permanent latch,
 * for exactly this reason: reproduced live on a real device that a
 * permanent one-shot version deadlocks the app. Sequence observed: the
 * layout claims the flag and defers to index.tsx; index.tsx's own
 * decidedTarget read hits the exact stale-role race described above and
 * sends the app straight back into (pharmacist)/_layout.tsx; that fresh
 * instance correctly re-decides it should still leave (decidedAccessRef
 * settles to false once `user` has genuinely resolved to null by then) --
 * but a permanent latch had already been spent by the first, hijacked
 * attempt, so this second, actually-necessary call silently did nothing,
 * leaving the blank placeholder <View> on screen forever with nothing left
 * to trigger a further retry (confirmed: a full app restart was the only
 * way out). A short cooldown still absorbs the original storm (many claims
 * within milliseconds of each other), while a later bounce -- which needs
 * at least a couple of macrotasks plus a full mount/decide cycle, reliably
 * tens to hundreds of ms later -- gets through. Also re-armed on the next
 * real sign-in, same as before, so a later sign-out is guarded fresh
 * regardless of the cooldown's state.
 */

const COOLDOWN_MS = 1_000;
let lastClaimAt = 0;

/** Returns true unless another caller already claimed within the last
 *  COOLDOWN_MS -- i.e. once per sign-out, but not pinned there forever if
 *  that first attempt gets hijacked before it actually lands outside the
 *  driver/pharmacist section (see module doc for the observed sequence). */
export function claimPostSignOutNavigation(): boolean {
  const now = Date.now();
  if (now - lastClaimAt < COOLDOWN_MS) return false;
  lastClaimAt = now;
  return true;
}

/** Call once a real (non-null) user is set, so the next sign-out is guarded fresh. */
export function rearmPostSignOutNavigation(): void {
  lastClaimAt = 0;
}
