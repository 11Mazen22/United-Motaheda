import { useTheme, type NativeTheme } from "@pharmacy/ui-native";

import React, { useCallback, useMemo, useState } from "react";

import { ScrollView, StyleSheet, View, Pressable } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useTranslation } from "react-i18next";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomerUI } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

import { useAuth } from "@/features/auth";

import { usePrescriptions } from "@/features/prescriptions";

import { usePrescriptionMutations } from "@/features/prescriptions";

import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";



const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);



export default function Page(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { t }     = useTranslation();
  const { user }  = useAuth();
  const existing  = usePrescriptions();
  const { create } = usePrescriptionMutations(user?.id);

  const [name,         setName]         = useState("");
  const [dose,         setDose]         = useState("");
  const [rxNumber,     setRxNumber]     = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes,        setNotes]        = useState("");
  const [error,        setError]        = useState<string | null>(null);

  const isDuplicate = useMemo(
    () => rxNumber.trim().length >= 7 && existing.some((rx) => rx.rxNumber === rxNumber.trim()),
    [existing, rxNumber],
  );

  const canSave = name.trim().length > 0 && !create.isPending && !!user?.id && !isDuplicate;

  const onSave = useCallback(async () => {
    if (!user?.id) return;
    if (name.trim().length === 0) {
      setError(t("prescriptions.manualRequired"));
      return;
    }
    if (isDuplicate) {
      setError(t("prescriptions.manualDuplicateBody"));
      return;
    }
    setError(null);
    try {
      const created = await create.mutateAsync({
        input: { name: name.trim(), dose: dose.trim() || undefined, rxNumber: rxNumber.trim() || undefined },
      });
      showSuccessSheet(
        t("prescriptions.manualSavedTitle"),
        t("prescriptions.manualSavedBody"),
        () => router.replace(`/prescriptions/${created.id}` as never),
      );
    } catch {
      showErrorSheet(t("prescriptions.manualSaveErrorTitle"), t("prescriptions.manualSaveErrorBody"));
    }
  }, [user?.id, name, dose, rxNumber, isDuplicate, create, router, t]);

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.navRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={s.backBtnTouchable}>
            {({ pressed }) => (
              <View style={[s.backBtn, pressed && s.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.text.primary} />
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.identityRow}>
          <View style={s.heroTile}>
            <Ionicons name="keypad-outline" size={24} color={theme.colors.status.warning} />
          </View>
          <View style={s.identityText}>
            <Text weight="bold" style={s.eyebrow}>
              {t("prescriptions.manualEyebrow")}
            </Text>
            <Text weight="black" style={s.title}>
              {t("prescriptions.manualEntryTitle")}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <CustomerUI.Notice
          variant="info"
          message={t("prescriptions.manualPrivacy")}
        />

        <CustomerUI.TextField
          label={t("prescriptions.manualMedNameLabel")}
          placeholder={t("prescriptions.manualMedNamePh")}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />

        <CustomerUI.TextField
          label={t("prescriptions.manualDoseLabel")}
          placeholder={t("prescriptions.manualDosePh")}
          value={dose}
          onChangeText={setDose}
          returnKeyType="next"
        />

        <CustomerUI.TextField
          label={t("prescriptions.manualRxLabel")}
          placeholder={t("prescriptions.manualRxPh")}
          value={rxNumber}
          onChangeText={setRxNumber}
          keyboardType="number-pad"
          error={isDuplicate ? t("prescriptions.manualDuplicateBody") : undefined}
        />

        <CustomerUI.TextField
          label={t("prescriptions.manualInstructionsLabel")}
          placeholder={t("prescriptions.manualInstructionsPh")}
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={3}
        />

        <CustomerUI.TextField
          label={t("prescriptions.manualNotesLabel")}
          placeholder={t("prescriptions.manualNotesPh")}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {error && (
          <Text weight="bold" style={s.errorText}>
            {error}
          </Text>
        )}
      </ScrollView>

      <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <CustomerUI.Button
          label={t("prescriptions.manualSubmitCta")}
          onPress={onSave}
          loading={create.isPending}
          disabled={!canSave}
          fullWidth
          icon={<Ionicons name="checkmark" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}



function get_s(theme: NativeTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
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
    backgroundColor: `${theme.colors.status.warning}1A`, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  identityText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10, lineHeight: 14, color: theme.colors.brand.primary,
    letterSpacing: 0.6, textTransform: "uppercase",
    textAlign: TEXT_START, includeFontPadding: false,
  },
  title: {
    fontSize: 28, lineHeight: 34, color: theme.colors.text.primary,
    letterSpacing: -0.6, textAlign: TEXT_START, includeFontPadding: false,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 16,
  },
  errorText: {
    fontSize: 13, lineHeight: 18, color: theme.colors.status.error,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  ctaBar: {
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: theme.colors.canvas.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
}); }
