const fs = require('fs');
let file = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(
    'import { View, StyleSheet, ScrollView, ActionSheetIOS, Platform } from "react-native";',
    'import { View, StyleSheet, ScrollView, ActionSheetIOS, Platform, Alert } from "react-native";'
);
c = c.replace(
    'async (btnIdx) => {',
    'async (btnIdx: number) => {'
);
fs.writeFileSync(file, c);
