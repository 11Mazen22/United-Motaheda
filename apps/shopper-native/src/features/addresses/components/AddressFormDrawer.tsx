import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AddressMapPlaceholder } from "./AddressMapPlaceholder";
import { ADDRESS_LABELS } from "../types";
import type { Address, AddressFormData } from "../types";
import { SUPPORTED_GOVERNORATE } from "@/features/delivery/constants";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const _isRtl = isRtl();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  visible: boolean;
  address?: Address | null;
  onClose: () => void;
  onSubmit: (data: AddressFormData) => void;
  loading?: boolean;
}

const EMPTY_FORM: AddressFormData = {
  label: "home",
  recipient_name: "",
  phone: "",
  city: SUPPORTED_GOVERNORATE.ar,
  district: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  landmark: "",
  is_default: false,
};

// ─── Shake Animation Hook ───────────────────────────────────────────────────
function useShakeOnError(error?: string) {
  const offset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  useEffect(() => {
    if (error) {
      // بدء الهزة مباشرة بدون withSpring غير ضروري
      offset.value = withTiming(-6, { duration: 50 }, () => {
        offset.value = withTiming(6, { duration: 50 }, () => {
          offset.value = withTiming(-4, { duration: 50 }, () => {
            offset.value = withTiming(4, { duration: 50 }, () => {
              offset.value = withTiming(0, { duration: 50 });
            });
          });
        });
      });
    }
  }, [error]);

  return shakeStyle;
}

// ─── Phone Validation ───────────────────────────────────────────────────────
const PHONE_REGEX = /^(?:\+20|0020|0)?1[0125]\d{8}$/;
const PHONE_EXAMPLE = "01012345678";

function getPhoneError(phone: string, t: TFunction): string | undefined {
  const trimmed = phone.trim();
  if (!trimmed) return t("common.required");
  if (!PHONE_REGEX.test(trimmed)) return t("addressForm.phoneInvalid", { example: PHONE_EXAMPLE });
  return undefined;
}

// ─── Steps Definition ───────────────────────────────────────────────────────
const STEPS = [
  {
    key:         "type_recipient",
    titleKey:    "addressForm.stepTypeTitle",
    subtitleKey: "addressForm.stepTypeSubtitle",
    icon:        "person-outline" as IoniconsName,
  },
  {
    key:         "address_details",
    titleKey:    "addressForm.stepDetailsTitle",
    subtitleKey: "addressForm.stepDetailsSubtitle",
    icon:        "map-outline" as IoniconsName,
  },
  {
    key:         "confirm",
    titleKey:    "addressForm.stepConfirmTitle",
    subtitleKey: "addressForm.stepConfirmSubtitle",
    icon:        "checkmark-circle-outline" as IoniconsName,
  },
];

type StepKey = typeof STEPS[number]["key"];

const STEP_FIELDS: Record<StepKey, (keyof AddressFormData)[]> = {
  type_recipient: ["label", "recipient_name", "phone"],
  address_details: ["city", "district", "street", "building", "floor", "apartment", "landmark"],
  confirm: [],
};

const REQUIRED_FIELDS: (keyof AddressFormData)[] = [
  "label",
  "recipient_name",
  "phone",
  "city",
  "district",
  "street",
  "building",
];

// ─── Address Form Drawer ────────────────────────────────────────────────────
export function AddressFormDrawer({
  visible,
  address,
  onClose,
  onSubmit,
  loading,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isEdit = !!address;

  const [form, setForm] = useState<AddressFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressFormData, string>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const currentStepKey = STEPS[currentStepIdx].key;
  const [showDiscard, setShowDiscard] = useState(false);

  // ── Reset form when drawer opens ──
  useEffect(() => {
    if (visible) {
      if (address) {
        setForm({
          label: address.label,
          recipient_name: address.recipient_name,
          phone: address.phone,
          city: SUPPORTED_GOVERNORATE.ar,
          district: address.district,
          street: address.street,
          building: address.building,
          floor: address.floor ?? "",
          apartment: address.apartment ?? "",
          landmark: address.landmark ?? "",
          is_default: address.is_default,
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      setIsDirty(false);
      isDirtyRef.current = false;
      setCurrentStepIdx(0);
    }
  }, [visible, address]);

  const updateField = useCallback(
    (key: keyof AddressFormData, value: string | boolean) => {
      setForm((prev) => {
        const updated = { ...prev, [key]: value };
        if (!isDirtyRef.current) {
          const initial = address
            ? {
                ...EMPTY_FORM,
                label: address.label,
                recipient_name: address.recipient_name,
                phone: address.phone,
                district: address.district,
                street: address.street,
                building: address.building,
                floor: address.floor ?? "",
                apartment: address.apartment ?? "",
                landmark: address.landmark ?? "",
                is_default: address.is_default,
              }
            : EMPTY_FORM;
          if (JSON.stringify(updated) !== JSON.stringify(initial)) {
            setIsDirty(true);
            isDirtyRef.current = true;
          }
        }
        return updated;
      });
      setErrors((e) => ({ ...e, [key]: undefined }));
    },
    [address],
  );

  const completionPercent = useMemo(() => {
    const filled = REQUIRED_FIELDS.filter((field) => {
      const val = form[field];
      return typeof val === "string" && val.trim().length > 0;
    }).length;
    return Math.round((filled / REQUIRED_FIELDS.length) * 100);
  }, [form]);

  const validateStep = useCallback(
    (stepKey: StepKey): boolean => {
      const fields = STEP_FIELDS[stepKey];
      const newErrors: typeof errors = {};

      if (fields.includes("label") && !form.label) {
        newErrors.label = t("addressForm.selectLabel");
      }
      if (fields.includes("recipient_name")) {
        if (!form.recipient_name.trim()) newErrors.recipient_name = t("common.required");
        else if (form.recipient_name.trim().length < 3)
          newErrors.recipient_name = t("addressForm.nameTooShort");
      }
      if (fields.includes("phone")) {
        const phoneError = getPhoneError(form.phone, t);
        if (phoneError) newErrors.phone = phoneError;
      }
      if (fields.includes("city") && !form.city.trim()) newErrors.city = t("common.required");
      if (fields.includes("district") && !form.district.trim())
        newErrors.district = t("common.required");
      if (fields.includes("street") && !form.street.trim())
        newErrors.street = t("common.required");
      if (fields.includes("building") && !form.building.trim())
        newErrors.building = t("common.required");

      setErrors((prev) => ({ ...prev, ...newErrors }));
      return Object.keys(newErrors).length === 0;
    },
    [form],
  );

  const validateAll = useCallback((): { valid: boolean; errors: typeof errors } => {
    const newErrors: typeof errors = {};
    if (!form.label) newErrors.label = t("addressForm.selectLabel");
    if (!form.recipient_name.trim()) newErrors.recipient_name = t("common.required");
    else if (form.recipient_name.trim().length < 3)
      newErrors.recipient_name = t("addressForm.nameTooShort");
    const phoneError = getPhoneError(form.phone, t);
    if (phoneError) newErrors.phone = phoneError;
    if (!form.city.trim()) newErrors.city = t("common.required");
    if (!form.district.trim()) newErrors.district = t("common.required");
    if (!form.street.trim()) newErrors.street = t("common.required");
    if (!form.building.trim()) newErrors.building = t("common.required");
    setErrors(newErrors);
    return { valid: Object.keys(newErrors).length === 0, errors: newErrors };
  }, [form]);

  const goToNextStep = useCallback(() => {
    if (currentStepIdx < STEPS.length - 1) {
      if (validateStep(currentStepKey)) {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        setCurrentStepIdx((prev) => prev + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }
  }, [currentStepIdx, currentStepKey, validateStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIdx > 0) {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      setCurrentStepIdx((prev) => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [currentStepIdx]);

  const handleSubmit = useCallback(() => {
    const { valid, errors: validationErrors } = validateAll();
    if (!valid) {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const firstErrorField = Object.keys(validationErrors)[0] as keyof AddressFormData;
      if (firstErrorField) {
        const stepIdx = STEPS.findIndex((s) =>
          STEP_FIELDS[s.key].includes(firstErrorField),
        );
        if (stepIdx >= 0) {
          setCurrentStepIdx(stepIdx);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      }
      return;
    }
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSubmit(form);
  }, [form, validateAll, onSubmit]);

  const handleCloseRequest = useCallback(() => {
    // لا نغلق أثناء التحميل
    if (loading) return;

    if (isDirty) {
      if (Platform.OS === "web" && typeof globalThis !== "undefined" && "window" in globalThis) {
        const confirmDiscard = (globalThis as any).window.confirm(
          t("addressForm.confirmDiscardWeb"),
        );
        if (confirmDiscard) onClose();
        return;
      }

      setShowDiscard(true);
    } else {
      onClose();
    }
  }, [isDirty, loading, onClose]);

  // ── Animated progress value ──
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(completionPercent / 100, { duration: 600 });
  }, [completionPercent]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
  }));

  const isLastStep = currentStepIdx === STEPS.length - 1;
  const isFirstStep = currentStepIdx === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseRequest}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
          {/* ── Header with dynamic title ── */}
          <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
            <Pressable
              onPress={handleCloseRequest}
              style={styles.closeBtn}
              hitSlop={24}
              pressRetentionOffset={{ top: 18, bottom: 18, left: 18, right: 18 }}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              android_ripple={{
                color: theme.colors.slate[200],
                borderless: false,
                radius: 18,
              }}
            >
              <Ionicons name="close" size={18} color={theme.colors.slate[600]} />
            </Pressable>
            <View style={styles.headerCenter}>
              <UIText style={styles.headerTitle}>
                {isEdit ? t("addressForm.editTitle") : t("addressForm.addTitle")}
              </UIText>
              <UIText style={styles.headerStepSubtitle}>
                {t(STEPS[currentStepIdx].subtitleKey)}
              </UIText>
            </View>
            <View style={{ width: 36 }} />
          </Animated.View>

          {/* ── Step Indicator (compact pills) ── */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.stepIndicatorRow}>
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStepIdx;
              const isCompleted = idx < currentStepIdx;
              return (
                <Pressable
                  key={step.key}
                  onPress={() => {
                    if (idx < currentStepIdx) setCurrentStepIdx(idx);
                  }}
                  style={[
                    styles.stepPill,
                    isActive && styles.stepPillActive,
                    isCompleted && styles.stepPillCompleted,
                  ]}
                >
                  <Ionicons
                    name={isCompleted ? "checkmark-circle" : step.icon}
                    size={16}
                    color={
                      isActive
                        ? "#fff"
                        : isCompleted
                        ? theme.colors.brand[600]
                        : theme.colors.slate[400]
                    }
                  />
                  <UIText
                    style={[
                      styles.stepPillText,
                      isActive && styles.stepPillTextActive,
                      isCompleted && styles.stepPillTextCompleted,
                    ]}
                    numberOfLines={1}
                  >
                    {t(step.titleKey)}
                  </UIText>
                </Pressable>
              );
            })}
          </Animated.View>

          {/* ── Animated Progress Bar ── */}
          <View style={styles.progressWrapper}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, progressBarStyle]} />
            </View>
            <UIText style={styles.progressText}>{t("addressForm.percentComplete", { percent: completionPercent })}</UIText>
          </View>

          {/* ── Scrollable Content ── */}
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <StepContent
              stepKey={currentStepKey}
              form={form}
              errors={errors}
              updateField={updateField}
              isEdit={isEdit}
              address={address}
            />
          </ScrollView>

          {/* ── Bottom Navigation ── */}
          <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
            {!isFirstStep && (
              <Pressable
                onPress={goToPreviousStep}
                style={styles.navBtn}
                android_ripple={{
                  color: theme.colors.slate[200],
                  borderless: false,
                  radius: 14,
                }}
              >
                <Ionicons name="arrow-forward" size={16} color={theme.colors.slate[600]} />
                <UIText style={styles.navBtnText}>{t("common.previous")}</UIText>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {!isLastStep ? (
              <Pressable
                onPress={goToNextStep}
                style={styles.navBtnPrimary}
                android_ripple={{
                  color: "rgba(255,255,255,0.2)",
                  borderless: false,
                  radius: 14,
                }}
              >
                <UIText style={styles.navBtnPrimaryText}>{t("common.next")}</UIText>
                <Ionicons name="arrow-back" size={16} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.85 },
                  loading && { opacity: 0.7 },
                ]}
                android_ripple={{
                  color: "rgba(255,255,255,0.2)",
                  borderless: false,
                  radius: 18,
                }}
              >
                {loading ? (
                  <ActivityIndicator
                    color="#fff"
                    size="small"
                    style={{ marginLeft: 8 }}
                  />
                ) : (
                  <Ionicons
                    name={isEdit ? "checkmark" : "add"}
                    size={18}
                    color="#fff"
                  />
                )}
                <UIText style={styles.submitText}>
                  {loading
                    ? t("addressForm.saving")
                    : isEdit
                    ? t("addressForm.saveEdit")
                    : t("addressForm.addAddress")}
                </UIText>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Local discard confirmation — rendered inside Modal tree for correct z-order ── */}
      <Modal
        visible={showDiscard}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiscard(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.discardOverlay}
          onPress={() => setShowDiscard(false)}
        >
          <Pressable style={styles.discardCard} onPress={() => {}}>
            {/* Icon */}
            <View style={styles.discardIconWrap}>
              <Ionicons name="alert-circle" size={36} color="#F59E0B" />
            </View>
            {/* Title */}
            <UIText style={styles.discardTitle}>
              {t("addressForm.confirmDiscardTitle")}
            </UIText>
            {/* Message */}
            <UIText style={styles.discardMsg}>
              {t("addressForm.confirmDiscardMsg")}
            </UIText>
            {/* Actions */}
            <Pressable
              style={styles.discardDangerBtn}
              onPress={() => { setShowDiscard(false); onClose(); }}
            >
              <UIText style={styles.discardDangerText}>
                {t("addressForm.confirmDiscardAction")}
              </UIText>
            </Pressable>
            <Pressable
              style={styles.discardCancelBtn}
              onPress={() => setShowDiscard(false)}
            >
              <UIText style={styles.discardCancelText}>
                {t("addressForm.stayAction")}
              </UIText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

// ─── Step Content Renderer ───────────────────────────────────────────────────
function StepContent({
  stepKey,
  form,
  errors,
  updateField,
  isEdit,
  address,
}: {
  stepKey: StepKey;
  form: AddressFormData;
  errors: Partial<Record<keyof AddressFormData, string>>;
  updateField: (key: keyof AddressFormData, value: string | boolean) => void;
  isEdit: boolean;
  address?: Address | null;
}) {
  const { t, i18n } = useTranslation();
  const cityDisplay = i18n.language === "en" ? SUPPORTED_GOVERNORATE.en : SUPPORTED_GOVERNORATE.ar;

  switch (stepKey) {
    case "type_recipient":
      return (
        <Animated.View entering={FadeIn.duration(300)} style={styles.stepContainer}>
          {/* Label selector card */}
          <View style={styles.card}>
            <UIText style={styles.cardTitle}>{t("addressForm.labelType")}</UIText>
            <View style={styles.labelGrid}>
              {ADDRESS_LABELS.map((l) => {
                const active = form.label === l.key;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => updateField("label", l.key)}
                    style={[
                      styles.labelChip,
                      active && styles.labelChipActive,
                    ]}
                    android_ripple={{
                      color: theme.colors.brand[100],
                      borderless: false,
                      radius: 16,
                    }}
                  >
                    <Ionicons
                      name={l.icon as IoniconsName}
                      size={18}
                      color={
                        active ? theme.colors.brand[700] : theme.colors.slate[400]
                      }
                    />
                    <UIText
                      style={[
                        styles.labelChipText,
                        active && styles.labelChipTextActive,
                      ]}
                    >
                      {t(l.labelKey)}
                    </UIText>
                    {active && (
                      <View style={styles.activeIndicator}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={theme.colors.brand[700]}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {errors.label && (
              <UIText style={fieldStyles.errorText}>{errors.label}</UIText>
            )}
          </View>

          {/* Recipient info card */}
          <View style={styles.card}>
            <UIText style={styles.cardTitle}>{t("addressForm.recipientInfo")}</UIText>
            <View style={styles.fieldGroup}>
              <FloatingLabelInput
                label={t("addressForm.recipientName")}
                value={form.recipient_name}
                onChange={(v) => updateField("recipient_name", v)}
                error={errors.recipient_name}
                placeholder={t("addressForm.recipientNamePlaceholder")}
                icon="person-outline"
                autoFocus={!isEdit}
              />
              <FloatingLabelInput
                label={t("addressForm.phone")}
                value={form.phone}
                onChange={(v) => updateField("phone", v)}
                error={errors.phone}
                placeholder={PHONE_EXAMPLE}
                icon="call-outline"
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>
          </View>
        </Animated.View>
      );

    case "address_details":
      return (
        <Animated.View entering={FadeIn.duration(300)} style={styles.stepContainer}>
          <View style={styles.card}>
            <UIText style={styles.cardTitle}>{t("addressForm.detailsTitle")}</UIText>
            <View style={styles.fieldGroup}>
              <View style={styles.row}>
                {/* City – read only */}
                <View style={styles.fieldColumn}>
                  <UIText style={fieldStyles.label}>{t("addressForm.city")}</UIText>
                  <View style={[fieldStyles.inputWrap, styles.readonlyField]}>
                    <Ionicons
                      name="lock-closed"
                      size={14}
                      color={theme.colors.slate[400]}
                    />
                    <UIText style={[fieldStyles.input, styles.readonlyText]}>
                      {cityDisplay}
                    </UIText>
                  </View>
                </View>
                <View style={styles.fieldColumn}>
                  <FloatingLabelInput
                    label={t("addressForm.district")}
                    value={form.district}
                    onChange={(v) => updateField("district", v)}
                    error={errors.district}
                    placeholder={t("addressForm.districtPlaceholder")}
                  />
                </View>
              </View>

              <FloatingLabelInput
                label={t("addressForm.street")}
                value={form.street}
                onChange={(v) => updateField("street", v)}
                error={errors.street}
                placeholder={t("addressForm.streetPlaceholder")}
              />

              <View style={styles.row}>
                <View style={styles.fieldColumnWide}>
                  <FloatingLabelInput
                    label={t("addressForm.building")}
                    value={form.building}
                    onChange={(v) => updateField("building", v)}
                    error={errors.building}
                    placeholder={t("addressForm.buildingPlaceholder")}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.fieldColumn}>
                  <FloatingLabelInput
                    label={t("addressForm.floor")}
                    value={form.floor ?? ""}
                    onChange={(v) => updateField("floor", v)}
                    placeholder={t("addressForm.floorPlaceholder")}
                  />
                </View>
                <View style={styles.fieldColumn}>
                  <FloatingLabelInput
                    label={t("addressForm.apartment")}
                    value={form.apartment ?? ""}
                    onChange={(v) => updateField("apartment", v)}
                    placeholder={t("addressForm.apartmentPlaceholder")}
                  />
                </View>
              </View>

              <FloatingLabelInput
                label={t("addressForm.landmark")}
                value={form.landmark ?? ""}
                onChange={(v) => updateField("landmark", v)}
                placeholder={t("addressForm.landmarkPlaceholder")}
                icon="flag-outline"
              />
            </View>
          </View>
        </Animated.View>
      );

    case "confirm":
      return (
        <Animated.View entering={FadeIn.duration(300)} style={styles.stepContainer}>
          {/* Map preview card — uses saved coords if editing, otherwise geocodes from form */}
          <View style={styles.card}>
            <AddressMapPlaceholder
              lat={address?.lat}
              lng={address?.lng}
              height={200}
              addressHint={
                !address?.lat
                  ? {
                      street:   form.street,
                      building: form.building,
                      district: form.district,
                      city:     form.city,
                    }
                  : undefined
              }
            />
            <View style={styles.mapHint}>
              <Ionicons
                name="navigate-outline"
                size={12}
                color={theme.colors.brand[600]}
              />
              <UIText style={styles.mapHintText}>
                {t("addressForm.locationNote")}
              </UIText>
            </View>
          </View>

          {/* Summary card */}
          <View style={styles.card}>
            <UIText style={styles.cardTitle}>{t("addressForm.summaryTitle")}</UIText>
            <View style={styles.summaryRows}>
              <SummaryRow
                label={t("addressForm.summaryLabelType")}
                value={t(ADDRESS_LABELS.find((l) => l.key === form.label)?.labelKey ?? "")}
              />
              <SummaryRow label={t("addressForm.summaryLabelName")} value={form.recipient_name} />
              <SummaryRow label={t("addressForm.summaryLabelPhone")} value={form.phone} />
              <SummaryRow label={t("addressForm.summaryLabelCity")} value={form.city} />
              <SummaryRow label={t("addressForm.summaryLabelDistrict")} value={form.district} />
              <SummaryRow label={t("addressForm.summaryLabelStreet")} value={form.street} />
              <SummaryRow label={t("addressForm.summaryLabelBuilding")} value={form.building} />
              {form.floor && <SummaryRow label={t("addressForm.floor")} value={form.floor} />}
              {form.apartment && (
                <SummaryRow label={t("addressForm.apartment")} value={form.apartment} />
              )}
              {form.landmark && (
                <SummaryRow label={t("addressForm.landmark")} value={form.landmark} />
              )}
            </View>
          </View>

          {/* Default toggle card */}
          <Pressable
            onPress={() => updateField("is_default", !form.is_default)}
            style={[styles.toggleCard, form.is_default && styles.toggleCardActive]}
            android_ripple={{
              color: theme.colors.brand[100],
              borderless: false,
              radius: 16,
            }}
          >
            <Ionicons
              name={
                form.is_default ? "checkmark-circle" : "ellipse-outline"
              }
              size={22}
              color={
                form.is_default
                  ? theme.colors.brand[600]
                  : theme.colors.slate[300]
              }
            />
            <View>
              <UIText style={styles.toggleTitle}>{t("addressForm.setDefault")}</UIText>
              <UIText style={styles.toggleDesc}>{t("addressForm.setDefaultDesc")}</UIText>
            </View>
          </Pressable>
        </Animated.View>
      );

    default:
      return null;
  }
}

// ─── Summary Row Component ─────────────────────────────────────────────────
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <UIText style={styles.summaryLabel}>{label}</UIText>
      <UIText style={styles.summaryValue}>{value}</UIText>
    </View>
  );
}

// ─── Floating Label Input Component ────────────────────────────────────────
function FloatingLabelInput({
  label,
  value,
  onChange,
  error,
  placeholder,
  icon,
  keyboardType,
  maxLength,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  icon?: IoniconsName;
  keyboardType?: "default" | "phone-pad" | "email-address" | "numeric";
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const shakeStyle = useShakeOnError(error);
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const isFloating = value.length > 0 || focused;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <Animated.View style={[fieldStyles.wrap, shakeStyle]}>
      {/* Floating label animation */}
      <Animated.Text
        style={[
          fieldStyles.floatingLabel,
          isFloating && fieldStyles.floatingLabelActive,
          error && { color: theme.colors.red[500] },
        ]}
      >
        {label}
      </Animated.Text>
      <View style={[fieldStyles.inputContainer, error && fieldStyles.inputError]}>
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={error ? theme.colors.red[400] : theme.colors.slate[400]}
            style={fieldStyles.icon}
          />
        )}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={isFloating ? placeholder : undefined}
          placeholderTextColor={theme.colors.slate[300]}
          keyboardType={keyboardType ?? "default"}
          style={fieldStyles.input}
          textAlign={textAlignStart(_isRtl) as "left" | "right"}
          maxLength={maxLength}
          textContentType={
            keyboardType === "phone-pad" ? "telephoneNumber" : "name"
          }
          returnKeyType="next"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {value.length > 0 && (
          <Pressable
            onPress={() => onChange("")}
            hitSlop={8}
            style={fieldStyles.clearBtn}
          >
            <Ionicons
              name="close-circle"
              size={16}
              color={theme.colors.slate[300]}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Animated.View entering={FadeInDown.duration(150)} exiting={FadeOut.duration(100)}>
          <UIText style={fieldStyles.errorText}>{error}</UIText>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: flexRow(isRtl()),
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing[2.5],
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.slate[100],
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: theme.fonts.black,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  headerStepSubtitle: {
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[400],
    textAlign: "center",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.slate[50],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 2,
  },

  // Step pills
  stepIndicatorRow: {
    flexDirection: flexRow(isRtl()),
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    gap: theme.spacing.sm,
    justifyContent: "center",
  },
  stepPill: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    gap: theme.spacing.xs,
  },
  stepPillActive: {
    backgroundColor: theme.colors.brand[600],
    borderColor: theme.colors.brand[600],
    shadowColor: theme.colors.brand[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  stepPillCompleted: {
    backgroundColor: theme.colors.brand[50],
    borderColor: theme.colors.brand[200],
  },
  stepPillText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[500],
  },
  stepPillTextActive: {
    color: "#fff",
  },
  stepPillTextCompleted: {
    color: theme.colors.brand[700],
  },

  // Progress bar
  progressWrapper: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing[2.5],
    paddingBottom: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.slate[200],
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.brand[600],
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.brand[700],
  },

  scrollContent: {
    paddingHorizontal: theme.spacing[2.5],
    paddingTop: 10,
    gap: theme.spacing.lg,
  },
  stepContainer: {
    gap: theme.spacing.lg,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    shadowColor: theme.colors.slate[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: theme.fonts.black,
    color: theme.colors.text.primary,
    textAlign: textAlignStart(isRtl()),
    marginBottom: -4,
  },

  mapHint: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  mapHintText: {
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.brand[600],
  },

  fieldGroup: {
    gap: 14,
  },
  row: {
    flexDirection: flexRow(isRtl()),
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  fieldColumn: {
    flex: 1,
    minWidth: 0,
  },
  fieldColumnWide: {
    flex: 1.7,
    minWidth: 0,
  },

  labelGrid: {
    flexDirection: flexRow(isRtl()),
    flexWrap: "wrap",
    gap: 10,
  },
  labelChip: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    overflow: "hidden",
    flexGrow: 1,
  },
  labelChipActive: {
    backgroundColor: theme.colors.brand[50],
    borderColor: theme.colors.brand[300],
    paddingLeft: 32, // make room for checkmark
  },
  labelChipText: {
    fontSize: 12,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[500],
  },
  labelChipTextActive: {
    color: theme.colors.brand[700],
    fontFamily: theme.fonts.black,
  },
  activeIndicator: {
    position: "absolute",
    left: 10,
  },

  toggleCard: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: 20,
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    overflow: "hidden",
  },
  toggleCardActive: {
    backgroundColor: theme.colors.brand[50],
    borderColor: theme.colors.brand[200],
  },
  toggleTitle: {
    fontSize: 13,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text.primary,
    textAlign: textAlignStart(isRtl()),
  },
  toggleDesc: {
    fontSize: 10,
    fontFamily: theme.fonts.regular,
    color: theme.colors.slate[400],
    textAlign: textAlignStart(isRtl()),
    marginTop: 2,
  },

  summaryRows: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.slate[100],
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[500],
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text.primary,
    textAlign: textAlignStart(isRtl()),
    flex: 1,
    marginLeft: theme.spacing.md,
  },

  bottomNav: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    paddingHorizontal: theme.spacing[2.5],
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.slate[100],
    gap: theme.spacing.md,
  },
  navBtn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 14,
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  navBtnText: {
    fontSize: 13,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[600],
  },
  navBtnPrimary: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing.md,
    borderRadius: 14,
    backgroundColor: theme.colors.brand[600],
    overflow: "hidden",
    shadowColor: theme.colors.brand[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  navBtnPrimaryText: {
    fontSize: 13,
    fontFamily: theme.fonts.bold,
    color: "#fff",
  },
  submitBtn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.brand[600],
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing[3],
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: theme.colors.brand[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  submitText: {
    fontSize: 15,
    fontFamily: theme.fonts.black,
    color: "#fff",
  },
  readonlyField: {
    backgroundColor: theme.colors.slate[50],
    borderColor: theme.colors.border.default,
  },
  readonlyText: {
    color: theme.colors.slate[600],
  },

  // ── Discard confirmation (in-tree Modal, sits above parent Modal z-order) ──
  discardOverlay: {
    flex: 1,
    backgroundColor: "rgba(7,18,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  discardCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  discardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  discardTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text.primary,
    textAlign: "center" as const,
  },
  discardMsg: {
    fontSize: 14,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
    textAlign: "center" as const,
    lineHeight: 22,
  },
  discardDangerBtn: {
    width: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  discardDangerText: {
    fontSize: 15,
    fontFamily: theme.fonts.bold,
    color: "#fff",
  },
  discardCancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  discardCancelText: {
    fontSize: 14,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text.secondary,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  floatingLabel: {
    fontSize: 11,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[500],
    textAlign: textAlignStart(isRtl()),
    paddingRight: theme.spacing.xs,
    opacity: 0,
    transform: [{ translateY: 18 }, { scale: 0.9 }],
  },
  floatingLabelActive: {
    opacity: 1,
    transform: [{ translateY: 0 }, { scale: 1 }],
    color: theme.colors.brand[600],
    fontFamily: theme.fonts.black,
  },
  label: {
    fontSize: 11,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[500],
    textAlign: textAlignStart(isRtl()),
    paddingRight: 2,
  },
  inputContainer: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: theme.spacing.sm,
  },
  icon: {
    marginLeft: -2,
  },
  inputError: {
    borderColor: theme.colors.red[400],
    backgroundColor: theme.colors.red[50],
  },
  inputWrap: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing.md,
  },
  clearBtn: {
    padding: 2,
  },
  errorText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.red[500],
    textAlign: textAlignStart(isRtl()),
    paddingRight: theme.spacing.xs,
    marginTop: 2,
  },
});