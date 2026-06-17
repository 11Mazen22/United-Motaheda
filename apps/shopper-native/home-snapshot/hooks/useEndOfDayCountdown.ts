import { useEffect, useState } from "react";

interface Countdown { h: string; m: string; s: string }

function getMsToMidnight(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 0);
  return Math.max(0, end.getTime() - now.getTime());
}

function pad(n: number): string { return String(n).padStart(2, "0"); }

export function useEndOfDayCountdown(): Countdown {
  const [ms, setMs] = useState(getMsToMidnight);

  useEffect(() => {
    const id = setInterval(() => setMs(getMsToMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  return { h: pad(Math.floor(ms / 3_600_000)), m: pad(Math.floor((ms % 3_600_000) / 60_000)), s: pad(Math.floor((ms % 60_000)   / 1_000)), };
}
