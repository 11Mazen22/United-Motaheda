import { MapPin } from "lucide-react";
import { cn } from "./UI";
import type { SiteLocation } from "../data";

type BranchMapProps = {
  locations: readonly SiteLocation[];
  selectedBranchId: string;
  isArabic: boolean;
  onSelectBranch: (branchId: string) => void;
  className?: string;
};

const MAP_PAD = 14;

export function BranchMap({
  locations,
  selectedBranchId,
  isArabic,
  onSelectBranch,
  className,
}: BranchMapProps) {
  const valid = locations.filter(
    (l) => Number.isFinite(l.lat) && Number.isFinite(l.lng),
  );

  if (valid.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[320px] items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0A1220] p-6 text-center text-sm font-semibold text-white/40",
          className,
        )}
      >
        {isArabic ? "لا توجد إحداثيات متاحة حالياً." : "Branch coordinates unavailable."}
      </div>
    );
  }

  const lats = valid.map((l) => l.lat);
  const lngs = valid.map((l) => l.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;

  const toXY = (lat: number, lng: number) => ({
    x: MAP_PAD + ((lng - minLng) / lngRange) * (100 - MAP_PAD * 2),
    y: MAP_PAD + (1 - (lat - minLat) / latRange) * (100 - MAP_PAD * 2),
  });

  const selected = valid.find((l) => l.id === selectedBranchId) ?? valid[0];
  const centroid = {
    x: valid.reduce((s, l) => s + toXY(l.lat, l.lng).x, 0) / valid.length,
    y: valid.reduce((s, l) => s + toXY(l.lat, l.lng).y, 0) / valid.length,
  };

  return (
    <div
      className={cn(
        "relative min-h-[340px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A1220]",
        className,
      )}
    >
      {/* ── Fine grid ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.9) 1px,transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* ── Radial glow behind selected branch ── */}
      {(() => {
        const { x, y } = toXY(selected.lat, selected.lng);
        return (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle 120px at ${x}% ${y}%, rgba(14,126,116,0.55), transparent 70%)`,
            }}
          />
        );
      })()}

      {/* ── Header bar ── */}
      <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 backdrop-blur-sm">
          <MapPin className="h-3.5 w-3.5 text-[#2DD4C0]" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
            {isArabic ? "خريطة الفروع" : "Branch Map"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0E7E74] shadow-[0_0_6px_rgba(14,126,116,0.9)]" />
          <span className="text-[11px] font-bold text-white/50">
            {valid.length} {isArabic ? "فروع" : "branches"}
          </span>
        </div>
      </div>

      {/* ── SVG: connection spokes + branch dots ── */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dashed spokes from centroid to each branch */}
        {valid.map((l) => {
          const { x, y } = toXY(l.lat, l.lng);
          return (
            <line
              key={`spoke-${l.id}`}
              x1={centroid.x}
              y1={centroid.y}
              x2={x}
              y2={y}
              stroke="rgba(14,126,116,0.20)"
              strokeWidth="0.6"
              strokeDasharray="2 2.5"
            />
          );
        })}

        {/* Centroid hub dot */}
        <circle cx={centroid.x} cy={centroid.y} r="1.4" fill="rgba(14,126,116,0.35)" />

        {/* Branch pins */}
        {valid.map((l) => {
          const { x, y } = toXY(l.lat, l.lng);
          const isSel = l.id === selectedBranchId;
          return (
            <g key={`dot-${l.id}`}>
              {isSel && (
                <>
                  <circle cx={x} cy={y} r="5.5" fill="rgba(14,126,116,0.12)" />
                  <circle cx={x} cy={y} r="3.8" fill="rgba(14,126,116,0.20)" />
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={isSel ? "2.8" : "2"}
                fill={isSel ? "#0E7E74" : "#1E3A4A"}
                stroke={isSel ? "#2DD4C0" : "rgba(255,255,255,0.18)"}
                strokeWidth="0.7"
              />
            </g>
          );
        })}
      </svg>

      {/* ── Interactive HTML pins (clickable) ── */}
      <div className="absolute inset-0">
        {valid.map((l) => {
          const { x, y } = toXY(l.lat, l.lng);
          const isSel = l.id === selectedBranchId;
          const label = isArabic ? l.nameAr : l.nameEn;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelectBranch(l.id)}
              className={cn(
                "group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-label={label}
            >
              {/* Pin icon */}
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200",
                  isSel
                    ? "border-[#2DD4C0] bg-[#0E7E74] shadow-[0_0_18px_rgba(14,126,116,0.7)] scale-110"
                    : "border-white/20 bg-[#142030] shadow-[0_4px_14px_rgba(0,0,0,0.4)] hover:border-[#0E7E74]/60 hover:bg-[#1A3040] hover:scale-105",
                )}
              >
                <MapPin
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isSel ? "text-white" : "text-white/50 group-hover:text-[#2DD4C0]",
                  )}
                />
              </span>

              {/* Label pill below pin */}
              <span
                className={cn(
                  "pointer-events-none absolute start-1/2 top-[calc(100%+0.5rem)] hidden min-w-max -translate-x-1/2 rounded-lg px-2.5 py-1 text-[10.5px] font-black shadow-md sm:block",
                  isSel
                    ? "border border-[#0E7E74]/60 bg-[#0E7E74]/90 text-white backdrop-blur-sm"
                    : "border border-white/[0.10] bg-[#0F1E2D]/90 text-white/60 backdrop-blur-sm",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── All-branches strip — horizontal scrollable row ── */}
      <div className="absolute inset-x-0 bottom-0 overflow-x-auto">
        <div className={cn(
          "flex gap-2 px-4 pb-4 pt-2",
          isArabic ? "flex-row-reverse" : "flex-row",
        )}
          style={{ width: "max-content", minWidth: "100%" }}>
          {valid.map((l) => {
            const isSel = l.id === selectedBranchId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onSelectBranch(l.id)}
                className={cn(
                  "flex min-w-[152px] shrink-0 flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-all duration-200 focus-visible:outline-none",
                  isSel
                    ? "border-[#0E7E74]/50 bg-[#0E7E74]/15 shadow-[0_0_18px_rgba(14,126,116,0.28)]"
                    : "border-white/[0.09] bg-white/[0.06] hover:border-[#0E7E74]/30 hover:bg-white/[0.10]",
                )}
              >
                <p className={cn(
                  "truncate text-[11px] font-black leading-snug",
                  isSel ? "text-[#2DD4C0]" : "text-white/75",
                )}>
                  {isArabic ? l.nameAr : l.nameEn}
                </p>
                <p className="truncate text-[9.5px] font-medium leading-snug text-white/38">
                  {isArabic ? l.addressAr : l.addressEn}
                </p>
                {l.phones?.[0] && (
                  <p className="mt-0.5 text-[9px] font-bold tabular-nums text-white/28" dir="ltr">
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
