const fs = require('fs');

let rFile = 'I:/United-Motaheda/apps/shopper-native/app/(customer)/(account)/order/[id]/return.tsx';
let c = fs.readFileSync(rFile, 'utf8');
c = c.replace('.then(({ error, data: _data }) => {', '.then(({ error, data }) => {');
c = c.replace('const { data, error } = await supabase.rpc("request_return", {', 'const { error } = await supabase.rpc("request_return", {');
fs.writeFileSync(rFile, c);

let pFile = 'I:/United-Motaheda/apps/shopper-native/app/(pharmacist)/return/[id].tsx';
let p = fs.readFileSync(pFile, 'utf8');
p = p.replace('const { t } = useTranslation();\n', '');
p = p.replace('import { isRtl, flexRow, textAlignStart } from "@/utils/layout";', 'import { isRtl, textAlignStart } from "@/utils/layout";');
fs.writeFileSync(pFile, p);
