import { useMemo } from "react";
import { MapPin, ChevronDown, Store, MapPinned } from "lucide-react";
import { GOVERNORATE_LOCK } from "../constants/location";
import { cn } from "./UI";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type BranchItem = {
  id: string;
  nameAr: string;
  nameEn: string;
  area: string;
};

type BranchSelectorProps = {
  lang: "ar" | "en";
  locations: readonly BranchItem[];
  selectedArea: string;
  selectedBranchId: string;
  onChangeArea: (value: string) => void;
  onChangeBranch: (branchId: string) => void;
  className?: string;
};

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function SelectField({
  label,
  icon: Icon,
  value,
  onChange,
  disabled,
  children,
  isRtl,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  isRtl: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-sm font-black text-slate-700">
        <Icon className="h-4 w-4 text-[#0E7E74]" />
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-700 shadow-[0_2px_12px_rgba(15,23,42,0.05)] outline-none transition-all duration-200",
            "focus:border-[#0E7E74] focus:ring-2 focus:ring-[#0E7E74]/15",
            disabled && "opacity-60 cursor-not-allowed bg-slate-50"
          )}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none",
            isRtl ? "left-3" : "right-3"
          )}
        />
      </div>
    </label>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────── */

export function BranchSelector({
  lang,
  locations,
  selectedArea,
  selectedBranchId,
  onChangeArea,
  onChangeBranch,
  className,
}: BranchSelectorProps) {
  const isRtl = lang === "ar";

  const areas = useMemo(() => {
    return Array.from(new Set(locations.map((b) => b.area))).sort();
  }, [locations]);

  const branchesInArea = useMemo(() => {
    return locations.filter((b) => b.area === selectedArea);
  }, [locations, selectedArea]);

  const handleAreaChange = (value: string) => {
    onChangeArea(value);
    onChangeBranch("");
  };

  return (
    <div className={cn("grid gap-5", className)}>
      {/* Governorate chip */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-[#F4FBFA] px-4 py-2 text-xs font-black text-teal-800 shadow-[0_2px_8px_rgba(14,126,116,0.06)]">
          <MapPin className="h-3.5 w-3.5" />
          {lang === "ar" ? "المحافظة:" : "Governorate:"}{" "}
          {lang === "ar" ? "القاهرة" : GOVERNORATE_LOCK}
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {lang === "ar"
            ? "الخدمة متاحة داخل القاهرة فقط."
            : "Service is restricted to Cairo only."}
        </span>
      </div>

      {/* Selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={lang === "ar" ? "المنطقة" : "Area"}
          icon={MapPinned}
          value={selectedArea}
          onChange={handleAreaChange}
          isRtl={isRtl}
        >
          <option value="">
            {lang === "ar" ? "اختر المنطقة" : "Select area"}
          </option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={lang === "ar" ? "الفرع" : "Branch"}
          icon={Store}
          value={selectedBranchId}
          onChange={onChangeBranch}
          disabled={!selectedArea}
          isRtl={isRtl}
        >
          <option value="">
            {lang === "ar" ? "اختر الفرع" : "Select branch"}
          </option>
          {branchesInArea.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {lang === "ar"
                ? `${branch.nameAr} — ${branch.area}`
                : `${branch.nameEn} — ${branch.area}`}
            </option>
          ))}
        </SelectField>
      </div>

      {/* Helper text */}
      {!selectedArea && (
        <p className="text-[11px] font-medium text-slate-400">
          {lang === "ar"
            ? "اختر المنطقة أولاً لعرض الفروع المتاحة."
            : "Select an area first to view available branches."}
        </p>
      )}
    </div>
  );
}