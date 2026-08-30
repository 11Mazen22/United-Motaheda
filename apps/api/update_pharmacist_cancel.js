const fs = require('fs');

const file = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('import { ActionSheetIOS')) {
    c = c.replace(
        'import { View, StyleSheet, ScrollView } from "react-native";',
        'import { View, StyleSheet, ScrollView, ActionSheetIOS, Platform } from "react-native";'
    );
}

const reasons = [
    'PRODUCT_UNAVAILABLE',
    'STOCK_MISMATCH',
    'PRESCRIPTION_REJECTED',
    'PRESCRIPTION_UNCLEAR',
    'PHARMACY_CANNOT_FULFILL',
    'PHARMACY_CLOSED',
    'OTHER'
];

c = c.replace(
    'const nextStatus = target as PharmacistTransitionTarget;',
    `const nextStatus = target as PharmacistTransitionTarget;
      if (nextStatus === "cancelled") {
        if (Platform.OS === 'ios') {
          const options = ${JSON.stringify(reasons)}.concat(['Cancel']);
          ActionSheetIOS.showActionSheetWithOptions({
            options,
            cancelButtonIndex: options.length - 1,
            title: 'Select Cancellation Reason'
          }, async (btnIdx) => {
             if (btnIdx !== options.length - 1) {
                const reason = options[btnIdx];
                try {
                  await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason } as any);
                  showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                } catch(e: any) { Alert.alert('Error', e.message); }
             }
          });
        } else {
            // Android Alert
            Alert.alert(
                'Cancel Order',
                'Are you sure you want to cancel this order?',
                [
                    { text: 'No', style: 'cancel' },
                    { text: 'PRODUCT_UNAVAILABLE', onPress: async () => {
                        try {
                            await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason: 'PRODUCT_UNAVAILABLE' } as any);
                            showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                        } catch(e: any) { Alert.alert('Error', e.message); }
                    }},
                    { text: 'PRESCRIPTION_REJECTED', onPress: async () => {
                        try {
                            await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason: 'PRESCRIPTION_REJECTED' } as any);
                            showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                        } catch(e: any) { Alert.alert('Error', e.message); }
                    }},
                    { text: 'OTHER', onPress: async () => {
                        try {
                            await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason: 'OTHER' } as any);
                            showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                        } catch(e: any) { Alert.alert('Error', e.message); }
                    }}
                ]
            );
        }
        return;
      }`
);

fs.writeFileSync(file, c);
