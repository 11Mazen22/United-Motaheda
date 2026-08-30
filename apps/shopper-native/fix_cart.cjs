const fs = require('fs');
const file = 'src/stores/cart.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'function parseReserveError(e: unknown): { reason: string; available?: number } {', 
  'function parseReserveError(e: unknown): { reason: string; available?: number; rawMessage?: string } {'
);

content = content.replace(
  'return { reason: "unknown" };', 
  'return { reason: "unknown", rawMessage: message };'
);

const searchStr = `message:
                parsed.reason === "insufficient_stock"
                  ? parsed.available && parsed.available > 0
                    ? \`الكمية المتاحة فقط \${parsed.available}\`
                    : "نفذ المخزون لهذا المنتج"
                  : "تعذر حجز المخزون",`;

const replaceStr = `message:
                parsed.reason === "insufficient_stock"
                  ? parsed.available && parsed.available > 0
                    ? \`الكمية المتاحة فقط \${parsed.available}\`
                    : "نفذ المخزون لهذا المنتج"
                  : parsed.reason === "unknown" && parsed.rawMessage
                  ? \`تعذر حجز المخزون: \${parsed.rawMessage}\`
                  : "تعذر حجز المخزون",`;

content = content.replace(searchStr, replaceStr);
fs.writeFileSync(file, content);
