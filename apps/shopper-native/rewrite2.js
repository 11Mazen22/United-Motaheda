const fs = require("fs");
const path = require("path");

const appDir = "i:\\United-Motaheda\\apps\\shopper-native\\app\\prescriptions";
const srcDir = "i:\\United-Motaheda\\apps\\shopper-native\\src\\features\\prescriptions\\screens";

const filesToInline = {
  "index.tsx": "PrescriptionsList.tsx",
  "add.tsx": "AddRxEntry.tsx",
  "manual.tsx": "AddRxManual.tsx",
  "[id]/index.tsx": "PrescriptionDetail.tsx",
};

const existingFiles = [
  "scan.tsx",
  "[id]/refill.tsx",
  "transfer.tsx"
];

function processFile(content) {
  // Remove console.log and console.error
  content = content.replace(/console\.log\([^)]*\);?/g, "");
  content = content.replace(/if \(__DEV__\) console\.error\([^)]*\);?/g, "");
  content = content.replace(/console\.error\([^)]*\);?/g, "");

  // Fix RTL style props
  content = content.replace(/marginLeft/g, "marginStart");
  content = content.replace(/marginRight/g, "marginEnd");
  content = content.replace(/paddingLeft/g, "paddingStart");
  content = content.replace(/paddingRight/g, "paddingEnd");
  content = content.replace(/left\s*:/g, "start:");
  content = content.replace(/right\s*:/g, "end:");

  // Replace kit.color.X with c.X
  content = content.replace(/kit\.color/g, "c");

  // Inject import { useDarkColors } from "@/hooks/useDarkColors";
  if (!content.includes("useDarkColors")) {
    content = "import { useDarkColors } from \"@/hooks/useDarkColors\";\n" + content;
  }

  // Find all component declarations and inject const { c } = useDarkColors();
  const componentRegex = /(export\s+(?:default\s+)?function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*(?::\s*React\.ReactElement)?\s*\{\s*)/g;
  content = content.replace(componentRegex, (match) => {
    return match + "\n  const { c } = useDarkColors();\n";
  });
  
  // also inner components (but only those returning JSX to avoid wrapping regular functions)
  const innerComponentRegex = /(function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*(?::\s*React\.ReactElement)?\s*\{\s*)/g;
  content = content.replace(innerComponentRegex, (match) => {
    if (match.startsWith("export")) return match; // Already handled
    return match + "\n  const { c } = useDarkColors();\n";
  });
  
  // Update StyleSheet to be a function taking c
  // We need to find all const SOMETHING = StyleSheet.create({ ... });
  // and convert them to function getSOMETHING(c) { return StyleSheet.create({ ... }); }
  content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*StyleSheet\.create\(\{/g, (match, name) => {
    return `function get_${name}(c: any) { return StyleSheet.create({`;
  });
  
  // For each component, we need to inject the styles initialization
  // e.g. const s = get_s(c);
  // We can just add const s = get_s(c); const b = get_b(c); etc right after const { c } = useDarkColors();
  // We'll collect all style names we replaced.
  const styleNames = [];
  const styleRegex = /function get_([a-zA-Z0-9_]+)\(c: any\) \{\s*return StyleSheet\.create/g;
  let match;
  while ((match = styleRegex.exec(content)) !== null) {
    styleNames.push(match[1]);
  }
  
  if (styleNames.length > 0) {
    // Inject into the component
    const styleInjections = styleNames.map(name => `  const ${name} = React.useMemo(() => get_${name}(c), [c]);`).join("\n");
    content = content.replace(/const \{ c \} = useDarkColors\(\);\n/g, `const { c } = useDarkColors();\n${styleInjections}\n`);
    
    // Also we need to close the function
    // The problem is we just replaced `const s = StyleSheet.create({` with `function get_s(c: any) { return StyleSheet.create({`
    // We need to replace the trailing `});` of the StyleSheet.create with `}); }`
    // Let's do this by matching `});` that are at the very start of a line (often the end of the stylesheet)
    content = content.replace(/^(\}\);)$/gm, "$1 }");
  }
  
  // Also fix accessibility roles and labels for some generic touchables if missed? (The instructions say add roles and labels to upload buttons and prescription cards, but they already had them in the feature files).
  return content;
}

for (const [targetName, srcName] of Object.entries(filesToInline)) {
  const srcPath = path.join(srcDir, srcName);
  const targetPath = path.join(appDir, targetName);
  
  if (fs.existsSync(srcPath)) {
    let content = fs.readFileSync(srcPath, "utf-8");
    content = content.replace(/\.\.\//g, "@/features/prescriptions/");
    content = content.replace(/@\/features\/prescriptions\/api/g, "@/features/prescriptions/api");
    content = content.replace(/@\/features\/prescriptions\/lib/g, "@/features/prescriptions/lib");
    content = content.replace(/@\/features\/prescriptions\/hooks/g, "@/features/prescriptions/hooks");
    content = processFile(content);
    content = content.replace(/export function (PrescriptionsList|AddRxEntry|AddRxManual|PrescriptionDetail)/, "export default function Page");
    fs.writeFileSync(targetPath, content);
  }
}

for (const fileName of existingFiles) {
  const filePath = path.join(appDir, fileName);
  // Restore from git to undo previous bad writes
  require("child_process").execSync(`git checkout ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf-8");
    content = processFile(content);
    fs.writeFileSync(filePath, content);
  }
}
