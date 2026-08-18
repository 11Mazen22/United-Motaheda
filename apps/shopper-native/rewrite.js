const fs = require("fs");
const path = require("path");

const appDir = "i:\\United-Motaheda\\apps\\shopper-native\\app\\prescriptions";
const srcDir = "i:\\United-Motaheda\\apps\\shopper-native\\src\\features\\prescriptions\\screens";

// Files to copy from src/features to app/
const filesToInline = {
  "index.tsx": "PrescriptionsList.tsx",
  "add.tsx": "AddRxEntry.tsx",
  "manual.tsx": "AddRxManual.tsx",
  "[id]/index.tsx": "PrescriptionDetail.tsx",
};

// Also apply to these existing app files
const existingFiles = [
  "scan.tsx",
  "[id]/refill.tsx",
  "_layout.tsx",
  "[id]/_layout.tsx",
  "transfer.tsx"
];

function processFile(content) {
  // Remove console.log and console.error
  content = content.replace(/console\.log\([^)]*\);?/g, "");
  content = content.replace(/if \(__DEV__\) console\.error\([^)]*\);?/g, "");
  content = content.replace(/console\.error\([^)]*\);?/g, "");

  // Replace kit.color.X with c.X
  content = content.replace(/kit\.color\.([a-zA-Z0-9_]+)/g, "c.$1");

  // Fix RTL style props
  content = content.replace(/marginLeft/g, "marginStart");
  content = content.replace(/marginRight/g, "marginEnd");
  content = content.replace(/paddingLeft/g, "paddingStart");
  content = content.replace(/paddingRight/g, "paddingEnd");
  content = content.replace(/left\s*:/g, "start:");
  content = content.replace(/right\s*:/g, "end:");

  // Add useDarkColors import if missing and if `c.` is used
  if (content.includes("c.") && !content.includes("useDarkColors")) {
    content = content.replace(
      /(import React.*?from ['"]react['"];)/,
      "$1\nimport { useDarkColors } from \"@/hooks/useDarkColors\";"
    );
    if (!content.includes("@/hooks/useDarkColors")) {
       content = "import { useDarkColors } from \"@/hooks/useDarkColors\";\n" + content;
    }
  }

  // Inject const { c } = useDarkColors(); in all React components
  // We'll look for export function ComponentName or function ComponentName
  const componentRegex = /(export\s+(?:default\s+)?function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*(?::\s*React\.ReactElement)?\s*\{\s*)/g;
  content = content.replace(componentRegex, (match) => {
    return match + "\n  const { c } = useDarkColors();\n";
  });
  
  // also inject in inner components like Fact, Header, etc.
  const innerComponentRegex = /(function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*(?::\s*React\.ReactElement)?\s*\{\s*)/g;
  content = content.replace(innerComponentRegex, (match, p1) => {
    // avoid double injection if it's already an exported component
    if (match.startsWith("export")) return match;
    return match + "\n  const { c } = useDarkColors();\n";
  });

  return content;
}

// Inline files
for (const [targetName, srcName] of Object.entries(filesToInline)) {
  const srcPath = path.join(srcDir, srcName);
  const targetPath = path.join(appDir, targetName);
  
  if (fs.existsSync(srcPath)) {
    let content = fs.readFileSync(srcPath, "utf-8");
    
    // Change some imports because we moved from src/features/... to app/prescriptions/
    content = content.replace(/\.\.\//g, "@/features/prescriptions/");
    content = content.replace(/@\/features\/prescriptions\/api/g, "@/features/prescriptions/api");
    content = content.replace(/@\/features\/prescriptions\/lib/g, "@/features/prescriptions/lib");
    content = content.replace(/@\/features\/prescriptions\/hooks/g, "@/features/prescriptions/hooks");
    
    content = processFile(content);
    
    // Rename exported functions to default export if it's a page component
    // e.g. export function PrescriptionsList() -> export default function Page()
    content = content.replace(/export function (PrescriptionsList|AddRxEntry|AddRxManual|PrescriptionDetail)/, "export default function Page");

    fs.writeFileSync(targetPath, content);
    console.log("Inlined and processed:", targetName);
  } else {
    console.log("Not found:", srcPath);
  }
}

// Process existing files
for (const fileName of existingFiles) {
  const filePath = path.join(appDir, fileName);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf-8");
    content = processFile(content);
    fs.writeFileSync(filePath, content);
    console.log("Processed:", fileName);
  }
}
