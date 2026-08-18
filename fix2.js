const fs = require('fs');

const pharmFiles = [
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/AnalyticsDashboardScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/BarcodeScannerScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryIntelligenceScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PharmacistProfileScreen.tsx'
];

for (const file of pharmFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Replace theme.fonts.* with kit.font.*
  content = content.replace(/theme\.fonts\./g, 'kit.font.');
  
  // Replace dark mode colors. The components are not using useDarkColors yet for custom styling in StyleSheet.
  // The system instruction says: "Dark Mode: Use useDarkColors hook for dynamic color resolution."
  // Wait, I can inject useDarkColors where kit.color is used.
  // Actually, wait, useDarkColors returns an object. Let's look at `useDarkColors` hook.

  fs.writeFileSync(file, content);
}
