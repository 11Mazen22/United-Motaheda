/**
 * splashBridge — one-way event from SplashOverlay to HomeScreen.
 *
 * Fires once per cold launch (JS module lifetime). Enables the HomeScreen
 * to delay its entrance animations until the splash has fully exited,
 * creating a seamless cinematic handoff rather than content flashing
 * underneath the splash while it plays.
 *
 * Usage:
 *   SplashOverlay:  notifySplashExited()  in onExited callback
 *   HomeScreen:     onSplashExited(fn)    in useEffect
 */

const _listeners = new Set<() => void>();
let _fired = false;

/** Call once from SplashOverlay's onExited. Idempotent. */
export function notifySplashExited(): void {
  if (_fired) return;
  _fired = true;
  _listeners.forEach((fn) => fn());
  _listeners.clear();
}

/**
 * Subscribe to the splash-exit event.
 * If the splash already exited, `fn` is scheduled immediately (next tick).
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function onSplashExited(fn: () => void): () => void {
  if (_fired) {
    const id = setTimeout(fn, 0);
    return () => clearTimeout(id);
  }
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
