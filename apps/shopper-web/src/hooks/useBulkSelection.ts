import { useCallback, useEffect, useState } from "react";

export interface UseBulkSelectionOptions {
  /** An id (e.g. the current admin's own row) that can never be selected. */
  excludeId?: string | null;
}

export function useBulkSelection<T extends { id: string }>(
  items: T[],
  options?: UseBulkSelectionOptions,
) {
  const excludeId = options?.excludeId ?? null;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected((prev) => {
      const currentIds = new Set(items.map((item) => item.id));
      const next = new Set(prev);
      for (const id of prev) {
        if (!currentIds.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [items]);

  const toggle = useCallback(
    (id: string) => {
      if (excludeId != null && id === excludeId) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [excludeId],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIds = items
        .map((item) => item.id)
        .filter((id) => excludeId == null || id !== excludeId);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [items, excludeId]);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const selectableIds = items
    .map((item) => item.id)
    .filter((id) => excludeId == null || id !== excludeId);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  return { selected, toggle, toggleAll, clear, isSelected, allSelected, count: selected.size };
}
