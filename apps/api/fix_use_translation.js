const fs = require('fs');
let f = 'I:/United-Motaheda/apps/shopper-native/app/(pharmacist)/return/[id].tsx';
let c = fs.readFileSync(f, 'utf8');
c = c.replace('import { useTranslation } from "react-i18next";\n', '');
fs.writeFileSync(f, c);
