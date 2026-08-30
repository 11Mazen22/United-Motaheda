const fs = require('fs');

let apiTsFile = 'I:/United-Motaheda/apps/shopper-native/src/features/orders/api.ts';
let apiTs = fs.readFileSync(apiTsFile, 'utf8');

// The function is:
// export async function cancelOrder(orderId: string, reason: string = "User requested cancellation"): Promise<boolean> {
//   const { data, error } = await supabase.functions.invoke("cancel-order", {
//     body: { orderId, reason },
//   });

apiTs = apiTs.replace(
  /export async function cancelOrder\(orderId: string, reason: string = "User requested cancellation"\): Promise<boolean> \{\s+const { data, error } = await supabase\.functions\.invoke\("cancel-order", \{\s+body: \{ orderId, reason \},/,
  `export async function cancelOrder(orderId: string, reason: string = "User requested cancellation", idempotencyKey?: string): Promise<boolean> {\n  const { data, error } = await supabase.functions.invoke("cancel-order", {\n    body: { orderId, reason, idempotencyKey },`
);

fs.writeFileSync(apiTsFile, apiTs);
