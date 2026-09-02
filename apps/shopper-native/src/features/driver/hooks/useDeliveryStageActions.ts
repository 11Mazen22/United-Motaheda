/**
 * useDeliveryStageActions — the single implementation of "perform the
 * current delivery-stage action" (arrive at pharmacy/customer, confirm
 * pickup, mark delivered), shared between DeliveryExecutionScreen and the
 * map's contextual bottom sheet.
 *
 * Extracted rather than reimplemented in the map: this carries real
 * business rules that must not drift between two copies — arrival requires
 * a fresh, permission-gated GPS read (the backend rejects it with
 * TooFarFromDestinationError if the driver isn't actually near the stop),
 * and every outcome (success, too-far, permission-denied, generic failure)
 * has a specific translated message. A second implementation is exactly
 * how those two places quietly diverge over time.
 *
 * Deliberately NOT included here: the `complete` (mark delivered) action
 * itself. DeliveryExecutionScreen gates that behind HoldToConfirmButton —
 * a real friction control so a driver can't tap through to "delivered" on
 * a COD order before actually collecting cash. Exposing a one-tap
 * `complete` from here would be trivial to wire into the map and just as
 * trivial to quietly bypass that safeguard, so callers that reach the
 * `complete` stage are expected to route to the full execution screen
 * instead of calling this hook for it.
 */
import { useCallback } from "react";
import * as ExpoLocation from "expo-location";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { TooFarFromDestinationError } from "../api";
import { getDriverActionErrorMessage } from "../lib/errorMessage";
import { useDriverMutations } from "./useDriverMutations";
import type { StageAction } from "../lib/deliveryStage";

interface AssignmentRef {
  id: string;
  assignmentKind?: string;
}

export function useDeliveryStageActions(driverId: string | undefined) {
  const { t } = useTranslation();
  const mutations = useDriverMutations(driverId);

  const runArrivalOrPickup = useCallback(
    async (orderId: string, assignment: AssignmentRef, stageAction: StageAction): Promise<boolean> => {
      try {
        if (stageAction.kind === "arrive_pharmacy" || stageAction.kind === "arrive_customer") {
          const permission = await ExpoLocation.requestForegroundPermissionsAsync();
          if (permission.status !== "granted") {
            showErrorSheet(t("driver.actionFailedTitle"), t("driver.locationPermissionRequired"));
            return false;
          }
          const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          const arrivalStage = stageAction.kind === "arrive_pharmacy" ? "pharmacy" : "customer";
          await mutations.arrival.mutateAsync({ orderId, assignmentId: assignment.id, stage: arrivalStage, coords });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccessSheet(
            arrivalStage === "pharmacy" ? t("driver.arrivedAtPharmacyTitle") : t("driver.arrivedAtCustomerTitle"),
            arrivalStage === "pharmacy" ? t("driver.arrivedAtPharmacyBody") : t("driver.arrivedAtCustomerBody"),
          );
          return true;
        }
        if (stageAction.kind === "confirm_pickup") {
          await mutations.pickup.mutateAsync({ orderId, assignmentId: assignment.id });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccessSheet(t("driver.pickupConfirmedTitle"), t("driver.pickupConfirmedBody"));
          return true;
        }
        return false;
      } catch (e) {
        if (e instanceof TooFarFromDestinationError) {
          showErrorSheet(t("driver.tooFarTitle"), t("driver.tooFarBody"));
          return false;
        }
        showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
        return false;
      }
    },
    [mutations, t],
  );

  const runComplete = useCallback(
    async (orderId: string, assignment: AssignmentRef): Promise<boolean> => {
      try {
        await mutations.deliver.mutateAsync({ orderId, assignmentId: assignment.id, assignmentKind: assignment.assignmentKind });
        showSuccessSheet(t("driver.deliveredTitle"), t("driver.deliveredBody"));
        return true;
      } catch (e) {
        showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
        return false;
      }
    },
    [mutations, t],
  );

  return {
    runArrivalOrPickup,
    runComplete,
    isPending: mutations.arrival.isPending || mutations.pickup.isPending || mutations.deliver.isPending,
  };
}
