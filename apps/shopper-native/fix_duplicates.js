const fs = require("fs");
const path = require("path");

const appDir = "i:\\United-Motaheda\\apps\\shopper-native\\app\\prescriptions";
const existingFiles = [
  "index.tsx",
  "add.tsx",
  "manual.tsx",
  "scan.tsx",
  "transfer.tsx",
  "[id]/index.tsx",
  "[id]/refill.tsx",
  "_layout.tsx",
  "[id]/_layout.tsx",
];

for (const fileName of existingFiles) {
  const filePath = path.join(appDir, fileName);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf-8");
    
    // Remove duplicate `const { c } = useDarkColors();` and duplicate `const s = ...`
    content = content.replace(/(const \{ c \} = useDarkColors\(\);\n\s*const [a-zA-Z0-9_]+ = React\.useMemo\(\(\) => get_[a-zA-Z0-9_]+\(c\), \[c\]\);\n)\s*(const \{ c \} = useDarkColors\(\);\n\s*const [a-zA-Z0-9_]+ = React\.useMemo\(\(\) => get_[a-zA-Z0-9_]+\(c\), \[c\]\);\n)+/g, "$1");
    content = content.replace(/(const \{ c \} = useDarkColors\(\);\n)\s*(const \{ c \} = useDarkColors\(\);\n)+/g, "$1");
    
    // And for multiple styles like s and b and k
    content = content.replace(/(const \{ c \} = useDarkColors\(\);\n(\s*const [a-zA-Z0-9_]+ = React\.useMemo\(\(\) => get_[a-zA-Z0-9_]+\(c\), \[c\]\);\n)+)\s*const \{ c \} = useDarkColors\(\);\n(\s*const [a-zA-Z0-9_]+ = React\.useMemo\(\(\) => get_[a-zA-Z0-9_]+\(c\), \[c\]\);\n)+/g, "$1");

    fs.writeFileSync(filePath, content);
  }
}
