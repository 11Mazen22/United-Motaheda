import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Wraps an admin confirm-dialog mutation with the shared
 * try/toast-on-error/rethrow pattern used by StaffManager's and
 * UsersManager's `handleConfirmedAction`: run the action, and on failure
 * show a toast then rethrow so `AdminConfirmDialog` stays open. The
 * kind-specific dispatch (role/status/lock/reset, etc.) stays local to each
 * caller — only the wrapper is shared, to avoid a risky generic dispatch
 * abstraction across differing `PendingAction` shapes.
 */
export function useAdminConfirmedAction(isArabic: boolean) {
  return useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : (isArabic ? "فشل الإجراء" : "Action failed"));
        throw err; // keep AdminConfirmDialog open on failure
      }
    },
    [isArabic],
  );
}
