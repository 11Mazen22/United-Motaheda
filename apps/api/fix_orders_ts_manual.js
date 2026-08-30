const fs = require('fs');

let file = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/api/orders.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export async function transitionOrder(')) {
    // Modify signature
    lines[i+2] = '  nextStatus: PharmacistTransitionTarget,';
    lines.splice(i+3, 0, '  reason?: string');
    
    // find body: { orderId, reason:
    for (let j = i; j < i + 15; j++) {
      if (lines[j].includes('body: { orderId, reason: "Pharmacist requested cancellation" }')) {
        lines[j] = lines[j].replace('"Pharmacist requested cancellation"', 'reason || "Pharmacist requested cancellation"');
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(file, lines.join('\n'));
