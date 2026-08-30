const fs = require('fs');

// Fix api.ts
let apiTs = fs.readFileSync('src/features/driver/api.ts', 'utf8');
apiTs = apiTs.replace('assignmentKind: "assigned" | "reassigned";', 'assignmentKind: "assigned" | "reassigned" | "return_pickup";');
fs.writeFileSync('src/features/driver/api.ts', apiTs);

// Fix orders/api.ts
let ordersApiTs = fs.readFileSync('src/features/orders/api.ts', 'utf8');
ordersApiTs = ordersApiTs.replace(/export async function cancelOrder\(orderId: string\): Promise<void> \{\s*const \{ error \} = await timed\(\s*"orders:cancelOrder",\s*\(\) =>\s*supabase\s*\.from\("orders"\)\s*\.update\(\{ status: "cancelled" \}\)\s*\.eq\("id", orderId\),\s*\);\s*if \(error\) throw error;\s*\}/g, '');
fs.writeFileSync('src/features/orders/api.ts', ordersApiTs);

// Fix OrdersWorkspaceScreen
let workspaceTs = fs.readFileSync('src/features/pharmacist/screens/OrdersWorkspaceScreen.tsx', 'utf8');
workspaceTs = workspaceTs.replace('router.push(`/(pharmacist)/return/${id}`)', 'router.push(`/(pharmacist)/return/${id}` as any)');
workspaceTs = workspaceTs.replace('<Chip label="Return" color="primary" size="small" />', '<View style={{ backgroundColor: theme.colors.brand.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Text variant="caption" style={{ color: "white" }}>Return</Text></View>');
fs.writeFileSync('src/features/pharmacist/screens/OrdersWorkspaceScreen.tsx', workspaceTs);
