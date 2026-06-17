/**
 * GiftAddressSheet — full address capture for gift redemption.
 * VIP 2026: all legacy theme.colors.* → kit tokens. Premium modal design.
 *
 * Two modes:
 *   1. Saved address picker — select from user's saved addresses.
 *   2. New address form     — React Hook Form + zod, Arabic validation messages.
 *
 * Functional core preserved:
 *   • Zod schema unchanged (same validation rules).
 *   • GOVERNORATES list unchanged.
 *   • onConfirm shape unchanged (RedemptionAddress).
 *   • saveToProfile logic preserved.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { useAuth } from "@/features/auth/context";
import { useAddressStore } from "@/features/addresses";
import type { Address, AddressFormData } from "@/features/addresses";
import type { RedemptionAddress } from "../types";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type TFunc = ReturnType<typeof useTranslation>["t"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Egyptian governorates ────────────────────────────────────────────────────

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحيرة",
  "الفيوم", "الغربية", "الإسماعيلية", "المنوفية", "المنيا",
  "القليوبية", "الوادي الجديد", "السويس", "أسوان", "أسيوط",
  "بني سويف", "بورسعيد", "دمياط", "الشرقية", "جنوب سيناء",
  "كفر الشيخ", "مطروح", "الأقصر", "قنا", "شمال سيناء",
  "سوهاج", "البحر الأحمر",
];

// ─── Zod schema (unchanged) ───────────────────────────────────────────────────

const addressSchema = z.object({
  recipientName: z
    .string()
    .min(1, "الاسم مطلوب")
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(60, "الاسم طويل جداً"),
  phone: z
    .string()
    .min(1, "رقم الهاتف مطلوب")
    .regex(/^(\+20|0020|0)?1[0-2,5]{1}[0-9]{8}$/, "رقم الهاتف غير صحيح، مثال: 01xxxxxxxxx"),
  governorate: z
    .string()
    .min(1, "المحافظة مطلوبة"),
  city: z
    .string()
    .min(1, "المدينة مطلوبة")
    .min(2, "المدينة يجب أن تكون حرفين على الأقل"),
  street: z
    .string()
    .min(1, "الشارع مطلوب")
    .min(3, "عنوان الشارع قصير جداً"),
  building: z
    .string()
    .min(1, "رقم المبنى مطلوب"),
  floor: z.string().optional(),
  notes: z
    .string()
    .max(200, "الملاحظات طويلة جداً")
    .optional(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAddrLabel(label: string, t: TFunc): string {
  switch (label) {
    case "home":   return t("address.labelHome");
    case "work":   return t("address.labelWork");
    case "family": return t("address.labelFamily");
    default:       return t("address.labelOther");
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GiftAddressSheetProps {
  visible:    boolean;
  giftName:   string;
  pointsCost: number;
  submitting: boolean;
  onConfirm:  (address: RedemptionAddress) => void;
  onClose:    () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

type SheetMode = "picker" | "form";

export function GiftAddressSheet({
  visible,
  giftName,
  pointsCost,
  submitting,
  onConfirm,
  onClose,
}: GiftAddressSheetProps) {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();
  const { t }        = useTranslation();
  const addressesRaw = useAddressStore((s) => s.addresses);
  const addresses    = Array.isArray(addressesRaw) ? addressesRaw : [];
  const loading      = useAddressStore((s) => s.loading);
  const fetch        = useAddressStore((s) => s.fetch);
  const addAddress   = useAddressStore((s) => s.add);

  const [mode, setMode]               = useState<SheetMode>("picker");
  const [govDropdown, setGovDropdown] = useState(false);

  useEffect(() => {
    if (visible && user?.id) fetch(user.id).catch(() => {});
    if (visible) { setMode("picker"); setGovDropdown(false); }
  }, [visible, user?.id, fetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSaved = addresses.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[sh.sheet, { paddingTop: insets.top + 8 }]}>

          {/* ── Handle bar + header ── */}
          <View style={sh.handle} />
          <View style={[sh.header, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={sh.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={18} color={kit.color.inkSoft} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <UIText style={[sh.headerTitle, { textAlign: TEXT_START }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {t("loyalty.addressSheetTitle")}
              </UIText>
              <UIText style={[sh.headerSub, { textAlign: TEXT_START }]} numberOfLines={2} maxFontSizeMultiplier={1.4}>
                {t("loyalty.addressSheetSub", {
                  gift:   giftName,
                  points: pointsCost.toLocaleString("ar-EG"),
                })}
              </UIText>
            </View>
          </View>

          {/* ── Gift summary pill ── */}
          <View style={[sh.giftPill, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={sh.giftPillIcon}>
              <Ionicons name="gift-outline" size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={sh.giftPillText} numberOfLines={1}>{giftName}</UIText>
            <View style={[sh.costBadge, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="star" size={10} color={kit.color.accentDeep} />
              <UIText style={sh.costBadgeText}>{pointsCost.toLocaleString("ar-EG")}</UIText>
            </View>
          </View>

          {/* ── Mode selector ── */}
          {hasSaved && (
            <View style={[sh.modeRow, { flexDirection: flexRow(IS_RTL) }]}>
              <ModeTab
                label={t("loyalty.savedAddresses")}
                active={mode === "picker"}
                onPress={() => setMode("picker")}
              />
              <ModeTab
                label={t("loyalty.newAddress")}
                active={mode === "form"}
                onPress={() => setMode("form")}
              />
            </View>
          )}

          {/* ── Content ── */}
          {(!hasSaved || mode === "form") ? (
            <AddressForm
              onConfirm={onConfirm}
              submitting={submitting}
              insets={insets}
              govDropdown={govDropdown}
              setGovDropdown={setGovDropdown}
              userId={user?.id}
              hasSavedAddresses={hasSaved}
              addAddress={addAddress}
            />
          ) : (
            <SavedAddressPicker
              addresses={addresses}
              loading={loading}
              onSelect={onConfirm}
              onAddNew={() => setMode("form")}
              submitting={submitting}
              insets={insets}
            />
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ModeTab ──────────────────────────────────────────────────────────────────

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[sh.modeTab, active && sh.modeTabActive]}>
      <UIText style={[sh.modeTabText, active && sh.modeTabTextActive]} maxFontSizeMultiplier={1.3}>
        {label}
      </UIText>
    </Pressable>
  );
}

// ─── SavedAddressPicker ───────────────────────────────────────────────────────

interface SavedAddressPickerProps {
  addresses:  Address[];
  loading:    boolean;
  onSelect:   (addr: RedemptionAddress) => void;
  onAddNew:   () => void;
  submitting: boolean;
  insets:     { bottom: number };
}

function SavedAddressPicker({
  addresses, loading, onSelect, onAddNew, submitting, insets,
}: SavedAddressPickerProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(
    addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null,
  );

  useEffect(() => {
    const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0];
    if (defaultAddr) setSelectedId(defaultAddr.id);
  }, [addresses]);

  const handleConfirm = useCallback(() => {
    const addr = addresses.find((a) => a.id === selectedId);
    if (!addr) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSelect({
      name:        addr.recipient_name,
      phone:       addr.phone,
      governorate: addr.city,
      city:        addr.district || addr.city,
      district:    addr.district || undefined,
      street:      addr.street,
      building:    addr.building,
      floor:       addr.floor,
      apartment:   addr.apartment,
      notes:       addr.landmark,
    });
  }, [addresses, selectedId, onSelect]);

  if (loading) {
    return (
      <View style={sh.centered}>
        <UIText style={sh.loadingText}>{t("loyalty.loadingAddresses")}</UIText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}>

        {addresses.map((addr) => {
          const selected = selectedId === addr.id;
          return (
            <Pressable
              key={addr.id}
              onPress={() => setSelectedId(addr.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t("loyalty.addrA11y", {
                label: getAddrLabel(addr.label, t),
                name:  addr.recipient_name,
                city:  addr.city,
              })}
              style={({ pressed }) => [
                sh.addrCard,
                { flexDirection: flexRow(IS_RTL) },
                selected && sh.addrCardSelected,
                pressed && { opacity: 0.88 },
              ]}>
              <View style={sh.addrCardLeft}>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={selected ? kit.color.accentDeep : kit.color.inkFaint}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={[sh.addrCardHead, { flexDirection: flexRow(IS_RTL) }]}>
                  <UIText style={[sh.addrName, { textAlign: TEXT_START }]} maxFontSizeMultiplier={1.3}>
                    {addr.recipient_name}
                  </UIText>
                  <View style={sh.addrLabelPill}>
                    <UIText style={sh.addrLabelText} maxFontSizeMultiplier={1.2}>
                      {getAddrLabel(addr.label, t)}
                    </UIText>
                  </View>
                </View>
                <UIText style={[sh.addrLine, { textAlign: TEXT_START }]} maxFontSizeMultiplier={1.4} numberOfLines={2}>
                  {addr.city}،{"  "}{addr.district}،{"  "}{addr.street}
                  {addr.building ? `، مبنى ${addr.building}` : ""}
                  {addr.floor ? `، طابق ${addr.floor}` : ""}
                </UIText>
                <UIText style={[sh.addrPhone, { textAlign: TEXT_START }]} maxFontSizeMultiplier={1.3}>
                  {addr.phone}
                </UIText>
              </View>
            </Pressable>
          );
        })}

        <Pressable
          onPress={onAddNew}
          accessibilityRole="button"
          accessibilityLabel={t("loyalty.addNewAddress")}
          style={({ pressed }) => [sh.addNewBtn, { flexDirection: flexRow(IS_RTL) }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="add-circle-outline" size={16} color={kit.color.accentDeep} />
          <UIText style={sh.addNewText}>{t("loyalty.addNewAddress")}</UIText>
        </Pressable>
      </ScrollView>

      <View style={[sh.confirmFooter, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleConfirm}
          disabled={!selectedId || submitting}
          accessibilityRole="button"
          accessibilityLabel={t("loyalty.confirmAddressA11y")}
          accessibilityState={{ disabled: !selectedId || submitting, busy: submitting }}
          style={({ pressed }) => [
            sh.confirmBtn,
            { flexDirection: flexRow(IS_RTL) },
            (!selectedId || submitting) && sh.confirmBtnDisabled,
            pressed && selectedId && !submitting && { opacity: 0.9 },
          ]}>
          <Ionicons name="gift-outline" size={16} color={kit.color.onInk} />
          <UIText style={sh.confirmBtnText} maxFontSizeMultiplier={1.2}>
            {submitting ? t("loyalty.confirmAddressSending") : t("loyalty.confirmOrderLabel")}
          </UIText>
        </Pressable>
      </View>
    </View>
  );
}

// ─── AddressForm ──────────────────────────────────────────────────────────────

interface AddressFormProps {
  onConfirm:         (addr: RedemptionAddress) => void;
  submitting:        boolean;
  insets:            { bottom: number };
  govDropdown:       boolean;
  setGovDropdown:    (v: boolean) => void;
  userId?:           string;
  hasSavedAddresses: boolean;
  addAddress:        (userId: string, form: AddressFormData) => Promise<Address>;
}

function AddressForm({
  onConfirm,
  submitting,
  insets,
  govDropdown,
  setGovDropdown,
  userId,
  hasSavedAddresses,
  addAddress,
}: AddressFormProps) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver:      zodResolver(addressSchema),
    defaultValues: {
      recipientName: "",
      phone:         "",
      governorate:   "",
      city:          "",
      street:        "",
      building:      "",
      floor:         "",
      notes:         "",
    },
  });

  const watchedGov = watch("governorate");
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [saveError, setSaveError]         = useState<string | null>(null);

  const onSubmit: SubmitHandler<AddressFormValues> = useCallback(
    async (values) => {
      setSaveError(null);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (saveToProfile && userId) {
        const payload: AddressFormData = {
          label:          "home",
          recipient_name: values.recipientName,
          phone:          values.phone,
          city:           values.governorate,
          district:       values.city,
          street:         values.street,
          building:       values.building,
          floor:          values.floor?.trim() || "",
          apartment:      "",
          landmark:       values.notes?.trim() || "",
          lat:            undefined,
          lng:            undefined,
          is_default:     !hasSavedAddresses,
        };
        try { await addAddress(userId, payload); }
        catch { setSaveError(t("loyalty.addressSaveError")); }
      }

      onConfirm({
        name:        values.recipientName,
        phone:       values.phone,
        governorate: values.governorate,
        city:        values.city,
        street:      values.street,
        building:    values.building || undefined,
        floor:       values.floor?.trim() || undefined,
        notes:       values.notes?.trim() || undefined,
      });
    },
    [addAddress, hasSavedAddresses, onConfirm, saveToProfile, userId, t],
  );

  const onError = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Recipient name */}
        <Controller
          control={control}
          name="recipientName"
          render={({ field }) => (
            <FormField
              label={t("loyalty.recipientName")}
              placeholder="الاسم كامل"
              icon="person-outline"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.recipientName?.message}
            />
          )}
        />

        {/* Phone */}
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <FormField
              label={t("loyalty.phoneField")}
              placeholder="01xxxxxxxxx"
              icon="call-outline"
              keyboardType="phone-pad"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.phone?.message}
            />
          )}
        />

        {/* Governorate picker */}
        <View style={sh.fieldWrap}>
          <UIText style={[sh.fieldLabel, { textAlign: TEXT_START }]}>{t("loyalty.governorateField")}</UIText>
          <Pressable
            onPress={() => setGovDropdown(!govDropdown)}
            accessibilityRole="combobox"
            accessibilityLabel={t("loyalty.chooseGovernorateA11y")}
            accessibilityState={{ expanded: govDropdown }}
            style={[sh.fieldBox, { flexDirection: flexRow(IS_RTL) }, errors.governorate && sh.fieldBoxError]}>
            <Ionicons
              name={govDropdown ? "chevron-up" : "chevron-down"}
              size={14}
              color={kit.color.inkFaint}
            />
            <UIText
              style={[sh.fieldInput, !watchedGov && { color: kit.color.inkFaint }]}
              maxFontSizeMultiplier={1.3}>
              {watchedGov || t("loyalty.selectGovernorate")}
            </UIText>
          </Pressable>
          {errors.governorate && (
            <UIText style={[sh.fieldError, { textAlign: TEXT_START }]}>{errors.governorate.message}</UIText>
          )}
          {govDropdown && (
            <View style={sh.dropdown}>
              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                {GOVERNORATES.map((gov) => (
                  <Pressable
                    key={gov}
                    onPress={() => { setValue("governorate", gov, { shouldValidate: true }); setGovDropdown(false); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: watchedGov === gov }}
                    style={[sh.dropdownItem, watchedGov === gov && sh.dropdownItemActive]}>
                    <UIText
                      style={[sh.dropdownItemText, { textAlign: TEXT_START }, watchedGov === gov && sh.dropdownItemTextActive]}
                      maxFontSizeMultiplier={1.3}>
                      {gov}
                    </UIText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* City */}
        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <FormField
              label={t("loyalty.cityField")}
              placeholder="مثال: مدينة نصر"
              icon="location-outline"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.city?.message}
            />
          )}
        />

        {/* Street */}
        <Controller
          control={control}
          name="street"
          render={({ field }) => (
            <FormField
              label={t("loyalty.streetField")}
              placeholder="اسم أو رقم الشارع"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.street?.message}
            />
          )}
        />

        {/* Building + Floor row */}
        <View style={[sh.fieldRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="building"
              render={({ field }) => (
                <FormField
                  label={t("loyalty.buildingField")}
                  placeholder="مثال: 12"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.building?.message}
                />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="floor"
              render={({ field }) => (
                <FormField
                  label={t("loyalty.floorField")}
                  placeholder="مثال: 3"
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </View>
        </View>

        {/* Notes */}
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <FormField
              label={t("loyalty.notesField")}
              placeholder="بجوار مسجد، أمام حديقة…"
              icon="chatbubble-outline"
              value={field.value ?? ""}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.notes?.message}
              multiline
            />
          )}
        />

        {/* Save-to-profile toggle */}
        <Pressable
          onPress={() => setSaveToProfile((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saveToProfile }}
          style={({ pressed }) => [sh.saveRow, { flexDirection: flexRow(IS_RTL) }, pressed && { opacity: 0.9 }]}>
          <Ionicons
            name={saveToProfile ? "checkbox" : "square-outline"}
            size={18}
            color={saveToProfile ? kit.color.accentDeep : kit.color.inkFaint}
          />
          <UIText style={[sh.saveRowText, { textAlign: TEXT_START }]} maxFontSizeMultiplier={1.3}>
            {t("loyalty.saveToProfile")}
          </UIText>
        </Pressable>
        {saveError && (
          <UIText style={[sh.saveWarn, { textAlign: TEXT_START }]} accessibilityRole="alert" maxFontSizeMultiplier={1.4}>
            {saveError}
          </UIText>
        )}

      </ScrollView>

      <View style={[sh.confirmFooter, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSubmit(onSubmit, onError)}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t("loyalty.confirmAddressA11y")}
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [
            sh.confirmBtn,
            { flexDirection: flexRow(IS_RTL) },
            submitting && sh.confirmBtnDisabled,
            pressed && !submitting && { opacity: 0.9 },
          ]}>
          <Ionicons name="gift-outline" size={16} color={kit.color.onInk} />
          <UIText style={sh.confirmBtnText} maxFontSizeMultiplier={1.2}>
            {submitting ? t("loyalty.confirmAddressSending") : t("loyalty.confirmOrderLabel")}
          </UIText>
        </Pressable>
      </View>
    </View>
  );
}

// ─── FormField atom ───────────────────────────────────────────────────────────

interface FormFieldProps {
  label:         string;
  placeholder?:  string;
  icon?:         IoniconsName;
  value:         string;
  onChangeText:  (v: string) => void;
  onBlur?:       () => void;
  error?:        string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  multiline?:    boolean;
}

function FormField({
  label, placeholder, icon, value, onChangeText, onBlur, error, keyboardType, multiline,
}: FormFieldProps) {
  return (
    <View style={sh.fieldWrap}>
      <UIText style={[sh.fieldLabel, { textAlign: TEXT_START }]}>{label}</UIText>
      <View style={[
        sh.fieldBox,
        { flexDirection: flexRow(IS_RTL) },
        error     && sh.fieldBoxError,
        multiline && { minHeight: 76, alignItems: "flex-start" },
      ]}>
        {icon && (
          <Ionicons
            name={icon}
            size={14}
            color={kit.color.inkFaint}
            style={{ marginStart: 4, marginTop: multiline ? 14 : 0 }}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={kit.color.inkFaint}
          keyboardType={keyboardType ?? "default"}
          textAlign={TEXT_START as "left" | "right"}
          multiline={multiline}
          style={[sh.fieldInput, multiline && { paddingTop: 12, textAlignVertical: "top" }]}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel={label}
        />
      </View>
      {error && (
        <UIText style={[sh.fieldError, { textAlign: TEXT_START }]} accessibilityRole="alert">
          {error}
        </UIText>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  // ── Sheet shell ─────────────────────────────────────────────────────────────
  sheet: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: kit.color.lineStrong,
    alignSelf:       "center",
    marginBottom:    12,
  },
  header: {
    alignItems:        "flex-start",
    gap:               12,
    paddingHorizontal: 16,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         24,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  headerSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    marginTop:          3,
    includeFontPadding: false,
  },

  // ── Gift summary pill ────────────────────────────────────────────────────────
  giftPill: {
    alignItems:        "center",
    gap:               10,
    marginHorizontal:  16,
    marginTop:         12,
    paddingHorizontal: 14,
    paddingVertical:   10,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  giftPillIcon: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  giftPillText: {
    flex:               1,
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  costBadge: {
    alignItems:        "center",
    gap:               4,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       kit.color.line,
    flexShrink:        0,
  },
  costBadgeText: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Mode tabs ─────────────────────────────────────────────────────────────────
  modeRow: {
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     4,
    gap:               8,
  },
  modeTab: {
    flex:            1,
    paddingVertical: 10,
    borderRadius:    kit.radius.control,
    alignItems:      "center",
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  modeTabActive: {
    backgroundColor: kit.color.accentTint,
    borderColor:     kit.color.accent,
  },
  modeTabText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  modeTabTextActive: {
    color: kit.color.accentDeep,
  },

  // ── Utils ─────────────────────────────────────────────────────────────────────
  centered: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Saved address picker ──────────────────────────────────────────────────────
  addrCard: {
    gap:             12,
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    padding:         14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  addrCardSelected: {
    borderColor:     kit.color.accent,
    backgroundColor: kit.color.accentTint,
  },
  addrCardLeft: {
    paddingTop: 1,
  },
  addrCardHead: {
    alignItems:   "center",
    gap:          6,
    marginBottom: 5,
  },
  addrName: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    flex:               1,
    includeFontPadding: false,
  },
  addrLabelPill: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  addrLabelText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  addrLine: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  addrPhone: {
    fontFamily:    theme.fonts.bold,
    fontSize:      11,
    lineHeight:    17,
    color:         kit.color.inkFaint,
    marginTop:     4,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  addNewBtn: {
    alignItems:        "center",
    gap:               7,
    paddingVertical:   13,
    paddingHorizontal: 14,
    borderRadius:      kit.radius.lg,
    borderWidth:       1.5,
    borderColor:       kit.color.line,
    borderStyle:       "dashed",
    backgroundColor:   kit.color.accentTint,
    justifyContent:    "center",
    marginTop:         4,
  },
  addNewText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Form fields ───────────────────────────────────────────────────────────────
  fieldWrap: { gap: 5 },
  fieldRow:  { gap: 10 },
  fieldLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    paddingEnd:         2,
    includeFontPadding: false,
  },
  fieldBox: {
    alignItems:        "center",
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1.5,
    borderColor:       kit.color.line,
    paddingHorizontal: 12,
    minHeight:         48,
  },
  fieldBoxError: {
    borderColor:     kit.color.danger,
    backgroundColor: kit.color.dangerTint,
  },
  fieldInput: {
    flex:               1,
    fontFamily:         theme.fonts.semibold,
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.ink,
    paddingVertical:    10,
    includeFontPadding: false,
  },
  fieldError: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.danger,
    paddingEnd:         4,
    includeFontPadding: false,
  },

  // ── Save toggle ───────────────────────────────────────────────────────────────
  saveRow: {
    alignItems:        "center",
    gap:               8,
    paddingVertical:   11,
    paddingHorizontal: 12,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  saveRowText: {
    flex:               1,
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  saveWarn: {
    marginTop:          6,
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.warn,
    paddingEnd:         4,
    includeFontPadding: false,
  },

  // ── Governorate dropdown ──────────────────────────────────────────────────────
  dropdown: {
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    backgroundColor: kit.color.surface,
    marginTop:       4,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical:   12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  dropdownItemActive: {
    backgroundColor: kit.color.accentTint,
  },
  dropdownItemText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  dropdownItemTextActive: {
    color:      kit.color.accentDeep,
    fontFamily: theme.fonts.black,
  },

  // ── Confirm footer ────────────────────────────────────────────────────────────
  confirmFooter: {
    paddingHorizontal: 16,
    paddingTop:        12,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
    backgroundColor:   kit.color.canvas,
  },
  confirmBtn: {
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    backgroundColor: kit.color.ink,
    borderRadius:    kit.radius.lg,
    paddingVertical: 16,
    ...kit.shadow.raised,
  },
  confirmBtnDisabled: {
    backgroundColor: kit.color.inkFaint,
  },
  confirmBtnText: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.onInk,
    includeFontPadding: false,
  },
});

export default GiftAddressSheet;
