import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { kit, Text as UIText } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart, textAlignEnd } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const TEXT_END = textAlignEnd(IS_RTL);

function ClinRow({ icon, label, value, last = false }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[clin.row, last && { borderBottomWidth: 0 }, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={clin.rowIcon}>
        <Ionicons name={icon} size={13} color={kit.color.inkFaint} />
      </View>
      <UIText variant="body-sm" style={clin.rowLabel}>{label}</UIText>
      <UIText variant="body-sm" weight="bold" style={clin.rowValue} numberOfLines={1}>{value}</UIText>
    </View>
  );
}

export const ProductDetailsSection = React.memo(function ProductDetailsSection({ product, profileExpanded, handleProfileToggle, t }: any) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(260).springify().damping(22)} style={clin.card}>
      <View style={[clin.header, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={clin.headerIcon}>
          <Ionicons name="document-text-outline" size={16} color={kit.color.accentDeep} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <UIText variant="caption" weight="bold" style={{ color: kit.color.accentDeep, textAlign: TEXT_START }}>
            {t("product.detailsEyebrow")}
          </UIText>
          <UIText variant="title-md" weight="black" style={{ textAlign: TEXT_START }}>
            {t("product.clinProfileTitle")}
          </UIText>
        </View>
      </View>

      <View style={[clin.attestation, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={clin.attestationDot} />
        <UIText variant="caption" style={{ color: kit.color.inkSoft, flex: 1, textAlign: TEXT_START }}>
          {t("product.clinAttestation")}
        </UIText>
      </View>

      <View style={clin.body}>
        <ClinRow icon="barcode-outline" label={t("product.code")} value={product.code ?? "-"} />
        <ClinRow icon="folder-outline" label={t("product.category")} value={product.categoryName ?? "-"} last={!profileExpanded} />
        {profileExpanded && (
          <Animated.View entering={FadeInDown.duration(300).springify().damping(20)}>
            <ClinRow icon="scan-outline" label={t("product.barcode")} value={product.barcode ? (isNaN(+product.barcode) ? product.barcode : (+product.barcode).toFixed(0)) : "-"} />
            <ClinRow icon="language-outline" label={t("product.nameEnLabel")} value={product.nameEn ?? "-"} last />
          </Animated.View>
        )}
      </View>

      <Pressable
        onPress={handleProfileToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: profileExpanded }}
        accessibilityLabel={profileExpanded ? t("product.clinCollapse") : t("product.clinExpandAll")}
        style={clin.expandBtnTouchable}>
        {({ pressed }) => (
          <View style={[clin.expandBtn, pressed && clin.expandBtnPressed]}>
            <UIText variant="body-sm" weight="black" style={{ color: kit.color.accentDeep }}>
              {profileExpanded ? t("product.clinCollapse") : t("product.clinExpandAll")}
            </UIText>
            <View style={clin.expandChevronWell}>
              <Ionicons name={profileExpanded ? "chevron-up" : "chevron-down"} size={15} color={kit.color.accentDeep} />
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

const clin = StyleSheet.create({
  card: { backgroundColor: kit.color.surface, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: kit.color.line, borderTopWidth: 3, borderTopColor: kit.color.accentDeep, ...kit.shadow.raised },
  header: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, gap: 12 },
  headerIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: kit.color.accentTint, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(14,126,116,0.18)" },
  attestation: { alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, backgroundColor: kit.color.well },
  attestationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: kit.color.accentDeep, flexShrink: 0 },
  body: { paddingHorizontal: 18 },
  row: { alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, gap: 10 },
  rowIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: kit.color.well, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kit.color.line, flexShrink: 0 },
  rowLabel: { color: kit.color.inkSoft, flex: 1, textAlign: TEXT_START },
  rowValue: { color: kit.color.ink, maxWidth: "50%", textAlign: TEXT_END },
  expandBtnTouchable: {},
  expandBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: kit.color.line, backgroundColor: kit.color.surface },
  expandBtnPressed: { backgroundColor: kit.color.well },
  expandChevronWell: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: "rgba(14,126,116,0.18)" },
});
