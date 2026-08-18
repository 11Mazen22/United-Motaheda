const fs = require('fs');

const files = [
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/AnalyticsDashboardScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/BarcodeScannerScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryIntelligenceScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PharmacistProfileScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PrescriptionDetailScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PrescriptionQueueScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/WorkbenchScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/app/(pharmacist)/notifications.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Insert import if missing
  if (!content.includes('import { useDarkColors } from "@/hooks/useDarkColors"')) {
    content = content.replace(/(import .* from ['"]@pharmacy\/ui-native['"];?)/, "$1\nimport { useDarkColors } from \"@/hooks/useDarkColors\";");
  }
  
  fs.writeFileSync(file, content);
}
