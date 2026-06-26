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
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { kit, Button } from "@/shared/kit";
import { Text } from "@/shared/ui";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { usePrescription, useRefillsForPrescription } from "@/features/prescriptions";
import type { RxStatus, RefillRequest, RefillStatus } from "@/stores/prescriptionsStore";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ═══════════════════════════════════════════════════════════════════════════════
// Status tokens
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

export function PrescriptionDetail({ id }: { id: string | undefined }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const rx          = usePrescription(id);
  const refills     = useRefillsForPrescription(id ?? "");

  const inFlight = useMemo(() => activeRefill(refills), [refills]);

  const goRefill = useCallback(() => {
    if (rx) router.push(`/prescriptions/${rx.id}/refill` as never);
  }, [router, rx]);

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
            <Ionicons name="medkit-outline" size={36} color={kit.color.inkFaint} />
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

  const color     = STATUS_COLOR[rx.status];
  const tint      = STATUS_TINT[rx.status];
  const isExpired = rx.status === "expired";

  return (
    <View style={s.screen}>
      <Header insets={insets} onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding:        20,
          paddingBottom:  insets.bottom + 110,
          gap:            16,
        }}
        showsVerticalScrollIndicator={false}>

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

            <Text weight="black" style={s.heroName} numberOfLines={2}>
              {rx.name}
            </Text>
            <Text weight="semibold" style={s.heroDose} numberOfLines={1}>
              {rx.dose}
            </Text>

            {rx.isControlled && (
              <View style={s.controlledBadge}>
                <View style={s.controlledIconWell}>
                  <Ionicons name="shield-half-outline" size={14} color={kit.color.danger} />
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
                  <Ionicons name="time-outline" size={12} color={kit.color.accentDeep} />
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
              accent={rx.refills > 0 ? kit.color.accentDeep : kit.color.inkFaint}
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
                accent={kit.color.danger}
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
                <Ionicons name="receipt-outline" size={22} color={kit.color.inkFaint} />
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
              <Ionicons name="lock-closed" size={14} color={kit.color.accentDeep} />
            </View>
            <Text weight="black" style={s.safetyTitle}>
              {t("prescriptions.safetyTitle")}
            </Text>
          </View>
          <Text style={s.safetyBody}>
            {t("prescriptions.safetyStored")}
          </Text>
          {rx.isControlled && (
            <Text style={[s.safetyBody, { color: kit.color.danger, marginTop: 4 }]}>
              {t("prescriptions.safetyControlled")}
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Sticky refill CTA ────────────────────────────────────────── */}
      <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
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

function Header({ insets, onBack }: { insets: { top: number }; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={s.headerRow}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
          <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
        </Pressable>

        <View style={s.secureBadge}>
          <Ionicons name="shield-checkmark" size={12} color={kit.color.success} />
          <Text weight="black" style={s.secureText}>
            {t("prescriptions.secure")}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** 3-stage Rx validity track: Active → Refill Due → Expired */
function LifecycleTrack({ stage, labels }: { stage: 0 | 1 | 2; labels: [string, string, string] }) {
  const stages = [
    { label: labels[0], icon: "checkmark-circle" as IoniconsName, color: kit.color.success },
    { label: labels[1], icon: "alert-circle"     as IoniconsName, color: kit.color.warn },
    { label: labels[2], icon: "close-circle"     as IoniconsName, color: kit.color.inkFaint },
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
                    backgroundColor: reached ? st.color + "1A" : kit.color.well,
                    borderColor:     reached ? st.color        : kit.color.lineStrong,
                  },
                  isCurrent && { borderWidth: 2 },
                ]}>
                <Ionicons
                  name={st.icon}
                  size={18}
                  color={reached ? st.color : kit.color.lineStrong}
                />
              </View>
              <Text
                weight={isCurrent ? "black" : "bold"}
                style={[
                  lc.label,
                  { color: reached ? kit.color.ink : kit.color.inkFaint },
                ]}
                numberOfLines={1}>
                {st.label}
              </Text>
            </View>
            {i < stages.length - 1 && (
              <View
                style={[
                  lc.bar,
                  { backgroundColor: i < stage ? stages[i].color : kit.color.lineStrong },
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
  const currentIdx = REFILL_STEPS.findIndex((st) => st.key === refill.status);
  return (
    <View>
      {REFILL_STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        const future  = i > currentIdx;
        const c       = done || current ? kit.color.accentDeep : kit.color.lineStrong;
        return (
          <View key={step.key} style={[tl.row, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={tl.rail}>
              <View
                style={[
                  tl.node,
                  {
                    borderColor:     c,
                    backgroundColor: done ? kit.color.accentDeep : kit.color.surface,
                  },
                  current && tl.nodeCurrent,
                ]}>
                {done ? (
                  <Ionicons name="checkmark" size={13} color={kit.color.onAccent} />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={13}
                    color={current ? kit.color.accentDeep : kit.color.inkFaint}
                  />
                )}
              </View>
              {i < REFILL_STEPS.length - 1 && (
                <View
                  style={[
                    tl.connector,
                    { backgroundColor: done ? kit.color.accentDeep : kit.color.line },
                  ]}
                />
              )}
            </View>
            <View style={tl.labelWrap}>
              <Text
                weight={current ? "black" : "bold"}
                style={[
                  tl.label,
                  { color: future ? kit.color.inkFaint : current ? kit.color.accentDeep : kit.color.ink },
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
  const tone = accent ?? kit.color.inkFaint;
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
  const cancelled = refill.status === "cancelled";
  const delivered = refill.status === "delivered";
  const tone = cancelled ? kit.color.danger
             : delivered ? kit.color.success
             : kit.color.accentDeep;
  const tint = cancelled ? kit.color.dangerTint
             : delivered ? kit.color.successTint
             : kit.color.accentTint;
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  headerRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: {
    opacity:   0.7,
    transform: [{ scale: 0.96 }],
  },
  secureBadge: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.successTint,
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
    color:              kit.color.success,
    includeFontPadding: false,
  },

  // ── Hero ───────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
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
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  heroDose: {
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  controlledBadge: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.dangerTint,
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
    color:              kit.color.danger,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Generic card ───────────────────────────────────────────────────────
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
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            10,
  },
  cardTitle: {
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.inkSoft,
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
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  etaText: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  trackingNoRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  trackingNoLabel: {
    fontSize:           11,
    color:              kit.color.inkFaint,
    letterSpacing:      0.3,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  trackingNoValue: {
    fontSize:           13,
    color:              kit.color.ink,
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
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  histEmptyTitle: {
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  histEmptySub: {
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    maxWidth:           280,
    includeFontPadding: false,
  },

  // ── Safety card ───────────────────────────────────────────────────────
  safetyCard: {
    backgroundColor: kit.color.accentTint,
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
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  safetyBody: {
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
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
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
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
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  notFoundTitle: {
    fontSize:           19,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          "center",
    includeFontPadding: false,
  },
  notFoundBody: {
    fontSize:           14,
    lineHeight:         21,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           320,
    includeFontPadding: false,
  },
});

// ── Lifecycle track styles ────────────────────────────────────────────────────

const lc = StyleSheet.create({
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
});

// ── Refill timeline styles ────────────────────────────────────────────────────

const tl = StyleSheet.create({
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
    backgroundColor: kit.color.accentTint,
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
});

// ── Fact cell styles ──────────────────────────────────────────────────────────

const f = StyleSheet.create({
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
    color:              kit.color.inkFaint,
    letterSpacing:      0.4,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  value: {
    fontSize:           15,
    lineHeight:         20,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
});

// ── History row styles ────────────────────────────────────────────────────────

const h = StyleSheet.create({
  row: {
    alignItems:        "center",
    gap:               12,
    backgroundColor:   kit.color.well,
    borderRadius:      kit.radius.lg,
    paddingHorizontal: 12,
    paddingVertical:   12,
    borderWidth:       1,
    borderColor:       kit.color.line,
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
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  total: {
    fontSize:           14,
    lineHeight:         19,
    color:              kit.color.ink,
    includeFontPadding: false,
    flexShrink:         0,
  },
});
