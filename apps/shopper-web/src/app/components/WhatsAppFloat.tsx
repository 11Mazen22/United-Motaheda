import { useRef, useState } from "react";
import { MessageCircle } from "lucide-react";

/**
 * WhatsAppFloat — bottom-center line that springs into a button on hover.
 *
 * Resting state : a thin green pill-line (80×6 px) at the very bottom of
 *                 the viewport, breathing gently to draw attention.
 * Hover / focus : morphs upward with a spring-bounce into a full button
 *                 (210×52 px), icon + label slide up into view.
 * Blur / leave  : snaps back to a line with a fast ease-in.
 */
export function WhatsAppFloat({
  url,
  isArabic,
  hidden = false,
}: {
  url: string;
  isArabic: boolean;
  hidden?: boolean;
}) {
  const [on, setOn] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (hidden) return null;

  // Small debounce on mouse-leave so accidental micro-exits don't jitter
  const open  = () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); setOn(true); };
  const close = () => { leaveTimer.current = setTimeout(() => setOn(false), 60); };

  return (
    /* Outer wrapper — taller than the visual line to give a bigger hover target */
    <div
      className="fixed bottom-0 left-1/2 z-[80] -translate-x-1/2"
      style={{ paddingTop: on ? 0 : 20 }}   /* invisible hover extension above the line */
      onMouseEnter={open}
      onMouseLeave={close}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onFocus={open}
        onBlur={close}
        aria-label={isArabic ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
        className={`
          relative flex items-center justify-center overflow-hidden bg-[#22C55E]
          ${!on ? "animate-wa-breathe" : ""}
        `}
        style={{
          /* ── SIZE ── */
          width:        on ? 210 : 80,
          height:       on ? 52  : 6,
          borderRadius: on ? "28px 28px 0 0" : "4px 4px 0 0",

          /* ── GLOW ── */
          boxShadow: on
            ? "0 -14px 52px rgba(34,197,94,0.60), 0 -4px 18px rgba(34,197,94,0.35)"
            : "none",

          /* ── TRANSITION ──
             Expand:  spring overshoot (P1y=1.56 > 1)  — powerful pop-up
             Collapse: fast deceleration — snaps back cleanly              */
          transitionProperty:      "width, height, border-radius, box-shadow",
          transitionDuration:       on ? "0.52s, 0.52s, 0.40s, 0.35s"         : "0.28s, 0.28s, 0.22s, 0.22s",
          transitionTimingFunction: on
            ? "cubic-bezier(0.34,1.56,0.64,1), cubic-bezier(0.34,1.56,0.64,1), ease, ease"
            : "cubic-bezier(0.32,0,0.67,0),   cubic-bezier(0.32,0,0.67,0),   ease, ease",
        }}
      >
        {/* ── LABEL — slides up + fades in after the pill starts expanding ── */}
        <span
          className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-black text-white"
          style={{
            opacity:   on ? 1 : 0,
            transform: on ? "translateY(0) scale(1)" : "translateY(12px) scale(0.90)",
            transition: on
              ? "opacity 0.22s ease 0.18s, transform 0.34s cubic-bezier(0.34,1.56,0.64,1) 0.14s"
              : "opacity 0.10s ease, transform 0.12s ease",
          }}
        >
          <MessageCircle className="h-5 w-5 shrink-0" />
          {isArabic ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
        </span>
      </a>
    </div>
  );
}
