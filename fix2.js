const fs = require('fs');
let f = fs.readFileSync('packages/ui-native/src/index.ts', 'utf-8');
f = f.replace('export * as CustomerUI from ./customer;', 'export * as CustomerUI from "./customer";');
fs.writeFileSync('packages/ui-native/src/index.ts', f);
console.log('fixed');
