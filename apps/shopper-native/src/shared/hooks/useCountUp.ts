import { useEffect, useRef, useState } from "react";

/**
 * Animates a displayed number from its last settled value to `target`,
 * eased out. Starts from 0 on first mount, then continues from wherever it
 * last landed on every later change (e.g. switching a filter), rather than
 * resetting to 0 each time.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;

    let raf: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress >= 1) {
        setValue(target);
        fromRef.current = target;
        return;
      }
      setValue(from + (target - from) * eased);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
