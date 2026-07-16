import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Runs a bulk status mutation across a set of ids (via `Promise.allSettled`)
 * and shows the shared success/failure-count toast — previously duplicated
 * (nearly line-for-line) as `runBulkStatus` in StaffManager and UsersManager.
 * Selection-clearing / refresh remain the caller's responsibility.
 */
export function useAdminBulkStatus(isArabic: boolean) {
  return useCallback(
    async (ids: string[], updateOne: (id: string) => Promise<unknown>) => {
      const results = await Promise.allSettled(ids.map(updateOne));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        toast.error(isArabic ? `فشل تحديث ${failed} حساب` : `Failed to update ${failed} account(s)`);
      } else {
        toast.success(isArabic ? "تم تحديث الحسابات المحددة" : "Selected accounts updated");
      }
    },
    [isArabic],
  );
}
