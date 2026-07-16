// Small shared table-header icon(s) used by admin directory tables
// (StaffManager, UsersManager). Kept out of adminShared.tsx to avoid merge
// risk while that file is being touched elsewhere.
import { ArrowDownIcon, ArrowsUpDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline";

export function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowsUpDownIcon className="h-3.5 w-3.5 text-slate-300" />;
  return dir === "asc" ? <ArrowUpIcon className="h-3.5 w-3.5 text-teal-600" /> : <ArrowDownIcon className="h-3.5 w-3.5 text-teal-600" />;
}
