const fs = require('fs');

const file = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrderDetailScreen.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('import { supabase } from "@/lib/supabase"')) {
    c = c.replace(
        'import { formatPrice } from "@/utils/format";',
        'import { formatPrice } from "@/utils/format";\nimport { supabase } from "@/lib/supabase";'
    );
}

// Add state for actions
if (!c.includes('const [actionsState, setActionsState] = useState<any>(null);')) {
    c = c.replace(
        'const { theme } = useTheme();',
        `const { theme } = useTheme();
  const [actionsState, setActionsState] = useState<any>(null);
  React.useEffect(() => {
    if (id) {
      supabase.rpc("get_order_actions", { p_order_id: id }).then(({ data }) => setActionsState(data as any));
    }
  }, [id]);`
    );
}

// Replace the hardcoded reasons array usage
c = c.replace(
    'const options = reasons.concat([\'Cancel\']);',
    'const options = (actionsState?.cancel?.reasons || []).concat([\'Cancel\']);'
);

c = c.replace(
    `Alert.alert(
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
            );`,
    `const rList = actionsState?.cancel?.reasons || [];
            Alert.alert(
                'Cancel Order',
                'Select a cancellation reason:',
                [
                    { text: 'Cancel', style: 'cancel' },
                    ...rList.slice(0, 2).map((r: string) => ({
                        text: r,
                        onPress: async () => {
                            try {
                                await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason: r } as any);
                                showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                            } catch(e: any) { Alert.alert('Error', e.message); }
                        }
                    }))
                ]
            );`
);

fs.writeFileSync(file, c);
