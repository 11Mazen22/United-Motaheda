import { useCallback, useMemo } from "react";
import { MapPin, Navigation } from "lucide-react";
import { cn } from "./UI";
import type { SiteLocation } from "../data";

/* ────────────────────────────────────────────────────────────
   Types & Constants
   ──────────────────────────────────────────────────────────── */

type BranchMapProps = {
  locations: readonly SiteLocation[];
  selectedBranchId: string;
  isArabic: boolean;
  onSelectBranch: (branchId: string) => void;
  className?: string;
};

const MAP_PAD = 12;

/* ────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────── */

export function BranchMap({
  locations,
  selectedBranchId,
  isArabic,
  onSelectBranch,
  className,
}: BranchMapProps) {
  const valid = useMemo(
    () =>
      locations.filter(
        (l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)
      ),
    [locations]
  );

  const handleSelect = useCallback(
    (id: string) => onSelectBranch(id),
    [onSelectBranch]
  );

  if (valid.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[320px] items-center justify-center rounded-2xl border border-white/[0.08] bg-slate-900 p-6 text-center text-sm font-semibold text-white/40",
          className
        )}
      >
        {isArabic
          ? "لا توجد إحداثيات متاحة حالياً."
          : "Branch coordinates unavailable."}
      </div>
    );
  }

  const bounds = useMemo(() => {
    const lats = valid.map((l) => l.lat);
    const lngs = valid.map((l) => l.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latRange: maxLat - minLat || 0.01,
      lngRange: maxLng - minLng || 0.01,
    };
  }, [valid]);

  const toXY = useCallback(
    (lat: number, lng: number) => ({
      x: MAP_PAD + ((lng - bounds.minLng) / bounds.lngRange) * (100 - MAP_PAD * 2),
      y: MAP_PAD + (1 - (lat - bounds.minLat) / bounds.latRange) * (100 - MAP_PAD * 2),
    }),
    [bounds]
  );

  const selected = valid.find((l) => l.id === selectedBranchId) ?? valid[0];

  const centroid = useMemo(() => {
    const points = valid.map((l) => toXY(l.lat, l.lng));
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }, [valid, toXY]);

  const selectedXY = toXY(selected.lat, selected.lng);

  return (
    <div
      className={cn(
        "relative min-h-[360px] overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      {/* Fine grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.9) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Radial glow behind selected */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 transition-all duration-500"
        style={{
          background: `radial-gradient(circle 140px at ${selectedXY.x}% ${selectedXY.y}%, rgba(14,126,116,0.5), transparent 70%)`,
        }}
      />

      {/* Header */}
      <div className="absolute inset-x-4 top-4 z-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.08] px-3 py-1.5 backdrop-blur-md">
          <MapPin className="h-3.5 w-3.5 text-[#2DD4C0]" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
            {isArabic ? "خريطة الفروع" : "Branch Map"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.08] px-3 py-1.5 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0E7E74] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0E7E74]" />
          </span>
          <span className="text-[11px] font-bold text-white/50">
            {valid.length} {isArabic ? "فروع" : "branches"}
          </span>
        </div>
      </div>

      {/* SVG Layer */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Connection spokes */}
        {valid.map((l) => {
          const { x, y } = toXY(l.lat, l.lng);
          return (
            <line
              key={`spoke-${l.id}`}
              x1={centroid.x}
              y1={centroid.y}
              x2={x}
              y2={y}
              stroke="rgba(14,126,116,0.18)"
              strokeWidth="0.5"
              strokeDasharray="2 3"
              className="transition-all duration-300"
            />
          );
        })}

        {/* Centroid hub */}
        <circle
          cx={centroid.x}
          cy={centroid.y}
          r="1.2"
          fill="rgba(14,126,116,0.4)"
        />

        {/* Branch dots */}
        {valid.map((l) => {
          const { x, y } = toXY(l.lat, l.lng);
          const isSel = l.id === selectedBranchId;
          return (
            <g key={`dot-${l.id}`} className="transition-all duration-300">
              {isSel && (
                <>
                  <circle cx={x} cy={y} r="6" fill="rgba(14,126,116,0.10)" />
                  <circle cx={x} cy={y} r="4" fill="rgba(14,126,116,0.18)" />
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={isSel ? "2.6" : "1.8"}
                fill={isSel ? "#0E7E74" : "#1E3A4A"}
                stroke={isSel ? "#2DD4C0" : "rgba(255,255,255,0.15)"}
                strokeWidth="0.6"
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive HTML pins */}
      <div className="absolute inset-0">
        {valid.map((l) => {
          const { x, y } = toXY(l.lat, l.lng);
          const isSel = l.id === selectedBranchId;
          const label = isArabic ? l.nameAr : l.nameEn;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => handleSelect(l.id)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4C0] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-full"
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-label={label}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300",
                  isSel
                    ? "border-[#2DD4C0] bg-[#0E7E74] shadow-[0_0_24px_rgba(14,126,116,0.6)] scale-110"
                    : "border-white/20 bg-[#142030] shadow-[0_4px_16px_rgba(0,0,0,0.45)] hover:border-[#0E7E74]/50 hover:bg-[#1A3040] hover:scale-105"
                )}
              >
                <MapPin
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isSel
                      ? "text-white"
                      : "text-white/50 group-hover:text-[#2DD4C0]"
                  )}
                />
              </span>

              {/* Tooltip label */}
              <span
                className={cn(
                  "absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-800/90 px-2.5 py-1 text-[10px] font-bold text-white/90 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 pointer-events-none",
                  isSel && "opacity-100"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom branch strip */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div
          className={cn(
            "flex gap-2 px-3 pb-3 pt-2",
            isArabic ? "flex-row-reverse" : "flex-row"
          )}
        >
          {valid.map((l) => {
            const isSel = l.id === selectedBranchId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => handleSelect(l.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1 rounded-xl border px-3 py-2.5 text-start transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4C0]",
                  isSel
                    ? "border-[#0E7E74]/40 bg-[#0E7E74]/12 shadow-[0_0_20px_rgba(14,126,116,0.22)]"
                    : "border-white/[0.08] bg-white/[0.06] hover:border-[#0E7E74]/25 hover:bg-white/[0.10]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Navigation
                    className={cn(
                      "h-3 w-3 shrink-0",
                      isSel ? "text-[#2DD4C0]" : "text-white/30"
                    )}
                  />
                  <p
                    className={cn(
                      "truncate text-[11px] font-black leading-snug",
                      isSel ? "text-[#2DD4C0]" : "text-white/80"
                    )}
                  >
                    {isArabic ? l.nameAr : l.nameEn}
                  </p>
                </div>
                <p className="truncate text-[9px] font-medium leading-snug text-white/35">
                  {isArabic ? l.addressAr : l.addressEn}
                </p>
                {l.phones?.[0] && (
                  <p
                    className="mt-0.5 text-[9px] font-bold tabular-nums text-white/25"
                    dir="ltr"
                  >
                    {l.phones[0]}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}