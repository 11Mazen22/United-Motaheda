const fs = require('fs');
const file = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/api/orders.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
`export async function transitionOrder(
  orderId:    string,
  nextStatus: PharmacistTransitionTarget,
): Promise<void> {
  if (nextStatus === "cancelled") {
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: { orderId, reason: "Pharmacist requested cancellation" },`,
`export async function transitionOrder(
  orderId:    string,
  nextStatus: PharmacistTransitionTarget,
  reason?:    string
): Promise<void> {
  if (nextStatus === "cancelled") {
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: { orderId, reason: reason || "Pharmacist requested cancellation" },`
);

fs.writeFileSync(file, c);
