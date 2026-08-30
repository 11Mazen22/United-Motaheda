const fs = require('fs');

const file = 'I:/United-Motaheda/apps/shopper-native/app/(customer)/(account)/order/[id]/return.tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace('theme.colors.feedback.error', '"#EF4444"');

// Fix .finally()
c = c.replace(
  `.then(({ data, error }) => {
        if (error) {
          console.error("Eligibility check failed:", error);
          Alert.alert("Error", error.message);
        } else {
          setEligibility(data as unknown as EligibilityResult);
        }
      })
      .finally(() => setIsChecking(false));`,
  `.then(({ data, error }) => {
        if (error) {
          console.error("Eligibility check failed:", error);
          Alert.alert("Error", error.message);
        } else {
          setEligibility(data as unknown as EligibilityResult);
        }
        setIsChecking(false);
      });`
);
fs.writeFileSync(file, c);

// Re-apply OrdersWorkspaceScreen unused ts fixes (but only inside ReturnSection)
const wsFile = 'I:/United-Motaheda/apps/shopper-native/src/features/pharmacist/screens/OrdersWorkspaceScreen.tsx';
let ws = fs.readFileSync(wsFile, 'utf8');
ws = ws.replace('router.push(`/(pharmacist)/return/${id}`)', 'router.push(`/(pharmacist)/return/${id}` as any)');
ws = ws.replace('<Chip label="Return" color="primary" size="small" />', '<View style={{ backgroundColor: theme.colors.brand.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Text variant="caption" style={{ color: "white" }}>Return</Text></View>');
ws = ws.replace(/function ReturnSection\(\{[^]+?const { t } = useTranslation\(\);\n  const { theme } = useTheme\(\);/m, (match) => {
    return match.replace('const { t } = useTranslation();\n', '');
});
fs.writeFileSync(wsFile, ws);

