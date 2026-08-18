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

  // Import useDarkColors
  if (!content.includes('useDarkColors')) {
    content = content.replace(/import \{ kit([^{}]*) \} from ["']@pharmacy\/ui-native["'];?/, 'import { kit$1 } from "@pharmacy/ui-native";\nimport { useDarkColors } from "@/hooks/useDarkColors";');
  }

  // Find the component name
  const match = content.match(/export (?:default )?function ([A-Z]\w+)/);
  if (match) {
    const componentName = match[1];
    
    // Inject hook
    if (!content.includes('const { c } = useDarkColors();')) {
      content = content.replace(
        new RegExp(`(export (?:default )?function ${componentName}.*?\\{\\s*)`),
        `$1const { c } = useDarkColors();\n  `
      );
    }
  }

  // Make StyleSheets dynamic hooks
  const styleSheetMatches = [...content.matchAll(/const ([a-z]+) = StyleSheet\.create\(\{/g)];
  for (const m of styleSheetMatches) {
    const varName = m[1];
    // Rename to hook
    content = content.replace(
      new RegExp(`const ${varName} = StyleSheet\\.create`),
      `const use${varName.charAt(0).toUpperCase() + varName.slice(1)}Styles = (c: any) => StyleSheet.create`
    );
    
    // Inject hook call inside component
    if (match) {
       const componentName = match[1];
       content = content.replace(
         new RegExp(`(const \\{ c \\} = useDarkColors\\(\\);\\s*)`),
         `$1const ${varName} = use${varName.charAt(0).toUpperCase() + varName.slice(1)}Styles(c);\n  `
       );
    }
  }

  // Replace kit.color with c for all stylesheet hooks
  content = content.replace(/kit\.color/g, 'c');

  // Fix MetricRow etc default props that were kit.color
  // (e.g. iconColor = kit.color.accentDeep -> now it's c.accentDeep which fails if c is undefined)
  // Let's replace "iconColor = c.accentDeep" with "iconColor" and default it inside the component.
  // Actually, we can just replace default props `c.` with `kit.color.` for non-StyleSheet contexts, 
  // but it's simpler to just do a global replace and let TS complain, then fix.

  fs.writeFileSync(file, content);
}
