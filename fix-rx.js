const fs = require('fs');
const p = 'I:/United-Motaheda/apps/shopper-native/app/(customer)/prescriptions/[id]/index.tsx';
let s = fs.readFileSync(p, 'utf8');

// Replace STATUS_COLOR block
s = s.replace(
  /const STATUS_COLOR: Record<RxStatus, string> = \{[^}]+\};/,
  'function rxStatusColor(status: RxStatus, c: any): string {\n  switch (status) {\n    case \'ready\': return c.success;\n    case \'active\': return c.accentDeep;\n    case \'expiring\': return c.warn;\n    case \'expired\': return c.inkFaint;\n    default: return c.inkSoft;\n  }\n}'
);

// Replace STATUS_TINT block
s = s.replace(
  /const STATUS_TINT: Record<RxStatus, string> = \{[^}]+\};/,
  'function rxStatusTint(status: RxStatus, c: any): string {\n  switch (status) {\n    case \'ready\': return c.successTint;\n    case \'active\': return c.accentTint;\n    case \'expiring\': return c.warnTint;\n    case \'expired\': return c.accentTint;\n    default: return c.well;\n  }\n}'
);

fs.writeFileSync(p, s);
console.log('Done');
