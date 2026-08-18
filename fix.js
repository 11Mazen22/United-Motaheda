const fs = require('fs');
const path = require('path');

const adminFiles = [
  'i:/United-Motaheda/apps/admin/src/pages/DriversPage.tsx',
  'i:/United-Motaheda/apps/admin/src/pages/MarketingPage.tsx',
  'i:/United-Motaheda/apps/admin/src/pages/NotificationsPage.tsx'
];

for (const file of adminFiles) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/\btext-gray-900\b/g, 'text-pharmacy-ink');
  content = content.replace(/\btext-gray-800\b/g, 'text-pharmacy-ink');
  content = content.replace(/\btext-gray-700\b/g, 'text-pharmacy-inkSoft');
  content = content.replace(/\btext-gray-600\b/g, 'text-pharmacy-inkSoft');
  content = content.replace(/\btext-gray-500\b/g, 'text-pharmacy-inkSoft');
  
  content = content.replace(/\bbg-gray-50\b/g, 'bg-pharmacy-canvas');
  content = content.replace(/\bbg-gray-100\b/g, 'bg-pharmacy-canvas');
  
  content = content.replace(/\bborder-gray-100\b/g, 'border-pharmacy-line');
  content = content.replace(/\bborder-gray-200\b/g, 'border-pharmacy-line');
  
  content = content.replace(/\bbg-brand-500\b/g, 'bg-pharmacy-primary');
  content = content.replace(/\bbg-brand-600\b/g, 'bg-pharmacy-primaryDark');
  content = content.replace(/\btext-brand-500\b/g, 'text-pharmacy-primary');
  content = content.replace(/\btext-brand-600\b/g, 'text-pharmacy-primaryDark');
  content = content.replace(/\bborder-brand-500\b/g, 'border-pharmacy-primary');
  content = content.replace(/\bborder-brand-400\b/g, 'border-pharmacy-primary');
  content = content.replace(/\bring-brand-400\b/g, 'ring-pharmacy-primary/50');

  // bg-white -> bg-pharmacy-surface isn't strictly needed if they kept bg-white dark:bg-slate-800 in OrdersPage, 
  // but let's replace bg-white with bg-pharmacy-surface if there's no dark mode, else leave it or replace it? 
  // Wait, OrdersPage uses `bg-white dark:bg-slate-800`. We can leave bg-white alone.

  fs.writeFileSync(file, content);
}

const pharmFiles = [
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryIntelligenceScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/AnalyticsDashboardScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/BarcodeScannerScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PharmacistProfileScreen.tsx'
];

for (const file of pharmFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // 1. Remove @pharmacy/design-tokens
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+["']@pharmacy\/design-tokens["'];?\n?/g, '');
  
  // Replace tokens from design-tokens with kit
  // Assuming kit is imported. We will make sure kit and useDarkColors is imported.
  if (!content.includes('useDarkColors')) {
    content = content.replace(/import \{ kit \}/, 'import { kit, useDarkColors }');
    if (!content.includes('useDarkColors')) {
        content = content.replace(/import \{(.*?)\} from "@pharmacy\/ui-native";/, 'import { $1, useDarkColors } from "@pharmacy/ui-native";');
    }
  }

  // 2. RTL: Replace left/right with start/end
  content = content.replace(/\bmarginLeft\b/g, 'marginStart');
  content = content.replace(/\bmarginRight\b/g, 'marginEnd');
  content = content.replace(/\bpaddingLeft\b/g, 'paddingStart');
  content = content.replace(/\bpaddingRight\b/g, 'paddingEnd');
  content = content.replace(/\bleft:\s/g, 'start: ');
  content = content.replace(/\bright:\s/g, 'end: ');
  content = content.replace(/\bborderLeftWidth\b/g, 'borderStartWidth');
  content = content.replace(/\bborderRightWidth\b/g, 'borderEndWidth');
  content = content.replace(/\bborderLeftColor\b/g, 'borderStartColor');
  content = content.replace(/\bborderRightColor\b/g, 'borderEndColor');
  content = content.replace(/\bborderTopLeftRadius\b/g, 'borderTopStartRadius');
  content = content.replace(/\bborderTopRightRadius\b/g, 'borderTopEndRadius');
  content = content.replace(/\bborderBottomLeftRadius\b/g, 'borderBottomStartRadius');
  content = content.replace(/\bborderBottomRightRadius\b/g, 'borderBottomEndRadius');

  // 4. Remove console.log
  content = content.replace(/console\.log\(.*?\);?/g, '');

  fs.writeFileSync(file, content);
}
console.log("Done");
