const fs = require('fs');

const pharmFiles = [
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/AnalyticsDashboardScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/BarcodeScannerScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryIntelligenceScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PharmacistProfileScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PrescriptionDetailScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PrescriptionQueueScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/WorkbenchScreen.tsx',
];

for (const file of pharmFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Remove @pharmacy/design-tokens
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+["']@pharmacy\/design-tokens["'];?\n?/g, '');
  
  // Replace theme.fonts.* with kit.font.*
  content = content.replace(/theme\.fonts\./g, 'kit.font.');

  // RTL
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

  // Remove console.log
  content = content.replace(/console\.log\(.*?\);?/g, '');
  
  // Dynamic colors fix:
  // Instead of replacing all kit.color with c, we can replace kit.color with useTheme().theme.colors, 
  // but hooks can't be called outside.
  // The prompt says: "Dark Mode: Use useDarkColors hook for dynamic color resolution."
  // Wait, I can just leave kit.color alone, and dynamically override styles where needed, OR
  // since `kit.color` is static, we can inject a wrapper or convert StyleSheet to a hook.
  // A simple hack: replace kit.color with `c` everywhere, but then pass `c` into the functions!
  // To avoid breaking default args like `iconColor = kit.color.accentDeep`, replace `kit.color` with `kit.color` there? No, just replace `kit.color` with `colors` and do `const colors = useDarkColors().c;` or just import `kit` globally.
  // It's probably easier to just replace `kit.color` with `kit.color` (leave it) and let the design tokens remain static, but the prompt says:
  // "Use useDarkColors hook for dynamic color resolution."
  // Ok, let's manually replace `kit.color` -> `c` in AnalyticsDashboardScreen etc., and fix the scope.
  // Actually, I can use regex to change `const s = StyleSheet.create` to `const useStyles = (c: any) => StyleSheet.create`, and then call `const s = useStyles(c)` inside the component.
  // For `MetricRow`, `BigKpi`, we can change them to accept `c` implicitly or define `c` inside them.
  // Let's do `const { c } = useDarkColors();` inside ALL components.
  
  fs.writeFileSync(file, content);
}
