import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "./UI";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type BranchMapEmbedProps = {
  src: string;
  title: string;
  className?: string;
};

/* ────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────── */

export function BranchMapEmbed({ src, title, className }: BranchMapEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3FBFA]">
          <MapPin className="h-3.5 w-3.5 text-[#0E7E74]" />
        </div>
        <span className="text-[12px] font-black text-slate-700">{title}</span>
        {isLoading && (
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" />
        )}
      </div>

      {/* Iframe container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0E7E74]" />
              <span className="text-[11px] font-semibold text-slate-400">
                Loading map…
              </span>
            </div>
          </div>
        )}
        <iframe
          title={title}
          src={src}
          className="h-[280px] w-full sm:h-[340px] lg:h-[420px]"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}