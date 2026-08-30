const fs = require('fs');
const file = 'I:/United-Motaheda/apps/shopper-native/src/stores/cart.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('function parseReserveError(e: unknown): { reason: string; available?: number } {', 'function parseReserveError(e: unknown): { reason: string; available?: number; rawMessage?: string } {');
content = content.replace('return { reason: "unknown" };', 'return { reason: "unknown", rawMessage: message };');
fs.writeFileSync(file, content);
