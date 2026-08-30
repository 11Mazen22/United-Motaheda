const fs = require('fs');
const file = 'I:/United-Motaheda/apps/shopper-native/src/features/driver/screens/DeliveryExecutionScreen.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  `{stage === "at_customer" ? (
                <HoldToConfirmButton
                  label={t(stageAction.labelKey, stageAction.fallback)}
                  hint={t("driver.holdToConfirm")}
                  icon={stageAction.icon}
                  onConfirm={() => void handleCompleteDelivery()}
                  loading={mutations.deliver.isPending}
                />
              ) : stage !== "delivered" && stage !== "unknown" ? (
                <Button
                  label={t(stageAction.labelKey, stageAction.fallback)}
                  icon={stageAction.icon}
                  onPress={() => void handleArrivalOrPickup()}
                  loading={actionPending}
                  full
                  size="lg"
                />
              ) : null}`,
  `{stageAction.kind === "complete" ? (
                <HoldToConfirmButton
                  label={t(stageAction.labelKey, stageAction.fallback)}
                  hint={t("driver.holdToConfirm")}
                  icon={stageAction.icon}
                  onConfirm={() => void handleCompleteDelivery()}
                  loading={mutations.deliver.isPending}
                />
              ) : stage !== "delivered" && stage !== "unknown" ? (
                <>
                  <Button
                    label={t(stageAction.labelKey, stageAction.fallback)}
                    icon={stageAction.icon}
                    onPress={() => void handleArrivalOrPickup()}
                    loading={actionPending}
                    full
                    size="lg"
                  />
                  {assignment?.assignmentKind === "return_pickup" && stageAction.kind === "confirm_pickup" && (
                    <Button
                      label={t("driver.pickupFailed", "Pickup Failed")}
                      icon="close-circle-outline"
                      onPress={() => router.push(\`/(driver)/issue/\${orderId}?type=return_failed\` as never)}
                      variant="secondary"
                      full
                      style={{ marginTop: 8 }}
                    />
                  )}
                </>
              ) : null}`
);

fs.writeFileSync(file, c);
