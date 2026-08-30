const fs = require('fs');
const file = 'I:/United-Motaheda/apps/shopper-native/app/(customer)/(account)/order/[id].tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(
    '{order.status === "delivered" && (',
    '{actions?.canRequestReturn && ('
);
fs.writeFileSync(file, c);
