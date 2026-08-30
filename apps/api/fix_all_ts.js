const fs = require('fs');

// 1. Fix cancelOrder in api.ts
let apiTsFile = 'I:/United-Motaheda/apps/shopper-native/src/features/orders/api.ts';
let apiTs = fs.readFileSync(apiTsFile, 'utf8');
apiTs = apiTs.replace(
`cancelOrder(orderId: string, reason: string = "User requested cancellation"): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("cancel-order", {
    body: { orderId, reason },`,
`cancelOrder(orderId: string, reason: string = "User requested cancellation", idempotencyKey?: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("cancel-order", {
    body: { orderId, reason, idempotencyKey },`
);
fs.writeFileSync(apiTsFile, apiTs);

// 2. Fix OrderDetailScreen imports
let rxScreenFile = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx';
let rxScreen = fs.readFileSync(rxScreenFile, 'utf8');
if (rxScreen.includes('import { View, StyleSheet, ScrollView } from "react-native";')) {
  rxScreen = rxScreen.replace(
    'import { View, StyleSheet, ScrollView } from "react-native";',
    'import { View, StyleSheet, ScrollView, ActionSheetIOS, Platform, Alert } from "react-native";'
  );
} else {
  // Try to find the react-native import line
  const rnImportMatch = rxScreen.match(/import\s+{([^}]+)}\s+from\s+"react-native";/);
  if (rnImportMatch) {
    let imports = rnImportMatch[1];
    if (!imports.includes('ActionSheetIOS')) imports += ', ActionSheetIOS';
    if (!imports.includes('Platform')) imports += ', Platform';
    if (!imports.includes('Alert')) imports += ', Alert';
    rxScreen = rxScreen.replace(rnImportMatch[0], `import { ${imports} } from "react-native";`);
  }
}
fs.writeFileSync(rxScreenFile, rxScreen);

// 3. Fix usePharmacistMutations.ts
let mutFile = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/hooks/usePharmacistMutations.ts';
let mut = fs.readFileSync(mutFile, 'utf8');
if (mut.includes('transitionOrder(args.orderId, args.nextStatus),')) {
  mut = mut.replace(
    'mutationFn: (args: { orderId: string; nextStatus: PharmacistTransitionTarget }) =>',
    'mutationFn: (args: { orderId: string; nextStatus: PharmacistTransitionTarget; reason?: string }) =>'
  );
  mut = mut.replace(
    'transitionOrder(args.orderId, args.nextStatus),',
    'transitionOrder(args.orderId, args.nextStatus, args.reason),'
  );
}
fs.writeFileSync(mutFile, mut);

