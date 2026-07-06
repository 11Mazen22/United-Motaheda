/**
 * useSplashSequence — deterministic launch state machine.
 *
 * Owns the *logic* of the splash journey so the overlay component only renders.
 * The sequence is a strict, gated machine — a phase never begins before its
 * entry condition is met, so behaviour is identical on every device regardless
 * of how fast the video decodes:
 *
 *   brand ──(minBrandMs elapsed AND video loaded)──▶ video
 *     │                                                │
 *     │ (video never loads by loadTimeoutMs)           │ (didJustFinish / skip / error)
 *     └───────────────────────────────────────────────┴──▶ exiting ──(exitMs)──▶ done
 *
 * Guarantees:
 *   • The brand moment is ALWAYS seen (minBrandMs floor) — never skipped on fast
 *     devices, never dependent on decode speed.
 *   • The video ALWAYS starts from frame 0 (caller binds `videoShouldPlay` to the
 *     player's shouldPlay, with positionMillis 0) — never mid-stream.
 *   • The overlay can NEVER get stuck: a load timeout skips a broken video, and a
 *     safety timeout force-exits if the player's end-of-playback event never
 *     arrives (some OEM video stacks are known to drop it).
 *
 * All timing is injected, so the values live with the visual constants in the
 * component and the machine stays pure and unit-reviewable.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SplashPhase = "brand" | "video" | "exiting" | "done";

export interface UseSplashSequenceOptions {
  /** Minimum time the branded hold is shown before the video may start. */
  minBrandMs:      number;
  /** If the video has not loaded by this point, skip it and exit. */
  loadTimeoutMs:   number;
  /** Real clip length — used to arm the post-video safety timeout. */
  videoDurationMs: number;
  /** Buffer added past the clip length before force-exit. */
  safetyExtraMs:   number;
  /** Overlay fade-out duration; the machine reaches "done" after this. */
  exitMs:          number;
  /** Called once when the sequence reaches "done" (caller unmounts the overlay). */
  onExited:        () => void;
}

export interface SplashSequence {
  phase:               SplashPhase;
  /** Bind to the video's `shouldPlay`; true only once the video phase begins. */
  videoShouldPlay:     boolean;
  /**
   * Arm the sequence (idempotent). Call at the native-splash handoff — i.e. the
   * overlay's first layout — so the brand-minimum window is measured from when
   * the brand is actually visible, not from React mount (which can be a second
   * or more before the native splash lifts).
   */
  begin:               () => void;
  notifyVideoLoaded:   () => void;
  notifyVideoFinished: () => void;
  notifyVideoError:    () => void;
  skip:                () => void;
}

export function useSplashSequence(opts: UseSplashSequenceOptions): SplashSequence {
  const { minBrandMs, loadTimeoutMs, videoDurationMs, safetyExtraMs, exitMs, onExited } = opts;

  const [phase, setPhase]                     = useState<SplashPhase>("brand");
  const [videoShouldPlay, setVideoShouldPlay] = useState(false);

  // Latches + a live mirror of phase for guards inside timer callbacks.
  const brandDoneRef = useRef(false);
  const loadedRef    = useRef(false);
  const phaseRef     = useRef<SplashPhase>("brand");
  phaseRef.current   = phase;

  // Keep the latest onExited without re-arming timers.
  const onExitedRef  = useRef(onExited);
  onExitedRef.current = onExited;

  // Centralised timer bookkeeping — every scheduled callback is tracked so the
  // machine can be fully torn down on unmount with no post-unmount setState.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule  = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  const clearAll  = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const beginExit = useCallback(() => {
    if (phaseRef.current === "exiting" || phaseRef.current === "done") return;
    clearAll();
    setPhase("exiting");
    schedule(() => {
      setPhase("done");
      onExitedRef.current();
    }, exitMs);
  }, [clearAll, schedule, exitMs]);

  const enterVideo = useCallback(() => {
    if (phaseRef.current !== "brand") return;
    if (!brandDoneRef.current || !loadedRef.current) return;
    setPhase("video");
    setVideoShouldPlay(true);
    schedule(beginExit, videoDurationMs + safetyExtraMs);
  }, [schedule, beginExit, videoDurationMs, safetyExtraMs]);

  const notifyVideoLoaded = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    enterVideo();
  }, [enterVideo]);

  const notifyVideoFinished = useCallback(() => beginExit(), [beginExit]);
  const notifyVideoError    = useCallback(() => beginExit(), [beginExit]);
  const skip                = useCallback(() => beginExit(), [beginExit]);

  // Arm the two entry gates exactly once, when the caller signals the brand is
  // actually on screen (native splash handed off).
  const begunRef = useRef(false);
  const begin = useCallback(() => {
    if (begunRef.current) return;
    begunRef.current = true;
    schedule(() => { brandDoneRef.current = true; enterVideo(); }, minBrandMs);
    schedule(() => {
      if (phaseRef.current === "brand" && !loadedRef.current) beginExit();
    }, loadTimeoutMs);
  }, [schedule, enterVideo, beginExit, minBrandMs, loadTimeoutMs]);

  // Tear everything down on unmount (no post-unmount setState).
  useEffect(() => clearAll, [clearAll]);

  return { phase, videoShouldPlay, begin, notifyVideoLoaded, notifyVideoFinished, notifyVideoError, skip };
}
