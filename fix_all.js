const fs = require('fs');

const files = [
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/AnalyticsDashboardScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/BarcodeScannerScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryIntelligenceScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/InventoryScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/PharmacistProfileScreen.tsx',
  'i:/United-Motaheda/apps/shopper-native/app/(pharmacist)/notifications.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Remove @pharmacy/design-tokens
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+["']@pharmacy\/design-tokens["'];?\n?/g, '');
  
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

  // Replace theme.fonts.* with kit.font.*
  content = content.replace(/theme\.fonts\./g, 'kit.font.');

  // Remove console.log
  content = content.replace(/console\.log\(.*?\);?/g, '');

  // Import useDarkColors
  if (!content.includes('useDarkColors')) {
    content = content.replace(/import \{ kit([^{}]*) \} from ["']@pharmacy\/ui-native["'];?/, 'import { kit$1 } from "@pharmacy/ui-native";\nimport { useDarkColors } from "@/hooks/useDarkColors";');
  }

  // Inject hook
  const match = content.match(/export (?:default )?function ([A-Z]\w+).*?\{/);
  if (match) {
    const componentName = match[1];
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
       content = content.replace(
         new RegExp(`(const \\{ c \\} = useDarkColors\\(\\);\\s*)`),
         `$1const ${varName} = use${varName.charAt(0).toUpperCase() + varName.slice(1)}Styles(c);\n  `
       );
    }
  }

  // Now replace kit.color with c, but ONLY inside the useXStyles blocks
  // It's safer to just replace kit.color with c globally, and fix up the default props
  content = content.replace(/kit\.color/g, 'c');
  
  // Fix default props for subcomponents
  // e.g. iconColor = c.accentDeep -> iconColor = kit.color.accentDeep (since they evaluate before useDarkColors, unless they are inside the component)
  // Actually, if a subcomponent is like function MetricRow({ iconColor = c.accentDeep }) 
  // we can change it back to kit.color.accentDeep to prevent "c is not defined".
  content = content.replace(/=\s*c\./g, '= kit.color.');
  // Fix BigKpi, Section, MetricRow etc calling kit.color in their body
  // We can just add `const { c } = useDarkColors();` inside them!
  const subcomponents = ['MetricRow', 'Section', 'MiniBarChart', 'BigKpi'];
  for (const sub of subcomponents) {
    if (content.includes(`function ${sub}`)) {
       content = content.replace(
         new RegExp(`(function ${sub}\\(.*?\\).*?\\{\\s*)`, 's'),
         `$1const { c } = useDarkColors();\n  `
       );
    }
  }

  fs.writeFileSync(file, content);
}
