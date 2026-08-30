const fs = require('fs');
let code = fs.readFileSync('I:/United-Motaheda/apps/shopper-native/src/features/driver/screens/DriverManifest.tsx', 'utf8');

if (!code.includes('useSafeAreaInsets')) {
    code = code.replace('import { useScreenLayout } from "@/utils/layout";', 'import { useScreenLayout } from "@/utils/layout";\nimport { useSafeAreaInsets } from "react-native-safe-area-context";');
}
code = code.replace('const { pagePad, isTablet } = useScreenLayout();', 'const { pagePad, isTablet } = useScreenLayout();\n  const insets = useSafeAreaInsets();');

code = code.replace('<Screen edgeTop background={theme.colors.canvas.background}>', '<Screen edgeToEdge background={theme.colors.canvas.background}>');

code = code.replace(/<View style=\{s\.quickActionsRow\}>[\s\S]*?<\/View>\s*<View style=\{\{ paddingHorizontal: pagePad \}\}>/m, '<View style={{ paddingHorizontal: pagePad, marginTop: 14 }}>');

const newHeader =           <View style={s.heroTopRow}>
            <Pressable onPress={() => router.push("/(driver)/profile" as never)} style={s.profileAvatarBtn} accessibilityRole="button">
                <Ionicons name="person-circle" size={44} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <UIText variant="eyebrow" style={{ color: "#FFFFFF", opacity: 0.8 }}>{t("driver.eyebrow")}</UIText>
              <UIText style={s.heroTitle}>{t("driver.greeting", { name: user?.name ?? displayNameFromEmail(user?.email) ?? "" })}</UIText>
            </View>
            <View style={s.headerActions}>
              <Pressable onPress={() => router.push("/driver-notifications" as never)} style={s.headerAction} accessibilityRole="button" accessibilityLabel={t("notifications.title")}>
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                {unreadCount > 0 && <View style={s.notificationDot} />}
              </Pressable>
            </View>
          </View>;
code = code.replace(/<View style=\{s\.heroTopRow\}>[\s\S]*?<\/View>\s*<\/View>/m, newHeader);

code = code.replace('style={s.heroGradient}>', 'style={[s.heroGradient, { paddingTop: Math.max(insets.top + 10, 24) }]}>');

code = code.replace('heroGradient: { paddingHorizontal: pagePad, paddingTop: 14, paddingBottom: 18 },', 'heroGradient: { paddingHorizontal: pagePad, paddingBottom: 36, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },\n    profileAvatarBtn: { marginRight: 12 },');

code = code.replace('availabilityCard: {\n      marginHorizontal: pagePad, marginTop: 14,\n      padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", gap: 10,\n    },', 'availabilityCard: {\n      marginHorizontal: pagePad, marginTop: -24,\n      padding: 16, borderRadius: 20, backgroundColor: theme.colors.canvas.surfaceElevated, gap: 10, ...theme.shadows[3], zIndex: 10\n    },');

code = code.replace('availabilitySubtitle: { fontSize: 11.5, lineHeight: 16, color: "rgba(255,255,255,0.78)", marginTop: 4 },', 'availabilitySubtitle: { fontSize: 12, lineHeight: 18, color: theme.colors.text.muted, marginTop: 4 },');

code = code.replace('<UIText variant="label" style={{ color: "#fff", textAlign: TEXT_START }}>', '<UIText variant="label" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, fontFamily: legacyTheme.fonts.bold, fontSize: 16 }}>');

code = code.replace('availabilityKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },', 'availabilityKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", ...theme.shadows[1] },');

code = code.replace('availabilityToggle: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },', 'availabilityToggle: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: "center" },');

fs.writeFileSync('I:/United-Motaheda/apps/shopper-native/src/features/driver/screens/DriverManifest.tsx', code);
