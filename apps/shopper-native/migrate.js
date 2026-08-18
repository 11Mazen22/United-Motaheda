const fs = require('fs');
const path = require('path');

const root = 'i:/United-Motaheda/apps/shopper-native';

const targetFiles = [
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(auth)/forgot-password.tsx',
  'app/(auth)/verify-phone.tsx',
  'app/onboarding.tsx',
  'app/edit-profile.tsx',
  'app/change-password.tsx',
  'app/notification-preferences.tsx',
  'app/deals.tsx',
  'app/offers.tsx',
  'app/category/[id].tsx',
  'app/checkout.tsx',
  'app/about.tsx', 'app/faq.tsx', 'app/terms.tsx', 'app/privacy.tsx'
];

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(getFiles(file));
    } else { 
      results.push(file);
    }
  });
  return results;
}

const driverFiles = getFiles(path.join(root, 'app/(driver)')).filter(f => f.endsWith('.tsx'));

let filesToProcess = targetFiles.map(f => path.join(root, f)).concat(driverFiles);
filesToProcess = filesToProcess.filter(f => fs.existsSync(f));

let modifiedCount = 0;

filesToProcess.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Imports
  content = content.replace(/import\s+\{\s*theme\s*\}\s+from\s+['"]@pharmacy\/design-tokens['"];?\n?/g, '');
  content = content.replace(/import\s+theme\s+from\s+['"]@pharmacy\/design-tokens['"];?\n?/g, '');
  content = content.replace(/import\s+\{\s*legacyColors\s*\}\s+from\s+['"][^'"]+['"];?\n?/g, '');
  
  if (!content.includes("import { kit }") && !content.includes("import {kit}")) {
    if (content.includes("@pharmacy/ui-native")) {
      content = content.replace(/(import .* from ['"]@pharmacy\/ui-native['"];?)/, "$1\nimport { kit } from '@pharmacy/ui-native';");
    } else {
      content = "import { kit } from '@pharmacy/ui-native';\n" + content;
    }
  }

  // 2. Dark mode hook
  if (!content.includes("useDarkColors")) {
    content = content.replace(/(import .* from ['"]react['"];?)/, "$1\nimport { useDarkColors } from '@/hooks/useDarkColors';");
  }

  // 3. Typography
  content = content.replace(/theme\.fonts\./g, 'kit.font.');
  
  // 4. Directional properties
  content = content.replace(/paddingLeft:/g, 'paddingStart:');
  content = content.replace(/paddingRight:/g, 'paddingEnd:');
  content = content.replace(/marginLeft:/g, 'marginStart:');
  content = content.replace(/marginRight:/g, 'marginEnd:');
  content = content.replace(/borderLeftWidth:/g, 'borderStartWidth:');
  content = content.replace(/borderRightWidth:/g, 'borderEndWidth:');
  content = content.replace(/borderLeftColor:/g, 'borderStartColor:');
  content = content.replace(/borderRightColor:/g, 'borderEndColor:');
  content = content.replace(/left:/g, 'start:');
  content = content.replace(/right:/g, 'end:');
  
  // 5. Console.log
  content = content.replace(/console\.log\([^)]*\);?/g, '');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Modified', file);
    modifiedCount++;
  }
});

console.log('Total files modified:', modifiedCount);
