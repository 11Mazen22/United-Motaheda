import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/Input";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit, SegmentedToggle } from "@/shared/kit";
import {
  BranchSelector,
  SUPPORTED_GOVERNORATE,
  type Branch,
} from "@/features/delivery";
import { type Address } from "@/features/addresses";

import { type CheckoutFormSchema } from "../schema";
import { type CheckoutPaymentMethod } from "../constants";
import { SectionCard } from "./SectionCard";
import { PaymentMethodCards } from "./PaymentMethodCards";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface DetailsStepProps {
  control:               Control<CheckoutFormSchema>;
  errors:                FieldErrors<CheckoutFormSchema>;
  selectedBranchId:      string | null;
  onSelectBranch:        (b: Branch) => void;
  deliveryBranch:        Branch | null;
  outOfServiceMessage:   string | null;
  user:                  { id?: string; name?: string | null } | null;
  savedProfilePhone:     string | null;
  useAccountProfile:     boolean;
  onToggleAccountProfile:(value: boolean) => void;
  defaultAddress:        Address | null;
  useSavedAddress:       boolean;
  onToggleSavedAddress:  (value: boolean) => void;
  paymentMethod:         CheckoutPaymentMethod;
  onPaymentChange:       (m: CheckoutPaymentMethod) => void;
  subtotal:              number;
  onSignIn:              () => void;
}

export const DetailsStep = React.memo(function DetailsStep({
  control,
  errors,
  selectedBranchId,
  onSelectBranch,
  deliveryBranch,
  outOfServiceMessage,
  user,
  savedProfilePhone,
  useAccountProfile,
  onToggleAccountProfile,
  defaultAddress,
  useSavedAddress,
  onToggleSavedAddress,
  paymentMethod,
  onPaymentChange,
  subtotal,
  onSignIn,
}: DetailsStepProps) {
  const { t, i18n } = useTranslation();
  const hasSavedAccount = Boolean(user?.name || savedProfilePhone);
  const sep = i18n.language.startsWith("en") ? ", " : "ØŒ ";

  const addressSummary = defaultAddress
    ? [
        defaultAddress.street,
        defaultAddress.building
          ? t("orders.building", { n: defaultAddress.building })
          : null,
        defaultAddress.floor
          ? t("orders.floor", { n: defaultAddress.floor })
          : null,
        defaultAddress.apartment
          ? t("orders.apt", { n: defaultAddress.apartment })
          : null,
      ]
        .filter(Boolean)
        .join(sep)
    : null;

  const handleSelectBranch = useCallback(
    (b: Branch) => onSelectBranch(b),
    [onSelectBranch],
  );

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      {/* Sign-in required banner */}
      {!user?.id && (
        <Animated.View entering={FadeInDown.duration(280)} style={s.signInBanner}>
          <View style={s.signInIcon}>
            <Ionicons name="person-circle-outline" size={22} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <UIText variant="body-sm" weight="extrabold" align={TEXT_START} style={{ color: kit.color.ink }}>
              {t("checkout.signInRequired")}
            </UIText>
            <UIText variant="caption" color="secondary" align={TEXT_START}>
              {t("checkout.signInDesc")}
            </UIText>
          </View>
          <Pressable onPress={onSignIn} style={s.signInBtn} hitSlop={4}>
            <UIText variant="eyebrow" weight="bold" style={{ color: "#fff" }}>
              {t("checkout.signInBtn")}
            </UIText>
          </Pressable>
        </Animated.View>
      )}

      {/* Branch */}
      <SectionCard title={t("checkout.branchSection")} icon="storefront-outline" delay={20}>
        <UIText style={s.hint}>{t("checkout.branchHint")}</UIText>
        <BranchSelector
          selectedId={selectedBranchId ?? deliveryBranch?.id ?? null}
          onSelect={handleSelectBranch}
          compact
        />
        {outOfServiceMessage && (
          <Animated.View entering={FadeIn.duration(200)} style={s.warning}>
            <Ionicons name="alert-circle-outline" size={14} color={kit.color.warn} />
            <UIText style={s.warningText}>{outOfServiceMessage}</UIText>
          </Animated.View>
        )}
      </SectionCard>

      {/* Saved profile autofill */}
      {hasSavedAccount && (
        <SectionCard
          title={t("checkout.profileSection")}
          icon="person-circle-outline"
          delay={50}>
          <UIText style={s.hint}>{t("checkout.profileHint")}</UIText>
          <View style={s.toggleWrap}>
            <SegmentedToggle<"saved" | "new">
              value={useAccountProfile ? "saved" : "new"}
              onChange={(v) => onToggleAccountProfile(v === "saved")}
              options={[
                { value: "saved", label: t("checkout.useAccountData") },
                { value: "new",   label: t("checkout.enterNewData")   },
              ]}
              size="md"
            />
          </View>
          <View style={s.metaRow}>
            <UIText style={s.metaLabel}>{t("auth.name")}</UIText>
            <UIText style={s.metaValue}>{user?.name ?? "â€”"}</UIText>
          </View>
          <View style={s.metaRow}>
            <UIText style={s.metaLabel}>{t("auth.phone")}</UIText>
            <UIText style={s.metaValue}>{savedProfilePhone ?? "â€”"}</UIText>
          </View>
          <UIText style={s.savedHelp}>
            {useAccountProfile
              ? t("checkout.saveProfileHint")
              : t("checkout.customDataHint")}
          </UIText>
        </SectionCard>
      )}

      {/* Personal info */}
      <SectionCard
        title={t("checkout.personalSection")}
        icon="person-outline"
        delay={hasSavedAccount ? 90 : 50}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Input
              label={t("checkout.nameLabel")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t("checkout.namePlaceholder")}
              error={errors.fullName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              label={t("auth.phone")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="01xxxxxxxxx"
              keyboardType="phone-pad"
              error={errors.phone?.message}
            />
          )}
        />
      </SectionCard>

      {/* Address */}
      <SectionCard title={t("checkout.addressSection")} icon="location-outline" delay={120}>
        {defaultAddress ? (
          <View style={s.savedAddressBanner}>
            <UIText style={s.savedAddressTitle}>{t("checkout.defaultAddrTitle")}</UIText>
            <UIText style={s.savedAddressHint}>{t("checkout.defaultAddrHint")}</UIText>
            <UIText style={s.savedAddressSummary}>{addressSummary}</UIText>
            <View style={s.toggleWrap}>
              <SegmentedToggle<"saved" | "new">
                value={useSavedAddress ? "saved" : "new"}
                onChange={(v) => onToggleSavedAddress(v === "saved")}
                options={[
                  { value: "saved", label: t("checkout.useSavedAddress")   },
                  { value: "new",   label: t("checkout.enterNewAddress")   },
                ]}
                size="md"
              />
            </View>
          </View>
        ) : (
          <UIText style={s.savedAddressHint}>{t("checkout.noAddrHint")}</UIText>
        )}

        {/* City (Cairo-only) */}
        <View style={s.cityCard}>
          <View style={s.cityHead}>
            <View style={s.cityIcon}>
              <Ionicons name="business-outline" size={14} color={kit.color.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <UIText style={s.cityLabel}>{t("checkout.cityLabel")}</UIText>
              <UIText style={s.cityValue}>{SUPPORTED_GOVERNORATE.ar}</UIText>
            </View>
            <View style={s.cityBadge}>
              <UIText style={s.cityBadgeText}>{t("checkout.cairoOnly")}</UIText>
            </View>
          </View>
        </View>

        <Controller
          control={control}
          name="streetName"
          render={({ field }) => (
            <Input
              label={t("checkout.streetLabel")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t("checkout.streetPlaceholder")}
              error={errors.streetName?.message}
            />
          )}
        />

        <View style={s.row3}>
          <Controller
            control={control}
            name="buildingNumber"
            render={({ field }) => (
              <View style={{ flex: 1 }}>
                <Input
                  label={t("checkout.buildingLabel")}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="10"
                  keyboardType="number-pad"
                  error={errors.buildingNumber?.message}
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name="floor"
            render={({ field }) => (
              <View style={{ flex: 1 }}>
                <Input
                  label={t("checkout.floorLabel")}
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  placeholder="3"
                  keyboardType="number-pad"
                  optional
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name="apartmentNumber"
            render={({ field }) => (
              <View style={{ flex: 1 }}>
                <Input
                  label={t("checkout.aptLabel")}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="5"
                  keyboardType="number-pad"
                  error={errors.apartmentNumber?.message}
                />
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <Input
              label={t("checkout.notesLabel")}
              value={field.value ?? ""}
              onChangeText={field.onChange}
              placeholder={t("checkout.notesPlaceholder")}
              multiline
              numberOfLines={3}
              optional
            />
          )}
        />
      </SectionCard>

      {/* Payment */}
      <SectionCard title={t("checkout.paymentSection")} icon="card-outline" delay={160}>
        <PaymentMethodCards
          selected={paymentMethod}
          subtotal={subtotal}
          onChange={onPaymentChange}
        />
      </SectionCard>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  // Sign-in banner
  signInBanner: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               12,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      16,
    paddingHorizontal: theme.spacing[4] - 2,
    paddingVertical:   14,
    marginBottom:      16,
    borderWidth:       1.5,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  signInIcon: {
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  signInBtn: {
    backgroundColor:   kit.color.accent,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },

  // Branch warning
  hint: {
    fontSize:     11,
    fontFamily:   theme.fonts.regular,
    color:        kit.color.inkFaint,
    textAlign:    textAlignStart(isRtl()),
    marginBottom: 4,
  },
  warning: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "flex-start",
    gap:               8,
    padding:           10,
    borderRadius:      12,
    backgroundColor:   kit.color.warnTint,
    borderWidth:       1,
    borderColor:       kit.color.warn,
    marginTop:         6,
  },
  warningText: {
    flex:       1,
    fontSize:   11,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.warn,
    textAlign:  textAlignStart(isRtl()),
    lineHeight: 16,
  },

  // Profile/address toggle wrapper
  toggleWrap: {
    marginBottom: 14,
  },

  // Profile meta rows
  metaRow: {
    flexDirection:     flexRow(isRtl()),
    justifyContent:    "space-between",
    gap:               10,
    paddingVertical:   6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.lineStrong,
  },
  metaLabel: {
    fontSize:   11,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
  },
  metaValue: {
    fontSize:   12,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
    textAlign:  textAlignStart(isRtl()),
    flex:       1,
  },
  savedHelp: {
    marginTop:  8,
    fontSize:   11,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
    lineHeight: 18,
  },

  // Saved address banner
  savedAddressBanner: {
    padding:         14,
    borderRadius:    16,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    marginBottom:    16,
  },
  savedAddressTitle: {
    fontSize:     12,
    fontFamily:   theme.fonts.bold,
    color:        kit.color.ink,
    textAlign:    textAlignStart(isRtl()),
    marginBottom: 4,
  },
  savedAddressHint: {
    fontSize:     11,
    fontFamily:   theme.fonts.regular,
    color:        kit.color.inkFaint,
    textAlign:    textAlignStart(isRtl()),
    lineHeight:   18,
    marginBottom: 10,
  },
  savedAddressSummary: {
    fontSize:     12,
    fontFamily:   theme.fonts.semibold,
    color:        kit.color.ink,
    textAlign:    textAlignStart(isRtl()),
    marginBottom: 12,
  },

  // City card
  cityCard: {
    backgroundColor: kit.color.accentTint,
    borderRadius:    12,
    padding:         12,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  cityHead:   { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 10 },
  cityIcon: {
    width:           30,
    height:          30,
    borderRadius:    9,
    backgroundColor: "#fff",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cityLabel: {
    fontSize:   10,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
  },
  cityValue: {
    fontSize:   13,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
    textAlign:  textAlignStart(isRtl()),
  },
  cityBadge: {
    backgroundColor:   kit.color.warnTint,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      999,
  },
  cityBadgeText: {
    fontSize:   9,
    fontFamily: theme.fonts.bold,
    color:      kit.color.warn,
  },

  row3: { flexDirection: flexRow(isRtl()), gap: 8 },
});
