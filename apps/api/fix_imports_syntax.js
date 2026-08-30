const fs = require('fs');
let file = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(
`, ActionSheetIOS, Platform, Alert } from "react-native";`,
`  ActionSheetIOS, Platform, Alert\n} from "react-native";`
);
fs.writeFileSync(file, c);
