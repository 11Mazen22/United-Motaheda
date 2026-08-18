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

  // Fix imports
  content = content.replace(/import \{(.*?)useDarkColors(.*?)\} from "@pharmacy\/ui-native";/, 'import {$1$2} from "@pharmacy/ui-native";');
  
  if (!content.includes('import { useDarkColors }')) {
    content = content.replace(/import { kit.*? } from "@pharmacy\/ui-native";/, 'import { kit } from "@pharmacy/ui-native";\nimport { useDarkColors } from "@/hooks/useDarkColors";');
  }

  // Inject useDarkColors hook invocation if not present
  if (!content.includes('const { c } = useDarkColors();')) {
    content = content.replace(/export function (\w+).*?{/, 'export function $1() {\n  const { c } = useDarkColors();');
  }

  // Replace kit.color with c inside component scope only
  // This is a bit tricky with Regex since styles are often outside the component
  // Better approach: just change StyleSheet.create({ ... kit.color... }) to dynamic styling, 
  // or pass `c` to the styles, or make the styles a function.
  // The simplest way to handle this in React Native is to keep kit.color for defaults but override them inside the component via `style={[s.root, { backgroundColor: c.surface }]}` etc.
  
  // Or just change StyleSheet.create into a hook or function.
  
  // Actually, I can use a simpler regex: replace `kit.color` with `c` and change `const s = StyleSheet.create` to `const useStyles = (c: any) => StyleSheet.create`, and then call it.
  
  // Let's do that!
  if (content.includes('const s = StyleSheet.create')) {
    content = content.replace(/const s = StyleSheet\.create/, 'const useStyles = (c: any) => StyleSheet.create');
    content = content.replace(/export function (\w+).*?{/, 'export function $1() {\n  const { c } = useDarkColors();\n  const s = useStyles(c);');
    // For other stylesheets like mr, sc, bc, bk in Analytics
    content = content.replace(/const mr = StyleSheet\.create/, 'const useMrStyles = (c: any) => StyleSheet.create');
    content = content.replace(/const sc = StyleSheet\.create/, 'const useScStyles = (c: any) => StyleSheet.create');
    content = content.replace(/const bc = StyleSheet\.create/, 'const useBcStyles = (c: any) => StyleSheet.create');
    content = content.replace(/const bk = StyleSheet\.create/, 'const useBkStyles = (c: any) => StyleSheet.create');
    
    // Pass c down or just use kit.color in Analytics dashboard since we can't easily refactor everything with regex.
    // Let's just do a thorough string replacement for kit.color -> c in those stylesheets, which we did by making them hooks.
  }

  content = content.replace(/kit\.color/g, 'c');

  fs.writeFileSync(file, content);
}
