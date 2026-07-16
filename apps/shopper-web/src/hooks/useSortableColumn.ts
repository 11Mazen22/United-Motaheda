import { useState } from "react";

export type SortDirection = "asc" | "desc";

/**
 * Shared "click a column header to sort" state + toggle logic, previously
 * duplicated (identically) as a local `handleSort` in StaffManager and
 * UsersManager: clicking the active column flips direction, clicking a new
 * column selects it and resets direction to ascending.
 */
export function useSortableColumn<F extends string>(
  initialField: F,
  initialDir: SortDirection = "desc",
) {
  const [sortBy, setSortBy] = useState<F>(initialField);
  const [sortDir, setSortDir] = useState<SortDirection>(initialDir);

  const handleSort = (field: F) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  return { sortBy, sortDir, setSortBy, setSortDir, handleSort };
}
