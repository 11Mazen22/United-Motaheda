import { useTheme, type NativeTheme } from "@pharmacy/ui-native";

/**

 * PrescriptionDetail — medication command center.

 *

 * Redesign (2026 visual pass):

 *   • Unified header treatment matching AddRxEntry/AddRxManual/List —

 *     38pt back button, secure-badge on the trailing edge, no more

 *     standalone secure-only chip floating in space.

 *   • All copy migrated from module-load IS_RTL ternary to t() so the

 *     title always matches the active locale.

 *   • Hero card: cleaner top row (heroTile + statusPill), 26pt black

 *     medication name, controlled-substance badge promoted to a proper

 *     row of its own.

 *   • Lifecycle track: responsive 3-stage row with rounded connectors.

 *     Current stage gets a 2px ring + Cairo_900Black label.

 *   • Refill timeline: tight rail+label rows, current step pulses via

 *     accentTint background.

 *   • Fact grid: gap-based flex (no width:50% rounding bug), tinted icon

 *     wells, 14pt black values aligned to start.

 *   • Safety card: warmer accent tint, eyebrow-style title.

 */



import React, { useCallback, useMemo, useState } from "react";

import {

  Pressable,

  ScrollView,

  StyleSheet,

  TextInput,

  View,

} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useLocalSearchParams, useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";

import { PrescriptionsHeader } from "@/features/prescriptions/components/PrescriptionsHeader";

import { useAuth } from "@/features/auth";

import {

  usePrescription,

  useRefillsForPrescription,

  usePrescriptionMutations,

} from "@/features/prescriptions";

import { showConfirmSheet, showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";

import type { RxStatus, RefillRequest, RefillStatus } from "@/stores/prescriptionsStore";



type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



// ═══════════════════════════════════════════════════════════════════════════════

// Status tokens

// ═══════════════════════════════════════════════════════════════════════════════



function rxStatusColor(status: RxStatus, colors: NativeTheme["colors"]): string {
  switch (status) {
    case 'ready': return colors.status.success;
    case 'active': return colors.brand.primary;
    case 'expiring': return colors.status.warning;
    case 'expired': return colors.text.muted;
    default: return colors.text.secondary;
  }
}

function rxStatusTint(status: RxStatus, colors: NativeTheme["colors"]): string {
  switch (status) {
    case 'ready': return `${colors.status.success}1A`;
    case 'active': return colors.brand.primaryLight;
    case 'expiring': return `${colors.status.warning}1A`;
    case 'expired': return colors.brand.primaryLight;
    default: return colors.canvas.surfaceMuted;
  }
}



// Rx validity lifecycle: 0=active, 1=expiring, 2=expired

function lifecycleStage(status: RxStatus): 0 | 1 | 2 {

  if (status === "expired")  return 2;

  if (status === "expiring") return 1;

  return 0;

}



const REFILL_STEPS: { key: RefillStatus; icon: IoniconsName }[] = [

  { key: "pending",    icon: "document-text-outline" },

  { key: "preparing",  icon: "flask-outline" },

  { key: "ready",      icon: "checkmark-circle-outline" },

  { key: "on_the_way", icon: "bicycle-outline" },

  { key: "delivered",  icon: "home-outline" },

];



function activeRefill(refills: RefillRequest[]): RefillRequest | undefined {

  return refills.find((r) => r.status !== "delivered" && r.status !== "cancelled");

}



function formatDate(iso: string, locale: string): string {

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  try {

    return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {

      day: "numeric", month: "short", year: "numeric",

    });

  } catch {

    return iso;

  }

}



// ═══════════════════════════════════════════════════════════════════════════════

// Screen

// ═══════════════════════════════════════════════════════════════════════════════



export default function Page(): React.ReactElement {

  const { id } = useLocalSearchParams<{ id: string }>();

  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
const { t, i18n } = useTranslation();

  const router      = useRouter();

  const insets      = useSafeAreaInsets();

  const { user }    = useAuth();

  const rx          = usePrescription(id);

  const refills     = useRefillsForPrescription(id ?? "");

  const { update, remove } = usePrescriptionMutations(user?.id);



  const inFlight = useMemo(() => activeRefill(refills), [refills]);



  const [isEditing, setIsEditing] = useState(false);

  const ctaHeight = 12 + 56 + Math.max(insets.bottom, 8) + 4;

  const [editName,   setEditName]   = useState("");

  const [editDose,   setEditDose]   = useState("");

  const [editDoctor, setEditDoctor] = useState("");



  const goRefill = useCallback(() => {

    if (rx) router.push(`/prescriptions/${rx.id}/refill` as never);

  }, [router, rx]);



  const onStartEdit = useCallback(() => {

    if (!rx) return;

    setEditName(rx.name);

    setEditDose(rx.dose);

    setEditDoctor(rx.doctor);

    setIsEditing(true);

  }, [rx]);



  const onCancelEdit = useCallback(() => {

    setIsEditing(false);

  }, []);



  const onSaveEdit = useCallback(async () => {

    if (!rx) return;

    try {

      await update.mutateAsync({

        id:    rx.id,

        input: { name: editName.trim(), dose: editDose.trim(), doctor: editDoctor.trim() },

      });

      showSuccessSheet(t("prescriptions.editSavedTitle"), t("prescriptions.editSavedBody"));

      setIsEditing(false);

    } catch {

      showErrorSheet(t("prescriptions.editSaveErrorTitle"), t("prescriptions.editSaveErrorBody"));

    }

  }, [rx, update, editName, editDose, editDoctor, t]);



  const onDelete = useCallback(() => {

    if (!rx) return;

    showConfirmSheet(

      t("prescriptions.deleteTitle"),

      t("prescriptions.deleteBody"),

      async () => {

        try {

          await remove.mutateAsync(rx.id);

          showSuccessSheet(t("prescriptions.deletedTitle"), t("prescriptions.deletedBody"), () => router.back());

        } catch {

          showErrorSheet(t("prescriptions.deleteErrorTitle"), t("prescriptions.deleteErrorBody"));

        }

      },

      { confirmLabel: t("prescriptions.deleteConfirm"), danger: true },

    );

  }, [rx, remove, router, t]);



  const statusLabel = useCallback((status: RxStatus): string => {

    switch (status) {

      case "ready":    return t("prescriptions.statusReady");

      case "active":   return t("prescriptions.statusActive");

      case "expiring": return t("prescriptions.statusExpiring");

      case "expired":  return t("prescriptions.statusExpired");

    }

  }, [t]);



  const refillStatusLabel = useCallback((status: RefillStatus): string => {

    return t(`prescriptions.refillStatus.${status}`);

  }, [t]);



  // ── Not-found guard ────────────────────────────────────────────────────────

  if (!rx) {

    return (

      <View style={s.screen}>

        <Header insets={insets} onBack={() => router.back()} />

        <View style={s.centered}>

          <View style={s.notFoundIcon}>

            <Ionicons name="medkit-outline" size={36} color={theme.colors.text.muted} />

          </View>

          <Text weight="black" style={s.notFoundTitle}>

            {t("prescriptions.notFound")}

          </Text>

          <Text style={s.notFoundBody}>

            {t("prescriptions.notFoundSub")}

          </Text>

        </View>

      </View>

    );

  }



  const color     = rxStatusColor(rx.status, theme.colors);
  const tint      = rxStatusTint(rx.status, theme.colors);
  const isExpired = rx.status === "expired";



  return (

    <View style={s.screen}>

      <Header

        insets={insets}

        onBack={() => router.back()}

        isEditing={isEditing}

        onEdit={onStartEdit}

        onDelete={onDelete}

        onSave={onSaveEdit}

        onCancel={onCancelEdit}

        deletePending={remove.isPending}

        savePending={update.isPending}

        rx={rx}

      />



      <ScrollView

        style={{ flex: 1 }}

        contentContainerStyle={{

          padding:        20,

          paddingBottom:  ctaHeight + 20,

          gap:            16,

        }}

        showsVerticalScrollIndicator={false}>



        {/* ── Staff review status ──────────────────────────────────── */}

        {rx.reviewStatus === "pending_review" && (

          <Animated.View entering={FadeInDown.duration(240)} style={s.reviewBanner}>

            <View style={[s.reviewBannerRow, { flexDirection: flexRow(IS_RTL) }]}>

              <View style={s.reviewBannerIconWell}>

                <Ionicons name="time-outline" size={16} color={theme.colors.status.warning} />

              </View>

              <View style={s.reviewBannerText}>

                <Text weight="black" style={s.reviewBannerTitle}>

                  {t("prescriptions.reviewPendingTitle")}

                </Text>

                <Text style={s.reviewBannerBody}>

                  {t("prescriptions.reviewPendingBody")}

                </Text>

              </View>

            </View>

          </Animated.View>

        )}

        {rx.reviewStatus === "rejected" && (

          <Animated.View entering={FadeInDown.duration(240)} style={[s.reviewBanner, s.reviewBannerDanger]}>

            <View style={[s.reviewBannerRow, { flexDirection: flexRow(IS_RTL) }]}>

              <View style={[s.reviewBannerIconWell, s.reviewBannerIconWellDanger]}>

                <Ionicons name="close-circle-outline" size={16} color={theme.colors.status.error} />

              </View>

              <View style={s.reviewBannerText}>

                <Text weight="black" style={[s.reviewBannerTitle, { color: theme.colors.status.error }]}>

                  {t("prescriptions.reviewRejectedTitle")}

                </Text>

                <Text style={s.reviewBannerBody}>

                  {rx.rejectionReason || t("prescriptions.reviewRejectedBody")}

                </Text>

              </View>

            </View>

          </Animated.View>

        )}



        {/* ── Hero ──────────────────────────────────────────────────── */}

        <Animated.View entering={FadeInDown.duration(280)} style={s.heroCard}>

          <View style={[s.heroStripe, { backgroundColor: color }]} />

          <View style={s.heroBody}>

            <View style={s.heroTop}>

              <View style={[s.heroTile, { backgroundColor: tint }]}>

                <Ionicons name="medkit" size={28} color={color} />

              </View>

              <View style={[s.statusPill, { backgroundColor: tint, borderColor: color + "33" }]}>

                <View style={[s.statusDot, { backgroundColor: color }]} />

                <Text weight="black" style={[s.statusPillText, { color }]} numberOfLines={1}>

                  {statusLabel(rx.status)}

                </Text>

              </View>

            </View>



            {isEditing ? (

              <>

                <TextInput

                  value={editName}

                  onChangeText={setEditName}

                  placeholder={t("prescriptions.ocrFieldNamePh")}

                  placeholderTextColor={theme.colors.text.muted}

                  style={s.heroNameInput}

                  textAlign={TEXT_START as "left" | "right"}

                  editable={!update.isPending}

                />

                <TextInput

                  value={editDose}

                  onChangeText={setEditDose}

                  placeholder={t("prescriptions.ocrFieldDosePh")}

                  placeholderTextColor={theme.colors.text.muted}

                  style={s.heroDoseInput}

                  textAlign={TEXT_START as "left" | "right"}

                  editable={!update.isPending}

                />

                <TextInput

                  value={editDoctor}

                  onChangeText={setEditDoctor}

                  placeholder={t("prescriptions.ocrFieldDoctorPh")}

                  placeholderTextColor={theme.colors.text.muted}

                  style={s.heroDoseInput}

                  textAlign={TEXT_START as "left" | "right"}

                  editable={!update.isPending}

                />

              </>

            ) : (

              <>

                <Text weight="black" style={s.heroName} numberOfLines={2}>

                  {rx.name}

                </Text>

                <Text weight="semibold" style={s.heroDose} numberOfLines={1}>

                  {rx.dose}

                </Text>

              </>

            )}



            {rx.isControlled && (

              <View style={s.controlledBadge}>

                <View style={s.controlledIconWell}>

                  <Ionicons name="shield-half-outline" size={14} color={theme.colors.status.error} />

                </View>

                <Text weight="bold" style={s.controlledText} numberOfLines={1}>

                  {rx.schedule

                    ? `${t("prescriptions.controlled")} · ${t("prescriptions.scheduleN", { n: rx.schedule })}`

                    : t("prescriptions.controlled")}

                </Text>

              </View>

            )}

          </View>

        </Animated.View>



        {/* ── Lifecycle track ──────────────────────────────────────── */}

        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={s.card}>

          <Text weight="black" style={s.cardTitle}>

            {t("prescriptions.lifecycleTitle")}

          </Text>

          <LifecycleTrack

            stage={lifecycleStage(rx.status)}

            labels={[

              t("prescriptions.stageActive"),

              t("prescriptions.stageRefill"),

              t("prescriptions.stageExpired"),

            ]}

          />

        </Animated.View>



        {/* ── Refill tracking (in flight) ──────────────────────────── */}

        {inFlight && (

          <Animated.View entering={FadeInDown.delay(120).duration(280)} style={s.card}>

            <View style={s.cardTitleRow}>

              <Text weight="black" style={s.cardTitle}>

                {t("prescriptions.trackingTitle")}

              </Text>

              {inFlight.eta && (

                <View style={s.etaPill}>

                  <Ionicons name="time-outline" size={12} color={theme.colors.brand.primary} />

                  <Text weight="bold" style={s.etaText}>

                    {t("prescriptions.trackingEta")}: {inFlight.eta}

                  </Text>

                </View>

              )}

            </View>

            <RefillTimeline refill={inFlight} label={refillStatusLabel} />

            {inFlight.trackingNumber && (

              <View style={s.trackingNoRow}>

                <Text weight="bold" style={s.trackingNoLabel}>

                  {t("prescriptions.trackingNo")}

                </Text>

                <Text weight="black" style={s.trackingNoValue}>

                  {inFlight.trackingNumber}

                </Text>

              </View>

            )}

          </Animated.View>

        )}



        {/* ── Key facts grid ───────────────────────────────────────── */}

        <Animated.View entering={FadeInDown.delay(180).duration(280)} style={s.card}>

          <Text weight="black" style={s.cardTitle}>

            {t("prescriptions.factsTitle")}

          </Text>

          <View style={s.factGrid}>

            <Fact

              icon="repeat-outline"

              label={t("prescriptions.factRefills")}

              value={String(rx.refills)}

              accent={rx.refills > 0 ? theme.colors.brand.primary : theme.colors.text.muted}

            />

            <Fact icon="calendar-outline" label={t("prescriptions.factNextRefill")} value={rx.nextRefill} />

            <Fact icon="person-outline"   label={t("prescriptions.factDoctor")}     value={rx.doctor} />

            {rx.rxNumber && (

              <Fact icon="barcode-outline" label={t("prescriptions.factRxNumber")} value={rx.rxNumber} />

            )}

            {rx.isControlled && rx.schedule && (

              <Fact

                icon="shield-half-outline"

                label={t("prescriptions.factSchedule")}

                value={t("prescriptions.scheduleN", { n: rx.schedule })}

                accent={theme.colors.status.error}

              />

            )}

            <Fact

              icon="time-outline"

              label={t("prescriptions.factAdded")}

              value={formatDate(rx.addedAt, i18n.language)}

            />

          </View>

        </Animated.View>



        {/* ── Refill history ────────────────────────────────────────── */}

        <Animated.View entering={FadeInDown.delay(240).duration(280)} style={s.card}>

          <Text weight="black" style={s.cardTitle}>

            {t("prescriptions.historyTitle")}

          </Text>

          {refills.length === 0 ? (

            <View style={s.histEmpty}>

              <View style={s.histEmptyIcon}>

                <Ionicons name="receipt-outline" size={22} color={theme.colors.text.muted} />

              </View>

              <Text weight="black" style={s.histEmptyTitle}>

                {t("prescriptions.historyEmpty")}

              </Text>

              <Text style={s.histEmptySub}>

                {t("prescriptions.historyEmptySub")}

              </Text>

            </View>

          ) : (

            <View style={{ gap: 8 }}>

              {refills.map((r) => (

                <RefillHistoryRow

                  key={r.id}

                  refill={r}

                  label={refillStatusLabel(r.status)}

                  dateLabel={formatDate(r.placedAt, i18n.language)}

                  lang={i18n.language === "en" ? "en" : "ar"}

                />

              ))}

            </View>

          )}

        </Animated.View>



        {/* ── Safety & trust ────────────────────────────────────────── */}

        <Animated.View entering={FadeInDown.delay(300).duration(280)} style={s.safetyCard}>

          <View style={s.safetyHead}>

            <View style={s.safetyIconWell}>

              <Ionicons name="lock-closed" size={14} color={theme.colors.brand.primary} />

            </View>

            <Text weight="black" style={s.safetyTitle}>

              {t("prescriptions.safetyTitle")}

            </Text>

          </View>

          <Text style={s.safetyBody}>

            {t("prescriptions.safetyStored")}

          </Text>

          {rx.isControlled && (

            <Text style={[s.safetyBody, { color: theme.colors.status.error, marginTop: 4 }]}>

              {t("prescriptions.safetyControlled")}

            </Text>

          )}

        </Animated.View>

      </ScrollView>



      {/* ── Sticky refill CTA ────────────────────────────────────────── */}

      <View
        style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>

        <Button

          variant="primary"

          full

          icon={isExpired ? "lock-closed" : "refresh"}

          label={isExpired ? t("prescriptions.refillExpired") : t("prescriptions.refillCta")}

          disabled={isExpired}

          onPress={goRefill}

        />

      </View>

    </View>

  );

}



// ═══════════════════════════════════════════════════════════════════════════════

// Sub-components

// ═══════════════════════════════════════════════════════════════════════════════



interface HeaderProps {

  insets:         { top: number };

  onBack:         () => void;

  isEditing?:     boolean;

  onEdit?:        () => void;

  onDelete?:      () => void;

  onSave?:        () => void;

  onCancel?:      () => void;

  deletePending?: boolean;

  savePending?:   boolean;

  rx?:            { name: string } | undefined;

}



function Header({

  insets, onBack, isEditing, onEdit, onDelete, onSave, onCancel, deletePending, savePending, rx,

}: HeaderProps) {

  const { t } = useTranslation();

  const showActions = !!(onEdit && onDelete && onSave && onCancel);

  const trailing = (
    <View style={[headerX.trailingCluster, { flexDirection: flexRow(IS_RTL) }]}>
      {showActions && (
        isEditing ? (
          <>
            <Pressable
              onPress={onCancel}
              hitSlop={10}
              disabled={savePending}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              style={headerX.iconBtnTouchable}>
              {({ pressed }) => (
                <View style={[headerX.iconBtn, pressed && headerX.iconBtnPressed, savePending && headerX.iconBtnDisabled]}>
                  <Ionicons name="close-outline" size={20} color="#fff" />
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={onSave}
              hitSlop={10}
              disabled={savePending}
              accessibilityRole="button"
              accessibilityLabel={t("prescriptions.editSaveCta")}
              style={headerX.iconBtnTouchable}>
              {({ pressed }) => (
                <View style={[headerX.iconBtn, headerX.iconBtnAccent, pressed && headerX.iconBtnPressed, savePending && headerX.iconBtnDisabled]}>
                  <Ionicons name="checkmark-outline" size={20} color="#fff" />
                </View>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={onEdit}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("prescriptions.menuEdit")}
              style={headerX.iconBtnTouchable}>
              {({ pressed }) => (
                <View style={[headerX.iconBtn, pressed && headerX.iconBtnPressed]}>
                  <Ionicons name="pencil-outline" size={18} color="#fff" />
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={onDelete}
              hitSlop={10}
              disabled={deletePending}
              accessibilityRole="button"
              accessibilityLabel={t("prescriptions.menuDelete")}
              style={headerX.iconBtnTouchable}>
              {({ pressed }) => (
                <View style={[headerX.iconBtn, pressed && headerX.iconBtnPressed, deletePending && headerX.iconBtnDisabled]}>
                  <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                </View>
              )}
            </Pressable>
          </>
        )
      )}

      <View style={headerX.secureBadge}>
        <Ionicons name="shield-checkmark" size={12} color="#fff" />
        <Text weight="black" style={headerX.secureText}>
          {t("prescriptions.secure")}
        </Text>
      </View>
    </View>
  );

  return (
    <PrescriptionsHeader
      insetsTop={insets.top}
      icon="medkit"
      eyebrow={t("prescriptions.headerEyebrow")}
      title={rx?.name ?? t("prescriptions.listEyebrow")}
      onBack={onBack}
      trailing={trailing}
    />
  );
}

const headerX = StyleSheet.create({
  trailingCluster: {
    alignItems: "center",
    gap:        8,
  },
  iconBtnTouchable: {
    borderRadius: 12,
  },
  iconBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  iconBtnAccent: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  iconBtnPressed: {
    opacity:   0.75,
    transform: [{ scale: 0.96 }],
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
  secureBadge: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   "rgba(255,255,255,0.16)",
    borderRadius:      9999,
    paddingHorizontal: 12,
    paddingVertical:   7,
  },
  secureText: {
    fontSize:           11,
    lineHeight:         15,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    color:              "#fff",
    includeFontPadding: false,
  },
});



/** 3-stage Rx validity track: Active → Refill Due → Expired */

function LifecycleTrack({ stage, labels }: { stage: 0 | 1 | 2; labels: [string, string, string] }) {

  
  const { theme } = useTheme();
  const lc = React.useMemo(() => get_lc(theme.colors), [theme.colors]);
const stages = [

    { label: labels[0], icon: "checkmark-circle" as IoniconsName, color: theme.colors.status.success },

    { label: labels[1], icon: "alert-circle"     as IoniconsName, color: theme.colors.status.warning },

    { label: labels[2], icon: "close-circle"     as IoniconsName, color: theme.colors.text.muted },

  ];

  return (

    <View style={[lc.row, { flexDirection: flexRow(IS_RTL) }]}>

      {stages.map((st, i) => {

        const reached   = i <= stage;

        const isCurrent = i === stage;

        return (

          <React.Fragment key={st.label}>

            <View style={lc.node}>

              <View

                style={[

                  lc.dot,

                  {

                    backgroundColor: reached ? st.color + "1A" : theme.colors.canvas.surfaceMuted,

                    borderColor:     reached ? st.color        : theme.colors.border.strong,

                  },

                  isCurrent && { borderWidth: 2 },

                ]}>

                <Ionicons

                  name={st.icon}

                  size={18}

                  color={reached ? st.color : theme.colors.border.strong}

                />

              </View>

              <Text

                weight={isCurrent ? "black" : "bold"}

                style={[

                  lc.label,

                  { color: reached ? theme.colors.text.primary : theme.colors.text.muted },

                ]}

                numberOfLines={1}>

                {st.label}

              </Text>

            </View>

            {i < stages.length - 1 && (

              <View

                style={[

                  lc.bar,

                  { backgroundColor: i < stage ? stages[i].color : theme.colors.border.strong },

                ]}

              />

            )}

          </React.Fragment>

        );

      })}

    </View>

  );

}



/** Vertical refill order timeline */

function RefillTimeline({

  refill, label,

}: { refill: RefillRequest; label: (status: RefillStatus) => string }) {

  const { theme } = useTheme();
  const tl = React.useMemo(() => get_tl(theme), [theme]);

  const currentIdx = REFILL_STEPS.findIndex((st) => st.key === refill.status);

  return (

    <View>

      {REFILL_STEPS.map((step, i) => {
        const done    = i < currentIdx;

        const current = i === currentIdx;

        const future  = i > currentIdx;


        return (
          <View key={step.key} style={[tl.row, { flexDirection: flexRow(IS_RTL) }]}>

            <View style={tl.rail}>

              <View

                style={[

                  tl.node,

                  {

                     borderColor:     done || current ? theme.colors.brand.primary : theme.colors.border.strong,

                    backgroundColor: done ? theme.colors.brand.primary : theme.colors.canvas.surface,

                  },

                  current && tl.nodeCurrent,

                ]}>

                {done ? (

                  <Ionicons name="checkmark" size={13} color={theme.colors.text.inverse} />

                ) : (

                  <Ionicons

                    name={step.icon}

                    size={13}

                    color={current ? theme.colors.brand.primary : theme.colors.text.muted}

                  />

                )}

              </View>

              {i < REFILL_STEPS.length - 1 && (

                <View

                  style={[

                    tl.connector,

                    { backgroundColor: done ? theme.colors.brand.primary : theme.colors.border.default },

                  ]}

                />

              )}

            </View>

            <View style={tl.labelWrap}>

              <Text

                weight={current ? "black" : "bold"}

                style={[

                  tl.label,

                  { color: future ? theme.colors.text.muted : current ? theme.colors.brand.primary : theme.colors.text.primary },

                ]}>

                {label(step.key)}

              </Text>

            </View>

          </View>

        );

      })}

    </View>

  );

}



function Fact({

  icon, label, value, accent,

}: { icon: IoniconsName; label: string; value: string; accent?: string }) {

  
  const { theme } = useTheme();

  const f = React.useMemo(() => get_f(theme), [theme]);



const tone = accent ?? theme.colors.text.muted;

  return (

    <View style={f.cell}>

      <View style={f.head}>

        <View style={[f.iconWell, { backgroundColor: tone + "14" }]}>

          <Ionicons name={icon} size={13} color={tone} />

        </View>

        <Text weight="bold" style={f.label} numberOfLines={1}>{label}</Text>

      </View>

      <Text weight="black" style={[f.value, accent ? { color: accent } : null]} numberOfLines={1}>

        {value}

      </Text>

    </View>

  );

}



function RefillHistoryRow({

  refill, label, dateLabel, lang,

}: { refill: RefillRequest; label: string; dateLabel: string; lang: "ar" | "en" }) {

  
  const { theme } = useTheme();
  const h = React.useMemo(() => get_h(theme), [theme]);




  const cancelled = refill.status === "cancelled";

  const delivered = refill.status === "delivered";

  const tone = cancelled ? theme.colors.status.error

             : delivered ? theme.colors.status.success

             : theme.colors.brand.primary;

  const tint = cancelled ? `${theme.colors.status.error}1A`

             : delivered ? `${theme.colors.status.success}1A`

             : theme.colors.brand.primaryLight;

  return (

    <View style={[h.row, { flexDirection: flexRow(IS_RTL) }]}>

      <View style={[h.dot, { backgroundColor: tint }]}>

        <Ionicons

          name={cancelled ? "close" : delivered ? "checkmark" : "ellipsis-horizontal"}

          size={14}

          color={tone}

        />

      </View>

      <View style={h.text}>

        <Text weight="black" style={[h.status, { color: tone }]} numberOfLines={1}>

          {label}

        </Text>

        <Text style={h.date} numberOfLines={1}>{dateLabel}</Text>

        {cancelled && refill.rejectionReason && (

          <Text style={h.rejectionReason} numberOfLines={2}>

            {refill.rejectionReason}

          </Text>

        )}

      </View>

      {refill.total > 0 && (

        <Text weight="black" style={h.total} numberOfLines={1}>

          {formatPrice(refill.total, lang)}

        </Text>

      )}

    </View>

  );

}



// ═══════════════════════════════════════════════════════════════════════════════

// Styles

// ═══════════════════════════════════════════════════════════════════════════════



function get_s(theme: NativeTheme) { return StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },



  // ── Header ─────────────────────────────────────────────────────────────

  header: {

    paddingHorizontal: 20,

    paddingBottom:     16,

    backgroundColor:   theme.colors.canvas.surface,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: theme.colors.border.default,

    ...theme.shadows[1],

  },

  headerRow: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    justifyContent: "space-between",

    minHeight:      38,

  },

  backBtnTouchable: {

    borderRadius: 14,

  },

  backBtn: {

    width:           38,

    height:          38,

    borderRadius:    14,

    backgroundColor: theme.colors.canvas.surfaceMuted,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

  },

  backBtnPressed: {

    opacity:   0.7,

    transform: [{ scale: 0.96 }],

  },

  headerTrailingCluster: {

    alignItems: "center",

    gap:        8,

  },

  // Bare touchable: only radius, no sizing/background — the actual visuals

  // live on the inner View via function-as-children. A raw Pressable's own

  // function-computed `style` prop is unreliable in this app's RN/Fabric

  // setup (see backBtnTouchable above, the established pattern in this file).

  iconBtnTouchable: {

    borderRadius: 12,

  },

  iconBtn: {

    width:           36,

    height:          36,

    borderRadius:    12,

    backgroundColor: theme.colors.canvas.surfaceMuted,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

  },

  iconBtnAccent: {

    backgroundColor: theme.colors.brand.primaryLight,

    borderColor:     "rgba(14,126,116,0.18)",

  },

  iconBtnPressed: {

    opacity:   0.7,

    transform: [{ scale: 0.96 }],

  },

  iconBtnDisabled: {

    opacity: 0.45,

  },

  secureBadge: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               6,

    backgroundColor:   `${theme.colors.status.success}1A`,

    borderRadius:      9999,

    paddingHorizontal: 12,

    paddingVertical:   7,

    borderWidth:       1,

    borderColor:       "rgba(5,150,105,0.18)",

  },

  secureText: {

    fontSize:           11,

    lineHeight:         15,

    letterSpacing:      0.5,

    textTransform:      "uppercase",

    color:              theme.colors.status.success,

    includeFontPadding: false,

  },



  // ── Hero ───────────────────────────────────────────────────────────────

  heroCard: {

    backgroundColor: theme.colors.canvas.surface,

    borderRadius:    16,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    overflow:        "hidden",

    ...theme.shadows[3],

  },

  heroStripe: { height: 5, width: "100%" },

  heroBody: { padding: 20, gap: 8 },

  heroTop: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    justifyContent: "space-between",

    marginBottom:   6,

  },

  heroTile: {

    width:          60,

    height:         60,

    borderRadius:   20,

    alignItems:     "center",

    justifyContent: "center",

  },

  statusPill: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               7,

    paddingHorizontal: 12,

    paddingVertical:   8,

    borderRadius:      9999,

    borderWidth:       1,

  },

  statusDot: {

    width:        8,

    height:       8,

    borderRadius: 4,

  },

  statusPillText: {

    fontSize:           11,

    lineHeight:         15,

    letterSpacing:      0.3,

    includeFontPadding: false,

  },

  heroName: {

    fontSize:           26,

    lineHeight:         32,

    letterSpacing:      -0.6,

    color:              theme.colors.text.primary,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  heroDose: {

    fontSize:           14,

    lineHeight:         20,

    color:              theme.colors.text.secondary,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  heroNameInput: {

    fontSize:           22,

    lineHeight:         28,

    letterSpacing:      -0.4,

    color:              theme.colors.text.primary,

    textAlign:          TEXT_START,

    paddingVertical:    4,

    borderBottomWidth:  1.5,

    borderBottomColor:  theme.colors.brand.primary,

    includeFontPadding: false,

  },

  heroDoseInput: {

    fontSize:           14,

    lineHeight:         20,

    color:              theme.colors.text.secondary,

    textAlign:          TEXT_START,

    paddingVertical:    4,

    borderBottomWidth:  1,

    borderBottomColor:  theme.colors.border.default,

    includeFontPadding: false,

  },

  controlledBadge: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               10,

    backgroundColor:   `${theme.colors.status.error}1A`,

    borderRadius:      12,

    paddingHorizontal: 12,

    paddingVertical:   10,

    marginTop:         8,

    borderWidth:       1,

    borderColor:       "rgba(239,68,68,0.18)",

  },

  controlledIconWell: {

    width:           28,

    height:          28,

    borderRadius:    9,

    backgroundColor: "rgba(239,68,68,0.16)",

    alignItems:      "center",

    justifyContent:  "center",

  },

  controlledText: {

    flex:               1,

    fontSize:           12,

    lineHeight:         16,

    color:              theme.colors.status.error,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  // ── Generic card ───────────────────────────────────────────────────────

  card: {

    backgroundColor: theme.colors.canvas.surface,

    borderRadius:    12,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    padding:         16,

    gap:             14,

    ...theme.shadows[1],

  },

  cardTitleRow: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    justifyContent: "space-between",

    gap:            10,

  },

  cardTitle: {

    fontSize:           13,

    lineHeight:         18,

    color:              theme.colors.text.secondary,

    letterSpacing:      0.5,

    textTransform:      "uppercase",

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  // ── Tracking eta + tracking# ───────────────────────────────────────────

  etaPill: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               6,

    backgroundColor:   theme.colors.brand.primaryLight,

    borderRadius:      9999,

    paddingHorizontal: 10,

    paddingVertical:   5,

  },

  etaText: {

    fontSize:           10,

    lineHeight:         14,

    color:              theme.colors.brand.primary,

    includeFontPadding: false,

  },

  trackingNoRow: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    justifyContent: "space-between",

    paddingTop:     14,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: theme.colors.border.default,

  },

  trackingNoLabel: {

    fontSize:           11,

    color:              theme.colors.text.muted,

    letterSpacing:      0.3,

    textTransform:      "uppercase",

    includeFontPadding: false,

  },

  trackingNoValue: {

    fontSize:           13,

    color:              theme.colors.text.primary,

    includeFontPadding: false,

  },



  // ── Fact grid ──────────────────────────────────────────────────────────

  factGrid: {

    flexDirection: flexRow(IS_RTL),

    flexWrap:      "wrap",

    rowGap:        16,

    columnGap:     16,

  },



  // ── History empty state ───────────────────────────────────────────────

  histEmpty: {

    alignItems:      "center",

    paddingVertical: 14,

    gap:             8,

  },

  histEmptyIcon: {

    width:           52,

    height:          52,

    borderRadius:    17,

    backgroundColor: theme.colors.canvas.surfaceMuted,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

  },

  histEmptyTitle: {

    fontSize:           14,

    lineHeight:         20,

    color:              theme.colors.text.primary,

    textAlign:          "center",

    includeFontPadding: false,

  },

  histEmptySub: {

    fontSize:           12,

    lineHeight:         18,

    color:              theme.colors.text.muted,

    textAlign:          "center",

    maxWidth:           280,

    includeFontPadding: false,

  },



  // ── Staff review banner ─────────────────────────────────────────────────

  reviewBanner: {

    backgroundColor: `${theme.colors.status.warning}1A`,

    borderRadius:    12,

    borderWidth:     1,

    borderColor:     "rgba(245,158,11,0.32)",

    padding:         14,

  },

  reviewBannerDanger: {

    backgroundColor: `${theme.colors.status.error}1A`,

    borderColor:     "rgba(239,68,68,0.28)",

  },

  reviewBannerRow: {

    alignItems: "flex-start",

    gap:        12,

  },

  reviewBannerIconWell: {

    width:           32,

    height:          32,

    borderRadius:    11,

    backgroundColor: "rgba(245,158,11,0.18)",

    alignItems:      "center",

    justifyContent:  "center",

    flexShrink:      0,

  },

  reviewBannerIconWellDanger: {

    backgroundColor: "rgba(239,68,68,0.16)",

  },

  reviewBannerText: {

    flex: 1,

    gap:  3,

  },

  reviewBannerTitle: {

    fontSize:           12,

    lineHeight:         17,

    color:              theme.colors.status.warning,

    letterSpacing:      0.2,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  reviewBannerBody: {

    fontSize:           13,

    lineHeight:         20,

    color:              theme.colors.text.secondary,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  // ── Safety card ───────────────────────────────────────────────────────

  safetyCard: {

    backgroundColor: theme.colors.brand.primaryLight,

    borderRadius:    12,

    borderWidth:     1,

    borderColor:     "rgba(14,126,116,0.18)",

    padding:         16,

    gap:             8,

  },

  safetyHead: {

    flexDirection: flexRow(IS_RTL),

    alignItems:    "center",

    gap:           10,

  },

  safetyIconWell: {

    width:           30,

    height:          30,

    borderRadius:    10,

    backgroundColor: "rgba(14,126,116,0.18)",

    alignItems:      "center",

    justifyContent:  "center",

  },

  safetyTitle: {

    fontSize:           12,

    lineHeight:         17,

    color:              theme.colors.brand.primary,

    letterSpacing:      0.5,

    textTransform:      "uppercase",

    includeFontPadding: false,

  },

  safetyBody: {

    fontSize:           13,

    lineHeight:         20,

    color:              theme.colors.text.secondary,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  // ── Sticky CTA ────────────────────────────────────────────────────────

  ctaBar: {

    position:          "absolute",

    start:             0,

    end:               0,

    bottom:            0,

    paddingHorizontal: 20,

    paddingTop:        12,

    backgroundColor:   theme.colors.canvas.surface,

    borderTopWidth:    StyleSheet.hairlineWidth,

    borderTopColor:    theme.colors.border.default,

  },



  // ── Not-found centered state ──────────────────────────────────────────

  centered: {

    flex:              1,

    alignItems:        "center",

    justifyContent:    "center",

    paddingHorizontal: 32,

    gap:               12,

  },

  notFoundIcon: {

    width:           84,

    height:          84,

    borderRadius:    28,

    backgroundColor: theme.colors.canvas.surfaceMuted,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

    marginBottom:    4,

  },

  notFoundTitle: {

    fontSize:           19,

    lineHeight:         26,

    color:              theme.colors.text.primary,

    letterSpacing:      -0.3,

    textAlign:          "center",

    includeFontPadding: false,

  },

  notFoundBody: {

    fontSize:           14,

    lineHeight:         21,

    color:              theme.colors.text.secondary,

    textAlign:          "center",

    maxWidth:           320,

    includeFontPadding: false,

  },

}); }



// ── Lifecycle track styles ────────────────────────────────────────────────────



function get_lc(_c: unknown) { return StyleSheet.create({

  row: {

    alignItems:     "flex-start",

    justifyContent: "space-between",

  },

  node: {

    alignItems: "center",

    gap:        8,

    flex:       0,

    minWidth:   78,

    maxWidth:   96,

  },

  dot: {

    width:          44,

    height:         44,

    borderRadius:   22,

    borderWidth:    1.5,

    alignItems:     "center",

    justifyContent: "center",

  },

  label: {

    fontSize:           11,

    lineHeight:         15,

    textAlign:          "center",

    includeFontPadding: false,

  },

  bar: {

    flex:         1,

    height:       2,

    marginTop:    21,

    marginHorizontal: 4,

    borderRadius: 1,

  },

}); }



// ── Refill timeline styles ────────────────────────────────────────────────────



function get_tl(theme: NativeTheme) { return StyleSheet.create({

  row: {

    alignItems: "stretch",

  },

  rail: {

    alignItems: "center",

    width:      32,

  },

  node: {

    width:          28,

    height:         28,

    borderRadius:   14,

    borderWidth:    1.5,

    alignItems:     "center",

    justifyContent: "center",

  },

  nodeCurrent: {

    borderWidth:     2,

    backgroundColor: theme.colors.brand.primaryLight,

  },

  connector: {

    width:          2,

    flex:           1,

    minHeight:      20,

    marginVertical: 2,

  },

  labelWrap: {

    flex:              1,

    paddingHorizontal: 14,

    paddingTop:        4,

    paddingBottom:     18,

  },

  label: {

    fontSize:           14,

    lineHeight:         19,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

}); }



// ── Fact cell styles ──────────────────────────────────────────────────────────



function get_f(theme: NativeTheme) { return StyleSheet.create({

  cell: {

    flexBasis:    "45%",

    flexGrow:     1,

    gap:          6,

  },

  head: {

    flexDirection: flexRow(IS_RTL),

    alignItems:    "center",

    gap:           8,

  },

  iconWell: {

    width:          24,

    height:         24,

    borderRadius:   8,

    alignItems:     "center",

    justifyContent: "center",

    flexShrink:     0,

  },

  label: {

    flex:               1,

    fontSize:           10,

    lineHeight:         14,

    color:              theme.colors.text.muted,

    letterSpacing:      0.4,

    textTransform:      "uppercase",

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  value: {

    fontSize:           15,

    lineHeight:         20,

    color:              theme.colors.text.primary,

    letterSpacing:      -0.2,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

}); }



// ── History row styles ────────────────────────────────────────────────────────



function get_h(theme: NativeTheme) { return StyleSheet.create({

  row: {

    alignItems:        "center",

    gap:               12,

    backgroundColor:   theme.colors.canvas.surfaceMuted,

    borderRadius:      12,

    paddingHorizontal: 12,

    paddingVertical:   12,

    borderWidth:       1,

    borderColor:       theme.colors.border.default,

  },

  dot: {

    width:          34,

    height:         34,

    borderRadius:   11,

    alignItems:     "center",

    justifyContent: "center",

    flexShrink:     0,

  },

  text: {

    flex: 1,

    gap:  2,

  },

  status: {

    fontSize:           13,

    lineHeight:         18,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  date: {

    fontSize:           11,

    lineHeight:         15,

    color:              theme.colors.text.muted,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  rejectionReason: {

    fontSize:           11,

    lineHeight:         16,

    color:              theme.colors.status.error,

    textAlign:          TEXT_START,

    marginTop:          2,

    includeFontPadding: false,

  },

  total: {

    fontSize:           14,

    lineHeight:         19,

    color:              theme.colors.text.primary,

    includeFontPadding: false,

    flexShrink:         0,

  },

}); }

