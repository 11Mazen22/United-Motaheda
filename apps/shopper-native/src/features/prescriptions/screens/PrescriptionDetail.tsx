/**
 * PrescriptionDetail — the medication command center (2026, built from zero).
 *
 * Replaces the long-standing ComingSoon stub at /prescriptions/[id]. This is
 * the real "Medication Detail Experience": one screen that answers every
 * question a patient has about a single script.
 *
 * Architecture (top → bottom):
 *   1. Sticky header        — back + "Secure" trust badge
 *   2. Hero card            — status stripe, icon tile, drug name, dose,
 *                             status pill, controlled-substance badge
 *   3. Lifecycle track      — Active → Refill Due → Expired (current stage lit)
 *   4. Refill tracking       — Amazon-style vertical timeline, shown only when
 *                             an active refill order exists for this script
 *   5. Key facts grid       — refills left · next refill · prescriber ·
 *                             Rx number · schedule · added date
 *   6. Refill history       — past refill orders, or a helpful empty state
 *   7. Safety & trust        — controlled note + secure-storage reassurance
 *   8. Sticky CTA           — Request refill (disabled when expired)
 *
 * Data: usePrescription(id) + useRefillsForPrescription(id) from the store.
 * No new backend. Bilingual inline COPY (same pattern as TodayCare/HomeHero).
 * Motion is calm and reassuring — staggered FadeInDown, reduced-motion safe.
 */

import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { kit, Button } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { Text } from "@/shared/ui";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { usePrescription, useRefillsForPrescription } from "@/features/prescriptions";
import type { RxStatus, RefillRequest, RefillStatus } from "@/stores/prescriptionsStore";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_COLOR: Record<RxStatus, string> = {
  ready:    kit.color.success,
  active:   kit.color.accentDeep,
  expiring: kit.color.warn,
  expired:  kit.color.inkFaint,
};
const STATUS_TINT: Record<RxStatus, string> = {
  ready:    kit.color.successTint,
  active:   kit.color.accentTint,
  expiring: kit.color.warnTint,
  expired:  kit.color.well,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BILINGUAL COPY
// ═══════════════════════════════════════════════════════════════════════════════

const COPY = IS_RTL
  ? {
      secure:       "آمن",
      controlled:   "دواء خاضع للرقابة",
      schedule:     (n: number) => `جدول ${n}`,
      statusReady:    "جاهزة للاستلام",
      statusActive:   "سارية",
      statusExpiring: "تحتاج تجديد",
      statusExpired:  "منتهية",
      lifecycleTitle: "حالة الوصفة",
      stageActive:    "سارية",
      stageRefill:    "تحتاج تجديد",
      stageExpired:   "منتهية",
      trackingTitle:  "تتبّع طلب التجديد",
      trackingEta:    "الوصول المتوقع",
      trackingNo:     "رقم التتبع",
      factsTitle:     "التفاصيل",
      factRefills:    "تجديدات متبقية",
      factNextRefill: "التجديد التالي",
      factDoctor:     "الطبيب",
      factRxNumber:   "رقم الوصفة",
      factSchedule:   "الجدول",
      factAdded:      "أُضيفت في",
      historyTitle:   "سجل التجديدات",
      historyEmpty:   "لا توجد طلبات تجديد سابقة",
      historyEmptySub:"عند طلب تجديد، سيظهر هنا مع حالته.",
      safetyTitle:    "الأمان والخصوصية",
      safetyStored:   "بياناتك الطبية مشفّرة ومحفوظة بأمان في حسابك.",
      safetyControlled:"هذا الدواء خاضع للرقابة. يتطلب وصفة سارية لكل صرف.",
      refillCta:      "طلب تجديد",
      refillExpired:  "الوصفة منتهية",
      notFound:       "الوصفة غير موجودة",
      notFoundSub:    "ربما تمت إزالتها أو لم تُحمّل بعد.",
      back:           "رجوع",
      refillStatus: {
        pending:    "قيد المراجعة",
        preparing:  "قيد التحضير",
        ready:      "جاهز للاستلام",
        on_the_way: "في الطريق",
        delivered:  "تم التسليم",
        cancelled:  "ملغي",
      } as Record<RefillStatus, string>,
      egp: "ج.م",
    }
  : {
      secure:       "Secure",
      controlled:   "Controlled substance",
      schedule:     (n: number) => `Schedule ${n}`,
      statusReady:    "Ready for pickup",
      statusActive:   "Active",
      statusExpiring: "Refill due",
      statusExpired:  "Expired",
      lifecycleTitle: "Prescription status",
      stageActive:    "Active",
      stageRefill:    "Refill due",
      stageExpired:   "Expired",
      trackingTitle:  "Refill tracking",
      trackingEta:    "Estimated arrival",
      trackingNo:     "Tracking no.",
      factsTitle:     "Details",
      factRefills:    "Refills left",
      factNextRefill: "Next refill",
      factDoctor:     "Prescriber",
      factRxNumber:   "Rx number",
      factSchedule:   "Schedule",
      factAdded:      "Added on",
      historyTitle:   "Refill history",
      historyEmpty:   "No past refill requests",
      historyEmptySub:"When you request a refill, it'll appear here with its status.",
      safetyTitle:    "Safety & privacy",
      safetyStored:   "Your medical data is encrypted and stored securely in your account.",
      safetyControlled:"This medication is a controlled substance. A valid prescription is required for each fill.",
      refillCta:      "Request refill",
      refillExpired:  "Prescription expired",
      notFound:       "Prescription not found",
      notFoundSub:    "It may have been removed or hasn't loaded yet.",
      back:           "Back",
      refillStatus: {
        pending:    "Under review",
        preparing:  "Preparing",
        ready:      "Ready for pickup",
        on_the_way: "On the way",
        delivered:  "Delivered",
        cancelled:  "Cancelled",
      } as Record<RefillStatus, string>,
      egp: "EGP",
    };

function statusLabel(status: RxStatus): string {
  switch (status) {
    case "ready":    return COPY.statusReady;
    case "active":   return COPY.statusActive;
    case "expiring": return COPY.statusExpiring;
    case "expired":  return COPY.statusExpired;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleDateString(IS_RTL ? "ar-EG" : "en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Rx validity lifecycle: which of the 3 stages is current?
//   active / ready → stage 0 (still valid)
//   expiring       → stage 1 (refill due)
//   expired        → stage 2 (expired)
function lifecycleStage(status: RxStatus): 0 | 1 | 2 {
  if (status === "expired")  return 2;
  if (status === "expiring") return 1;
  return 0;
}

// Refill order tracking steps (cancelled is off-track)
const REFILL_STEPS: { key: RefillStatus; icon: IoniconsName }[] = [
  { key: "pending",    icon: "document-text-outline" },
  { key: "preparing",  icon: "flask-outline" },
  { key: "ready",      icon: "checkmark-circle-outline" },
  { key: "on_the_way", icon: "bicycle-outline" },
  { key: "delivered",  icon: "home-outline" },
];

// The most relevant in-flight refill for this Rx (not delivered/cancelled)
function activeRefill(refills: RefillRequest[]): RefillRequest | undefined {
  return refills.find((r) => r.status !== "delivered" && r.status !== "cancelled");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export function PrescriptionDetail({ id }: { id: string | undefined }): React.ReactElement {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const rx      = usePrescription(id);
  const refills = useRefillsForPrescription(id ?? "");

  const inFlight = useMemo(() => activeRefill(refills), [refills]);

  const goRefill = useCallback(() => {
    if (rx) router.push(`/prescriptions/${rx.id}/refill` as never);
  }, [router, rx]);

  // ── Not-found guard ─────────────────────────────────────────────────────────
  if (!rx) {
    return (
      <View style={s.screen}>
        <Header insets={insets} onBack={() => router.back()} />
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="medkit-outline" size={30} color={kit.color.inkFaint} />
          </View>
          <Text style={s.emptyTitle}>{COPY.notFound}</Text>
          <Text style={s.emptyBody}>{COPY.notFoundSub}</Text>
        </View>
      </View>
    );
  }

  const color     = STATUS_COLOR[rx.status];
  const tint      = STATUS_TINT[rx.status];
  const isExpired = rx.status === "expired";

  return (
    <View style={s.screen}>
      <Header insets={insets} onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 110, gap: 16 }}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.duration(280)} style={s.heroCard}>
          <View style={[s.heroStripe, { backgroundColor: color }]} />
          <View style={s.heroBody}>
            <View style={[s.heroTop, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={[s.heroTile, { backgroundColor: tint }]}>
                <Ionicons name="medkit" size={26} color={color} />
              </View>
              <View style={[s.statusPill, { backgroundColor: tint }]}>
                <View style={[s.statusDot, { backgroundColor: color }]} />
                <Text style={[s.statusPillText, { color }]} numberOfLines={1}>
                  {statusLabel(rx.status)}
                </Text>
              </View>
            </View>

            <Text style={s.heroName} numberOfLines={2}>{rx.name}</Text>
            <Text style={s.heroDose} numberOfLines={1}>{rx.dose}</Text>

            {rx.isControlled && (
              <View style={[s.controlledBadge, { flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="shield-half-outline" size={13} color={kit.color.danger} />
                <Text style={s.controlledText}>
                  {rx.schedule ? `${COPY.controlled} · ${COPY.schedule(rx.schedule)}` : COPY.controlled}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Lifecycle track ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={s.card}>
          <Text style={s.cardTitle}>{COPY.lifecycleTitle}</Text>
          <LifecycleTrack stage={lifecycleStage(rx.status)} />
        </Animated.View>

        {/* ── Refill tracking (only when an order is in flight) ── */}
        {inFlight && (
          <Animated.View entering={FadeInDown.delay(120).duration(280)} style={s.card}>
            <View style={[s.cardTitleRow, { flexDirection: flexRow(IS_RTL) }]}>
              <Text style={s.cardTitle}>{COPY.trackingTitle}</Text>
              {inFlight.eta ? (
                <View style={s.etaPill}>
                  <Ionicons name="time-outline" size={11} color={kit.color.accentDeep} />
                  <Text style={s.etaText}>{COPY.trackingEta}: {inFlight.eta}</Text>
                </View>
              ) : null}
            </View>
            <RefillTimeline refill={inFlight} />
            {inFlight.trackingNumber ? (
              <View style={[s.trackingNoRow, { flexDirection: flexRow(IS_RTL) }]}>
                <Text style={s.trackingNoLabel}>{COPY.trackingNo}</Text>
                <Text style={s.trackingNoValue}>{inFlight.trackingNumber}</Text>
              </View>
            ) : null}
          </Animated.View>
        )}

        {/* ── Key facts ── */}
        <Animated.View entering={FadeInDown.delay(180).duration(280)} style={s.card}>
          <Text style={s.cardTitle}>{COPY.factsTitle}</Text>
          <View style={s.factGrid}>
            <Fact icon="repeat-outline"      label={COPY.factRefills}    value={String(rx.refills)} accent={rx.refills > 0 ? kit.color.accentDeep : kit.color.inkFaint} />
            <Fact icon="calendar-outline"    label={COPY.factNextRefill} value={rx.nextRefill} />
            <Fact icon="person-outline"      label={COPY.factDoctor}     value={rx.doctor} />
            {rx.rxNumber ? (
              <Fact icon="barcode-outline"   label={COPY.factRxNumber}   value={rx.rxNumber} />
            ) : null}
            {rx.isControlled && rx.schedule ? (
              <Fact icon="shield-half-outline" label={COPY.factSchedule} value={COPY.schedule(rx.schedule)} accent={kit.color.danger} />
            ) : null}
            <Fact icon="time-outline"        label={COPY.factAdded}      value={formatDate(rx.addedAt)} />
          </View>
        </Animated.View>

        {/* ── Refill history ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(280)} style={s.card}>
          <Text style={s.cardTitle}>{COPY.historyTitle}</Text>
          {refills.length === 0 ? (
            <View style={s.histEmpty}>
              <View style={s.histEmptyIcon}>
                <Ionicons name="receipt-outline" size={20} color={kit.color.inkFaint} />
              </View>
              <Text style={s.histEmptyTitle}>{COPY.historyEmpty}</Text>
              <Text style={s.histEmptySub}>{COPY.historyEmptySub}</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {refills.map((r) => (
                <RefillHistoryRow key={r.id} refill={r} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Safety & trust ── */}
        <Animated.View entering={FadeInDown.delay(300).duration(280)} style={s.safetyCard}>
          <View style={[s.safetyHead, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="lock-closed" size={14} color={kit.color.accentDeep} />
            <Text style={s.safetyTitle}>{COPY.safetyTitle}</Text>
          </View>
          <Text style={s.safetyBody}>{COPY.safetyStored}</Text>
          {rx.isControlled && (
            <Text style={[s.safetyBody, { color: kit.color.danger, marginTop: 6 }]}>
              {COPY.safetyControlled}
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Sticky refill CTA ── */}
      <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Button
          variant="primary"
          full
          icon={isExpired ? "lock-closed" : "refresh"}
          label={isExpired ? COPY.refillExpired : COPY.refillCta}
          disabled={isExpired}
          onPress={goRefill}
        />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Header({ insets, onBack }: { insets: { top: number }; onBack: () => void }) {
  return (
    <View style={[s.header, { paddingTop: insets.top + 12, flexDirection: flexRow(IS_RTL) }]}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={COPY.back} style={s.backBtn}>
        <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
      </Pressable>
      <View style={s.secureBadge}>
        <Ionicons name="shield-checkmark" size={12} color={kit.color.success} />
        <Text style={s.secureText}>{COPY.secure}</Text>
      </View>
    </View>
  );
}

/** 3-stage Rx validity track: Active → Refill Due → Expired */
function LifecycleTrack({ stage }: { stage: 0 | 1 | 2 }) {
  const stages = [
    { label: COPY.stageActive,  icon: "checkmark-circle" as IoniconsName, color: kit.color.success },
    { label: COPY.stageRefill,  icon: "alert-circle"     as IoniconsName, color: kit.color.warn },
    { label: COPY.stageExpired, icon: "close-circle"     as IoniconsName, color: kit.color.inkFaint },
  ];
  return (
    <View style={[s.lifecycle, { flexDirection: flexRow(IS_RTL) }]}>
      {stages.map((st, i) => {
        const reached = i <= stage;
        const isCurrent = i === stage;
        const dotColor = reached ? st.color : kit.color.lineStrong;
        return (
          <React.Fragment key={st.label}>
            <View style={s.lifecycleNode}>
              <View
                style={[
                  s.lifecycleDot,
                  { backgroundColor: reached ? st.color + "1A" : kit.color.well, borderColor: dotColor },
                  isCurrent && { borderWidth: 2 },
                ]}>
                <Ionicons name={st.icon} size={16} color={dotColor} />
              </View>
              <Text
                style={[
                  s.lifecycleLabel,
                  { color: reached ? kit.color.ink : kit.color.inkFaint },
                  isCurrent && { fontFamily: theme.fonts.black },
                ]}
                numberOfLines={1}>
                {st.label}
              </Text>
            </View>
            {i < stages.length - 1 && (
              <View style={[s.lifecycleBar, { backgroundColor: i < stage ? stages[i].color : kit.color.lineStrong }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** Amazon-style vertical refill order timeline */
function RefillTimeline({ refill }: { refill: RefillRequest }) {
  const currentIdx = REFILL_STEPS.findIndex((st) => st.key === refill.status);
  return (
    <View style={{ gap: 0 }}>
      {REFILL_STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        const future  = i > currentIdx;
        const c = done || current ? kit.color.accentDeep : kit.color.lineStrong;
        return (
          <View key={step.key} style={[s.tlRow, { flexDirection: flexRow(IS_RTL) }]}>
            {/* Rail */}
            <View style={s.tlRail}>
              <View
                style={[
                  s.tlNode,
                  { borderColor: c, backgroundColor: done ? kit.color.accentDeep : kit.color.surface },
                  current && s.tlNodeCurrent,
                ]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color={kit.color.onAccent} />
                ) : (
                  <Ionicons name={step.icon} size={12} color={current ? kit.color.accentDeep : kit.color.inkFaint} />
                )}
              </View>
              {i < REFILL_STEPS.length - 1 && (
                <View style={[s.tlConnector, { backgroundColor: done ? kit.color.accentDeep : kit.color.line }]} />
              )}
            </View>
            {/* Label */}
            <View style={s.tlLabelWrap}>
              <Text
                style={[
                  s.tlLabel,
                  { color: future ? kit.color.inkFaint : kit.color.ink },
                  current && { fontFamily: theme.fonts.black, color: kit.color.accentDeep },
                ]}>
                {COPY.refillStatus[step.key]}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Fact({ icon, label, value, accent }: {
  icon: IoniconsName; label: string; value: string; accent?: string;
}) {
  return (
    <View style={s.fact}>
      <View style={[s.factIconWrap, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name={icon} size={13} color={accent ?? kit.color.inkFaint} />
        <Text style={s.factLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.factValue, accent ? { color: accent } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RefillHistoryRow({ refill }: { refill: RefillRequest }) {
  const cancelled = refill.status === "cancelled";
  const delivered = refill.status === "delivered";
  const tone = cancelled ? kit.color.danger : delivered ? kit.color.success : kit.color.accentDeep;
  const tint = cancelled ? kit.color.dangerTint : delivered ? kit.color.successTint : kit.color.accentTint;
  return (
    <View style={[s.histRow, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[s.histDot, { backgroundColor: tint }]}>
        <Ionicons
          name={cancelled ? "close" : delivered ? "checkmark" : "ellipsis-horizontal"}
          size={13}
          color={tone}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.histStatus, { color: tone }]} numberOfLines={1}>
          {COPY.refillStatus[refill.status]}
        </Text>
        <Text style={s.histDate} numberOfLines={1}>{formatDate(refill.placedAt)}</Text>
      </View>
      {refill.total > 0 && (
        <Text style={s.histTotal}>{refill.total} {COPY.egp}</Text>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom:     14,
    alignItems:        "center",
    justifyContent:    "space-between",
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.canvas,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  secureBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.successTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  secureText: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      0.4,
    color:              kit.color.success,
    includeFontPadding: false,
  },

  // Hero
  heroCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  heroStripe: { height: 4, width: "100%" },
  heroBody: { padding: 20, gap: 8 },
  heroTop: {
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   4,
  },
  heroTile: {
    width:          56,
    height:         56,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  statusPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         15,
    includeFontPadding: false,
  },
  heroName: {
    fontFamily:         theme.fonts.black,
    fontSize:           26,
    lineHeight:         32,
    letterSpacing:      -0.6,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  heroDose: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  controlledBadge: {
    alignSelf:         "flex-start",
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.dangerTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   6,
    marginTop:         6,
  },
  controlledText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.danger,
    includeFontPadding: false,
  },

  // Generic card
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    padding:         16,
    gap:             14,
    ...kit.shadow.raised,
  },
  cardTitleRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Lifecycle track
  lifecycle: {
    alignItems:    "flex-start",
    justifyContent:"space-between",
  },
  lifecycleNode: {
    alignItems: "center",
    gap:        6,
    width:      72,
  },
  lifecycleDot: {
    width:          40,
    height:         40,
    borderRadius:   20,
    borderWidth:    1.5,
    alignItems:     "center",
    justifyContent: "center",
  },
  lifecycleLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    textAlign:          "center",
    includeFontPadding: false,
  },
  lifecycleBar: {
    flex:        1,
    height:      2,
    marginTop:   19,
    borderRadius:1,
  },

  // Refill timeline
  tlRow: { alignItems: "stretch" },
  tlRail: { alignItems: "center", width: 28 },
  tlNode: {
    width:          26,
    height:         26,
    borderRadius:   13,
    borderWidth:    1.5,
    alignItems:     "center",
    justifyContent: "center",
  },
  tlNodeCurrent: {
    borderWidth:     2,
    backgroundColor: kit.color.accentTint,
  },
  tlConnector: {
    width:      2,
    flex:       1,
    minHeight:  18,
    marginVertical: 2,
  },
  tlLabelWrap: {
    flex:           1,
    paddingHorizontal: 12,
    paddingBottom:  16,
    justifyContent: "center",
  },
  tlLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         18,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  etaPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  etaText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  trackingNoRow: {
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingTop:        12,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
  trackingNoLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  trackingNoValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    color:              kit.color.ink,
    includeFontPadding: false,
  },

  // Fact grid
  factGrid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    rowGap:        14,
  },
  fact: {
    width: "50%",
    gap:   4,
    paddingEnd: 8,
  },
  factIconWrap: {
    alignItems: "center",
    gap:        6,
  },
  factLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    letterSpacing:      0.3,
    textTransform:      "uppercase",
    includeFontPadding: false,
    flexShrink:         1,
  },
  factValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         19,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Refill history
  histRow: {
    alignItems:        "center",
    gap:               12,
    backgroundColor:   kit.color.well,
    borderRadius:      kit.radius.control,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  histDot: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  histStatus: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         17,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  histDate: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          1,
  },
  histTotal: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  histEmpty: {
    alignItems:      "center",
    paddingVertical: 16,
    gap:             8,
  },
  histEmptyIcon: {
    width:           48,
    height:          48,
    borderRadius:    16,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },
  histEmptyTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  histEmptySub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    maxWidth:           260,
    includeFontPadding: false,
  },

  // Safety
  safetyCard: {
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    padding:           16,
    gap:               6,
  },
  safetyHead: {
    alignItems: "center",
    gap:        7,
  },
  safetyTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.accentDeep,
    letterSpacing:      0.3,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  safetyBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Sticky CTA
  ctaBar: {
    position:          "absolute",
    left:              0,
    right:             0,
    bottom:            0,
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },

  // Not-found / centered
  centered: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               12,
  },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    24,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  emptyTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         25,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  emptyBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           300,
    includeFontPadding: false,
  },
});
