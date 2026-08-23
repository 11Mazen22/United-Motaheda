import { useDarkColors } from "@/hooks/useDarkColors";
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

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import Animated, { FadeInDown } from "react-native-reanimated";

import { kit, Button } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

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



function rxStatusColor(status: RxStatus, c: { success: string; accentDeep: string; warn: string; inkFaint: string; inkSoft: string }): string {
  switch (status) {
    case 'ready': return c.success;
    case 'active': return c.accentDeep;
    case 'expiring': return c.warn;
    case 'expired': return c.inkFaint;
    default: return c.inkSoft;
  }
}

function rxStatusTint(status: RxStatus, c: { successTint: string; accentTint: string; warnTint: string; well: string }): string {
  switch (status) {
    case 'ready': return c.successTint;
    case 'active': return c.accentTint;
    case 'expiring': return c.warnTint;
    case 'expired': return c.accentTint;
    default: return c.well;
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



type DarkColors = {
  canvas: string
  surface: string
  line: string
  lineStrong: string
  accent: string
  accentDeep: string
  accentTint: string
  ink: string
  inkSoft: string
  inkFaint: string
  warn: string
  warnTint: string
  success: string
  successTint: string
  danger: string
  dangerTint: string
  well: string
  onAccent: string
}

// ═══════════════════════════════════════════════════════════════════════════════

// Screen

// ═══════════════════════════════════════════════════════════════════════════════



export default function Page({ id }: { id: string | undefined }): React.ReactElement {

  
  
  const { c } = useDarkColors();
  const s = React.useMemo(() => get_s(c), [c]);
const { t, i18n } = useTranslation();

  const router      = useRouter();

  const insets      = useSafeAreaInsets();

  const { user }    = useAuth();

  const rx          = usePrescription(id);

  const refills     = useRefillsForPrescription(id ?? "");

  const { update, remove } = usePrescriptionMutations(user?.id);



  const inFlight = useMemo(() => activeRefill(refills), [refills]);



  const [isEditing, setIsEditing] = useState(false);

  const [ctaHeight, setCtaHeight] = useState(110);

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

            <Ionicons name="medkit-outline" size={36} color={c.inkFaint} />

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



  const color     = rxStatusColor(rx.status, c);
  const tint      = rxStatusTint(rx.status, c);
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

                <Ionicons name="time-outline" size={16} color={c.warn} />

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

                <Ionicons name="close-circle-outline" size={16} color={c.danger} />

              </View>

              <View style={s.reviewBannerText}>

                <Text weight="black" style={[s.reviewBannerTitle, { color: c.danger }]}>

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

                  placeholderTextColor={c.inkFaint}

                  style={s.heroNameInput}

                  textAlign={TEXT_START as "left" | "right"}

                  editable={!update.isPending}

                />

                <TextInput

                  value={editDose}

                  onChangeText={setEditDose}

                  placeholder={t("prescriptions.ocrFieldDosePh")}

                  placeholderTextColor={c.inkFaint}

                  style={s.heroDoseInput}

                  textAlign={TEXT_START as "left" | "right"}

                  editable={!update.isPending}

                />

                <TextInput

                  value={editDoctor}

                  onChangeText={setEditDoctor}

                  placeholder={t("prescriptions.ocrFieldDoctorPh")}

                  placeholderTextColor={c.inkFaint}

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

                  <Ionicons name="shield-half-outline" size={14} color={c.danger} />

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

                  <Ionicons name="time-outline" size={12} color={c.accentDeep} />

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

              accent={rx.refills > 0 ? c.accentDeep : c.inkFaint}

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

                accent={c.danger}

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

                <Ionicons name="receipt-outline" size={22} color={c.inkFaint} />

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

                  egp={t("common.currency")}

                />

              ))}

            </View>

          )}

        </Animated.View>



        {/* ── Safety & trust ────────────────────────────────────────── */}

        <Animated.View entering={FadeInDown.delay(300).duration(280)} style={s.safetyCard}>

          <View style={s.safetyHead}>

            <View style={s.safetyIconWell}>

              <Ionicons name="lock-closed" size={14} color={c.accentDeep} />

            </View>

            <Text weight="black" style={s.safetyTitle}>

              {t("prescriptions.safetyTitle")}

            </Text>

          </View>

          <Text style={s.safetyBody}>

            {t("prescriptions.safetyStored")}

          </Text>

          {rx.isControlled && (

            <Text style={[s.safetyBody, { color: c.danger, marginTop: 4 }]}>

              {t("prescriptions.safetyControlled")}

            </Text>

          )}

        </Animated.View>

      </ScrollView>



      {/* ── Sticky refill CTA ────────────────────────────────────────── */}

      <View

        onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}

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

}



function Header({

  insets, onBack, isEditing, onEdit, onDelete, onSave, onCancel, deletePending, savePending,

}: HeaderProps) {

  
  const { c } = useDarkColors();
  const s = React.useMemo(() => get_s(c), [c]);
const { t } = useTranslation();

  const showActions = !!(onEdit && onDelete && onSave && onCancel);

  return (

    <View style={[s.header, { paddingTop: insets.top + 12 }]}>

      <View style={s.headerRow}>

        <Pressable

          onPress={onBack}

          hitSlop={10}

          accessibilityRole="button"

          accessibilityLabel={t("common.back")}

          style={s.backBtnTouchable}>

          {({ pressed }) => (

            <View style={[s.backBtn, pressed && s.backBtnPressed]}>

              <Ionicons name={BACK_CHEVRON} size={20} color={c.ink} />

            </View>

          )}

        </Pressable>



        <View style={[s.headerTrailingCluster, { flexDirection: flexRow(IS_RTL) }]}>

          {showActions && (

            isEditing ? (

              <>

                <Pressable

                  onPress={onCancel}

                  hitSlop={10}

                  disabled={savePending}

                  accessibilityRole="button"

                  accessibilityLabel={t("common.cancel")}

                  style={s.iconBtnTouchable}>

                  {({ pressed }) => (

                    <View style={[s.iconBtn, pressed && s.iconBtnPressed, savePending && s.iconBtnDisabled]}>

                      <Ionicons name="close-outline" size={20} color={c.ink} />

                    </View>

                  )}

                </Pressable>

                <Pressable

                  onPress={onSave}

                  hitSlop={10}

                  disabled={savePending}

                  accessibilityRole="button"

                  accessibilityLabel={t("prescriptions.editSaveCta")}

                  style={s.iconBtnTouchable}>

                  {({ pressed }) => (

                    <View style={[s.iconBtn, s.iconBtnAccent, pressed && s.iconBtnPressed, savePending && s.iconBtnDisabled]}>

                      <Ionicons name="checkmark-outline" size={20} color={c.accentDeep} />

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

                  style={s.iconBtnTouchable}>

                  {({ pressed }) => (

                    <View style={[s.iconBtn, pressed && s.iconBtnPressed]}>

                      <Ionicons name="pencil-outline" size={18} color={c.ink} />

                    </View>

                  )}

                </Pressable>

                <Pressable

                  onPress={onDelete}

                  hitSlop={10}

                  disabled={deletePending}

                  accessibilityRole="button"

                  accessibilityLabel={t("prescriptions.menuDelete")}

                  style={s.iconBtnTouchable}>

                  {({ pressed }) => (

                    <View style={[s.iconBtn, pressed && s.iconBtnPressed, deletePending && s.iconBtnDisabled]}>

                      <Ionicons name="trash-outline" size={18} color={c.danger} />

                    </View>

                  )}

                </Pressable>

              </>

            )

          )}



          <View style={s.secureBadge}>

            <Ionicons name="shield-checkmark" size={12} color={c.success} />

            <Text weight="black" style={s.secureText}>

              {t("prescriptions.secure")}

            </Text>

          </View>

        </View>

      </View>

    </View>

  );

}



/** 3-stage Rx validity track: Active → Refill Due → Expired */

function LifecycleTrack({ stage, labels }: { stage: 0 | 1 | 2; labels: [string, string, string] }) {

  
  const { c } = useDarkColors();
  const lc = React.useMemo(() => get_lc(c), [c]);
const stages = [

    { label: labels[0], icon: "checkmark-circle" as IoniconsName, color: c.success },

    { label: labels[1], icon: "alert-circle"     as IoniconsName, color: c.warn },

    { label: labels[2], icon: "close-circle"     as IoniconsName, color: c.inkFaint },

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

                    backgroundColor: reached ? st.color + "1A" : c.well,

                    borderColor:     reached ? st.color        : c.lineStrong,

                  },

                  isCurrent && { borderWidth: 2 },

                ]}>

                <Ionicons

                  name={st.icon}

                  size={18}

                  color={reached ? st.color : c.lineStrong}

                />

              </View>

              <Text

                weight={isCurrent ? "black" : "bold"}

                style={[

                  lc.label,

                  { color: reached ? c.ink : c.inkFaint },

                ]}

                numberOfLines={1}>

                {st.label}

              </Text>

            </View>

            {i < stages.length - 1 && (

              <View

                style={[

                  lc.bar,

                  { backgroundColor: i < stage ? stages[i].color : c.lineStrong },

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

  const { c } = useDarkColors();
  const tl = React.useMemo(() => get_tl(c), [c]);

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

                     borderColor:     done || current ? c.accentDeep : c.lineStrong,

                    backgroundColor: done ? c.accentDeep : c.surface,

                  },

                  current && tl.nodeCurrent,

                ]}>

                {done ? (

                  <Ionicons name="checkmark" size={13} color={c.onAccent} />

                ) : (

                  <Ionicons

                    name={step.icon}

                    size={13}

                    color={current ? c.accentDeep : c.inkFaint}

                  />

                )}

              </View>

              {i < REFILL_STEPS.length - 1 && (

                <View

                  style={[

                    tl.connector,

                    { backgroundColor: done ? c.accentDeep : c.line },

                  ]}

                />

              )}

            </View>

            <View style={tl.labelWrap}>

              <Text

                weight={current ? "black" : "bold"}

                style={[

                  tl.label,

                  { color: future ? c.inkFaint : current ? c.accentDeep : c.ink },

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

  
  const { c } = useDarkColors();

  const f = React.useMemo(() => get_f(c), [c]);



const tone = accent ?? c.inkFaint;

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

  refill, label, dateLabel, egp,

}: { refill: RefillRequest; label: string; dateLabel: string; egp: string }) {

  
  const { c } = useDarkColors();
  const h = React.useMemo(() => get_h(c), [c]);




  const cancelled = refill.status === "cancelled";

  const delivered = refill.status === "delivered";

  const tone = cancelled ? c.danger

             : delivered ? c.success

             : c.accentDeep;

  const tint = cancelled ? c.dangerTint

             : delivered ? c.successTint

             : c.accentTint;

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

          {refill.total} {egp}

        </Text>

      )}

    </View>

  );

}



// ═══════════════════════════════════════════════════════════════════════════════

// Styles

// ═══════════════════════════════════════════════════════════════════════════════



function get_s(c: DarkColors) { return StyleSheet.create({

  screen: { flex: 1, backgroundColor: c.canvas },



  // ── Header ─────────────────────────────────────────────────────────────

  header: {

    paddingHorizontal: 20,

    paddingBottom:     16,

    backgroundColor:   c.surface,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: c.line,

    ...kit.shadow.raised,

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

    backgroundColor: c.well,

    borderWidth:     1,

    borderColor:     c.line,

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

    backgroundColor: c.well,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

  },

  iconBtnAccent: {

    backgroundColor: c.accentTint,

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

    backgroundColor:   c.successTint,

    borderRadius:      kit.radius.pill,

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

    color:              c.success,

    includeFontPadding: false,

  },



  // ── Hero ───────────────────────────────────────────────────────────────

  heroCard: {

    backgroundColor: c.surface,

    borderRadius:    kit.radius.xl,

    borderWidth:     1,

    borderColor:     c.line,

    overflow:        "hidden",

    ...kit.shadow.floating,

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

    borderRadius:      kit.radius.pill,

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

    color:              c.ink,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  heroDose: {

    fontSize:           14,

    lineHeight:         20,

    color:              c.inkSoft,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  heroNameInput: {

    fontSize:           22,

    lineHeight:         28,

    letterSpacing:      -0.4,

    color:              c.ink,

    textAlign:          TEXT_START,

    paddingVertical:    4,

    borderBottomWidth:  1.5,

    borderBottomColor:  c.accent,

    includeFontPadding: false,

  },

  heroDoseInput: {

    fontSize:           14,

    lineHeight:         20,

    color:              c.inkSoft,

    textAlign:          TEXT_START,

    paddingVertical:    4,

    borderBottomWidth:  1,

    borderBottomColor:  c.line,

    includeFontPadding: false,

  },

  controlledBadge: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               10,

    backgroundColor:   c.dangerTint,

    borderRadius:      kit.radius.lg,

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

    color:              c.danger,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  // ── Generic card ───────────────────────────────────────────────────────

  card: {

    backgroundColor: c.surface,

    borderRadius:    kit.radius.lg,

    borderWidth:     1,

    borderColor:     c.line,

    padding:         16,

    gap:             14,

    ...kit.shadow.raised,

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

    color:              c.inkSoft,

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

    backgroundColor:   c.accentTint,

    borderRadius:      kit.radius.pill,

    paddingHorizontal: 10,

    paddingVertical:   5,

  },

  etaText: {

    fontSize:           10,

    lineHeight:         14,

    color:              c.accentDeep,

    includeFontPadding: false,

  },

  trackingNoRow: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    justifyContent: "space-between",

    paddingTop:     14,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: c.line,

  },

  trackingNoLabel: {

    fontSize:           11,

    color:              c.inkFaint,

    letterSpacing:      0.3,

    textTransform:      "uppercase",

    includeFontPadding: false,

  },

  trackingNoValue: {

    fontSize:           13,

    color:              c.ink,

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

    backgroundColor: c.well,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

  },

  histEmptyTitle: {

    fontSize:           14,

    lineHeight:         20,

    color:              c.ink,

    textAlign:          "center",

    includeFontPadding: false,

  },

  histEmptySub: {

    fontSize:           12,

    lineHeight:         18,

    color:              c.inkFaint,

    textAlign:          "center",

    maxWidth:           280,

    includeFontPadding: false,

  },



  // ── Staff review banner ─────────────────────────────────────────────────

  reviewBanner: {

    backgroundColor: c.warnTint,

    borderRadius:    kit.radius.lg,

    borderWidth:     1,

    borderColor:     "rgba(245,158,11,0.32)",

    padding:         14,

  },

  reviewBannerDanger: {

    backgroundColor: c.dangerTint,

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

    color:              c.warn,

    letterSpacing:      0.2,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  reviewBannerBody: {

    fontSize:           13,

    lineHeight:         20,

    color:              c.inkSoft,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  // ── Safety card ───────────────────────────────────────────────────────

  safetyCard: {

    backgroundColor: c.accentTint,

    borderRadius:    kit.radius.lg,

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

    color:              c.accentDeep,

    letterSpacing:      0.5,

    textTransform:      "uppercase",

    includeFontPadding: false,

  },

  safetyBody: {

    fontSize:           13,

    lineHeight:         20,

    color:              c.inkSoft,

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

    backgroundColor:   c.surface,

    borderTopWidth:    StyleSheet.hairlineWidth,

    borderTopColor:    c.line,

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

    backgroundColor: c.well,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

    marginBottom:    4,

  },

  notFoundTitle: {

    fontSize:           19,

    lineHeight:         26,

    color:              c.ink,

    letterSpacing:      -0.3,

    textAlign:          "center",

    includeFontPadding: false,

  },

  notFoundBody: {

    fontSize:           14,

    lineHeight:         21,

    color:              c.inkSoft,

    textAlign:          "center",

    maxWidth:           320,

    includeFontPadding: false,

  },

}); }



// ── Lifecycle track styles ────────────────────────────────────────────────────



function get_lc(_c: DarkColors) { return StyleSheet.create({

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



function get_tl(c: DarkColors) { return StyleSheet.create({

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

    backgroundColor: c.accentTint,

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



function get_f(c: DarkColors) { return StyleSheet.create({

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

    color:              c.inkFaint,

    letterSpacing:      0.4,

    textTransform:      "uppercase",

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  value: {

    fontSize:           15,

    lineHeight:         20,

    color:              c.ink,

    letterSpacing:      -0.2,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

}); }



// ── History row styles ────────────────────────────────────────────────────────



function get_h(c: DarkColors) { return StyleSheet.create({

  row: {

    alignItems:        "center",

    gap:               12,

    backgroundColor:   c.well,

    borderRadius:      kit.radius.lg,

    paddingHorizontal: 12,

    paddingVertical:   12,

    borderWidth:       1,

    borderColor:       c.line,

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

    color:              c.inkFaint,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  rejectionReason: {

    fontSize:           11,

    lineHeight:         16,

    color:              c.danger,

    textAlign:          TEXT_START,

    marginTop:          2,

    includeFontPadding: false,

  },

  total: {

    fontSize:           14,

    lineHeight:         19,

    color:              c.ink,

    includeFontPadding: false,

    flexShrink:         0,

  },

}); }

