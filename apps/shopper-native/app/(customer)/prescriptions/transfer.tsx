import { useTheme, type NativeTheme } from "@pharmacy/ui-native";

import React, { useCallback, useMemo, useState } from "react";

import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useTranslation } from "react-i18next";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeInDown } from "react-native-reanimated";

import { CustomerUI } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { useAuth } from "@/features/auth";

import { usePrescriptionMutations } from "@/features/prescriptions";

import { useBranches } from "@/features/delivery/branches/useBranches";

import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";

import { PrescriptionsHeader } from "@/features/prescriptions/components/PrescriptionsHeader";



const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);



function branchName(
  branch: { nameAr: string; nameEn: string },
  lang:   string,
): string {
  return lang === "en" ? (branch.nameEn || branch.nameAr) : (branch.nameAr || branch.nameEn);
}



export default function Page(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user }  = useAuth();
  const { create } = usePrescriptionMutations(user?.id);

  const { data: branches = [] } = useBranches();

  const receivingBranches = useMemo(
    () => branches.filter((b) => b.acceptsPrescriptions !== false),
    [branches],
  );

  const [branchId,    setBranchId]    = useState<string | null>(null);
  const [rxNumber,    setRxNumber]    = useState("");
  const [name,        setName]        = useState("");
  const [dose,        setDose]        = useState("");
  const [doctor,      setDoctor]      = useState("");
  const [error,       setError]       = useState<string | null>(null);

  const canSave =
    !!branchId && name.trim().length > 0 && !create.isPending && !!user?.id;

  const onSave = useCallback(async () => {
    if (!user?.id) return;
    if (!branchId) { setError(t("prescriptions.transferSelectRequired")); return; }
    if (name.trim().length === 0) { setError(t("prescriptions.transferNameRequired")); return; }
    setError(null);
    try {
      const created = await create.mutateAsync({
        input: {
          name:      name.trim(),
          dose:      dose.trim() || undefined,
          rxNumber:  rxNumber.trim() || undefined,
          doctor:    doctor.trim() || undefined,
        },
      });
      showSuccessSheet(
        t("prescriptions.transferSavedTitle"),
        t("prescriptions.transferSavedBody"),
        () => router.replace(`/prescriptions/${created.id}` as never),
      );
    } catch {
      showErrorSheet(t("prescriptions.transferSaveErrorTitle"), t("prescriptions.transferSaveErrorBody"));
    }
  }, [user?.id, branchId, name, dose, rxNumber, doctor, create, router, t]);

  return (
    <View style={s.screen}>
      <PrescriptionsHeader
        insetsTop={insets.top}
        icon="swap-horizontal-outline"
        eyebrow={t("prescriptions.transfer")}
        title={t("prescriptions.transferTitle")}
        onBack={() => router.back()}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <CustomerUI.Notice variant="info" message={t("prescriptions.transferIntro")} />

        <Text weight="bold" style={s.fieldLabel}>
          {t("prescriptions.transferSelectLabel")}
        </Text>
        <Text style={s.fieldHint}>
          {t("prescriptions.transferSelectHint")}
        </Text>

        <View style={s.branchList}>
          {receivingBranches.map((b, i) => {
            const selected = b.id === branchId;
            return (
              <Animated.View key={b.id} entering={FadeInDown.duration(320).delay(Math.min(i, 6) * 45).springify()}>
                <Pressable
                  onPress={() => { setBranchId(b.id); setError(null); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={s.branchTouchable}>
                  {({ pressed }) => (
                    <View style={[
                      s.branchRow,
                      selected && s.branchRowSelected,
                      pressed && s.branchRowPressed,
                    ]}>
                      <View style={[s.branchIconWell, selected && { backgroundColor: theme.colors.brand.primaryLight }]}>
                        <Ionicons
                          name={selected ? "checkmark-circle" : "storefront-outline"}
                          size={20}
                          color={selected ? theme.colors.brand.primary : theme.colors.text.secondary}
                        />
                      </View>
                      <View style={s.branchText}>
                        <Text weight="black" style={s.branchName} numberOfLines={1}>
                          {branchName(b, i18n.language)}
                        </Text>
                        <Text style={s.branchAddress} numberOfLines={1}>
                          {i18n.language === "en" ? (b.addressEn || b.area) : (b.addressAr || b.area)}
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <CustomerUI.TextField
          label={t("prescriptions.transferRxLabel")}
          placeholder={t("prescriptions.transferRxPh")}
          value={rxNumber}
          onChangeText={setRxNumber}
          keyboardType="number-pad"
        />
        <CustomerUI.TextField
          label={t("prescriptions.transferMedNameLabel")}
          placeholder={t("prescriptions.transferMedNamePh")}
          value={name}
          onChangeText={setName}
        />
        <CustomerUI.TextField
          label={t("prescriptions.transferDoseLabel")}
          placeholder={t("prescriptions.transferDosePh")}
          value={dose}
          onChangeText={setDose}
        />
        <CustomerUI.TextField
          label={t("prescriptions.transferDoctorLabel")}
          placeholder={t("prescriptions.transferDoctorPh")}
          value={doctor}
          onChangeText={setDoctor}
        />

        {error && (
          <Text weight="bold" style={s.errorText}>{error}</Text>
        )}
      </ScrollView>

      <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <CustomerUI.Button
          label={t("prescriptions.transferSubmitCta")}
          onPress={onSave}
          loading={create.isPending}
          disabled={!canSave}
          fullWidth
          icon={<Ionicons name="swap-horizontal-outline" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}



function get_s(theme: NativeTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },
  header: {
    paddingHorizontal: 20, paddingBottom: 20, gap: 18,
    backgroundColor: theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  navRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", minHeight: 38 },
  backBtnTouchable: { borderRadius: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center",
  },
  backBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  identityRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14 },
  heroTile: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  identityText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10, lineHeight: 14, color: "#7C3AED",
    letterSpacing: 0.6, textTransform: "uppercase",
    textAlign: TEXT_START, includeFontPadding: false,
  },
  title: {
    fontSize: 26, lineHeight: 32, color: theme.colors.text.primary,
    letterSpacing: -0.5, textAlign: TEXT_START, includeFontPadding: false,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 16 },
  fieldLabel: {
    fontSize: 13, lineHeight: 18, color: theme.colors.text.primary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  fieldHint: {
    fontSize: 12, lineHeight: 17, color: theme.colors.text.secondary,
    textAlign: TEXT_START, marginTop: -10, includeFontPadding: false,
  },
  branchList: { gap: 10 },
  branchTouchable: { borderRadius: 12 },
  branchRow: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: theme.colors.canvas.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: theme.colors.border.default, ...theme.shadows[1],
  },
  branchRowSelected: { borderColor: theme.colors.brand.primary, backgroundColor: theme.colors.brand.primaryLight },
  branchRowPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  branchIconWell: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: theme.colors.canvas.surfaceMuted, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  branchText: { flex: 1, gap: 2 },
  branchName: {
    fontSize: 14, lineHeight: 19, color: theme.colors.text.primary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  branchAddress: {
    fontSize: 12, lineHeight: 16, color: theme.colors.text.secondary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  errorText: {
    fontSize: 13, lineHeight: 18, color: theme.colors.status.error,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  ctaBar: {
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: theme.colors.canvas.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border.default,
  },
}); }
