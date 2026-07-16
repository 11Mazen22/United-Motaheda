import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import {
  fetchDirectorySummary,
  type AdminDirectorySummary,
  type DirectorySummaryScope,
} from "../services/adminUsersApi";

const EMPTY_SUMMARY: AdminDirectorySummary = {
  total: 0,
  active: 0,
  suspended: 0,
  inactive: 0,
  staff: 0,
  customers: 0,
  admins: 0,
  managers: 0,
  pharmacists: 0,
  drivers: 0,
  verified: 0,
  recentlyActive7d: 0,
};

/**
 * Loads lightweight, count-only directory summary stats (total/active/
 * suspended/etc.) for a given scope. Mirrors the previous inline
 * `loadCounts` implementations in StaffManager/UsersManager — errors are
 * swallowed since these counts are purely cosmetic. Call `reload()` (or
 * rely on the automatic effect) after mutations to refresh.
 */
export function useDirectoryCounts(scope: DirectorySummaryScope, enabled = true) {
  const [counts, setCountsState] = useState<AdminDirectorySummary>(EMPTY_SUMMARY);
  const requestId = useRef(0);
  const setCounts = useCallback((next: SetStateAction<AdminDirectorySummary>) => {
    requestId.current += 1;
    setCountsState(next);
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const currentRequest = ++requestId.current;
    try {
      const summary = await fetchDirectorySummary(scope);
      if (currentRequest === requestId.current) setCountsState(summary);
    } catch {
      // counts are cosmetic — ignore errors
    }
  }, [scope, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { counts, reload, setCounts };
}
