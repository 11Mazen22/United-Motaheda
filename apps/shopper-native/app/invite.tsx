/**
 * Invite — VIP light surface rebuild (Phase 2).
 * Removes LinearGradient (BANNED). Purple invitation palette kept via flat surfaces.
 * Logic: unchanged.
 */
import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { useAuth } from "@/features/auth/context";
import { useReferralCode, useReferralRewards } from "@/features/loyalty/hooks/useReferralCode";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// Intentional loyalty/invite purple palette — no kit token for these values.
const INVITE = {
  purple:        "#7C3AED",
  purpleMid:     "#9333EA",
  purpleTint:    "#F5F3FF",
  purpleLine:    "#DDD6FE",
  emerald:       "#10B981",
  whatsappGreen: "#25D366",
  whatsappDark:  "#128C7E",
} as const;

function blurActiveElementOnWeb() {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") return;
  const webDoc = (globalThis as unknown as {
    document?: { activeElement?: { blur?: () => void } };
  }).document;
  const activeElement = webDoc?.activeElement;
  if (activeElement?.blur) activeElement.blur();
}

export default function InviteScreen() {
  const { t, i18n } = useTranslation();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { user }  = useAuth();
  const isAuthed  = !!user;
  const locale    = i18n.language.startsWith("en") ? "en-US" : "ar-EG";

  const { data: referral, isLoading } = useReferralCode(isAuthed);
  const { data: rewards = [] }        = useReferralRewards(isAuthed);

  const code           = referral?.code ?? null;
  const totalReferrals = rewards.length;
  const totalPoints    = rewards.reduce((s, r) => s + r.points_granted, 0);

  useFocusEffect(
    useCallback(() => { return () => { blurActiveElementOnWeb(); }; }, []),
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── VIP Header ── */}
      <Animated.View entering={FadeIn.duration(220)} style={[s.header, { flexDirection: flexRow(IS_RTL) }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10} accessibilityRole="button">
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>
        <View style={s.iconTile}>
          <Ionicons name="people-outline" size={22} color={INVITE.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText style={[s.headerTitle, { textAlign: TEXT_START }]}>{t("invite.title")}</UIText>
          <UIText style={[s.headerSub, { textAlign: TEXT_START }]}>{t("invite.subtitle")}</UIText>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* ── Hero card (flat purple, no gradient) ── */}
        <Animated.View entering={FadeIn.duration(380)} style={s.heroCard}>
          {/* Subtle tint overlay circles */}
          <View style={[s.deco, { top: -30, right: -30, width: 120, height: 120 }]} />
          <View style={[s.deco, { bottom: -20, left: -20, width:  80, height:  80 }]} />
          <View style={s.heroBadge}>
            <Ionicons name="people" size={28} color="#fff" />
          </View>
          <UIText style={[s.heroTitle, { textAlign: TEXT_START }]}>
            {t("invite.heroTitle", { appName: t("common.appName") })}
          </UIText>
          <UIText style={[s.heroSub, { textAlign: TEXT_START }]}>{t("invite.heroSub")}</UIText>
        </Animated.View>

        {/* ── Stats row ── */}
        {isAuthed && (
          <Animated.View entering={FadeInDown.duration(360).delay(80)} style={[s.statsRow, { flexDirection: flexRow(IS_RTL) }]}>
            <StatCell icon="people-outline" label={t("invite.statReferrals")} value={totalReferrals} color={INVITE.purple} />
            <View style={s.statsDivider} />
            <StatCell icon="star-outline"   label={t("invite.statPoints")}    value={totalPoints}    color="#D97706" />
          </Animated.View>
        )}

        {/* ── Code card ── */}
        <Animated.View entering={FadeInDown.duration(360).delay(160)} style={{ paddingHorizontal: 20 }}>
          {isAuthed ? (
            isLoading ? (
              <View style={s.codeCardSkeleton} />
            ) : code ? (
              <CodeCard code={code} />
            ) : (
              <NoCodeCard />
            )
          ) : (
            <UnauthCard />
          )}
        </Animated.View>

        {/* ── How it works ── */}
        <Animated.View entering={FadeInDown.duration(360).delay(240)} style={s.sectionWrap}>
          <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("invite.howTitle")}</UIText>
          <View style={s.howList}>
            <HowStep num="1" color={INVITE.purple}        title={t("invite.howStep1Title")} body={t("invite.howStep1Body")} />
            <HowStep num="2" color={kit.color.accentDeep} title={t("invite.howStep2Title")} body={t("invite.howStep2Body")} />
            <HowStep num="3" color={INVITE.emerald}       title={t("invite.howStep3Title")} body={t("invite.howStep3Body")} />
          </View>
        </Animated.View>

        {/* ── Past referrals ── */}
        {rewards.length > 0 && (
          <Animated.View entering={FadeInDown.duration(360).delay(300)} style={s.sectionWrap}>
            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("invite.histTitle")}</UIText>
            <View style={s.histList}>
              {rewards.map((r, idx) => (
                <View key={r.id} style={[s.histRow, { flexDirection: flexRow(IS_RTL) }, idx === rewards.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={s.histIcon}>
                    <Ionicons name="person-add-outline" size={15} color={INVITE.purple} />
                  </View>
                  <UIText style={[s.histDate, { flex: 1, textAlign: TEXT_START }]}>
                    {new Date(r.created_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  </UIText>
                  <UIText style={s.histPts}>+{r.points_granted.toLocaleString(locale)} {t("invite.pointsUnit")}</UIText>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── CodeCard ─────────────────────────────────────────────────────────────────

function CodeCard({ code }: { code: string }) {
  const { t }  = useTranslation();
  const IS_RTL = isRtl();
  const [copied,  setCopied]  = useState(false);
  const [sharing, setSharing] = useState(false);
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleCopy = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    scale.value = withSequence(withSpring(0.94, { damping: 14 }), withSpring(1.00, { damping: 14 }));
    try { await Share.share({ message: code, title: t("invite.shareTitle") }); } catch { /* dismissed */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [code, scale, t]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await Share.share({ message: t("invite.shareMessage", { code }), title: t("invite.shareDialogTitle") });
    } catch { /* dismissed */ } finally { setSharing(false); }
  }, [code, sharing, t]);

  return (
    <Animated.View style={[s.codeCard, anim]}>
      <UIText style={[s.codeLabel, { textAlign: textAlignStart(IS_RTL) }]}>{t("invite.yourCode")}</UIText>

      <View style={[s.codeBox, { flexDirection: flexRow(IS_RTL) }]}>
        <UIText style={[s.codeText, { textAlign: textAlignStart(IS_RTL) }]}>{code}</UIText>
        <Pressable onPress={handleCopy} hitSlop={8} style={[s.copyBtn, { flexDirection: flexRow(IS_RTL) }]} accessibilityRole="button" accessibilityLabel={t("invite.copyCode")}>
          <Ionicons
            name={copied ? "checkmark-circle" : "copy-outline"}
            size={20}
            color={copied ? kit.color.accentDeep : kit.color.inkSoft}
          />
          <UIText style={[s.copyLabel, copied && { color: kit.color.accentDeep }]}>
            {copied ? t("invite.copied") : t("invite.copy")}
          </UIText>
        </Pressable>
      </View>

      {copied && (
        <Animated.View entering={FadeIn.duration(160)} style={[s.copiedBanner, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="checkmark-circle" size={13} color={kit.color.accentDeep} />
          <UIText style={[s.copiedText, { textAlign: textAlignStart(IS_RTL) }]}>{t("invite.codeCopied")}</UIText>
        </Animated.View>
      )}

      {/* Share button — flat purple, no gradient */}
      <Pressable
        onPress={handleShare}
        disabled={sharing}
        accessibilityRole="button"
        accessibilityLabel={t("invite.shareCode")}
        style={({ pressed }) => [s.shareBtn, { flexDirection: flexRow(IS_RTL) }, pressed && { opacity: 0.88 }]}>
        <Ionicons name="share-social-outline" size={18} color="#fff" />
        <UIText style={s.shareBtnText}>{t("invite.shareCode")}</UIText>
      </Pressable>

      <Pressable onPress={handleShare} accessibilityRole="button" accessibilityLabel={t("invite.whatsappShare")} style={[s.waBtn, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name="logo-whatsapp" size={16} color={INVITE.whatsappGreen} />
        <UIText style={s.waBtnText}>{t("invite.whatsappShare")}</UIText>
      </Pressable>
    </Animated.View>
  );
}

function NoCodeCard() {
  const { t } = useTranslation();
  return (
    <View style={[s.codeCard, { alignItems: "center", paddingVertical: 20, gap: 10 }]}>
      <View style={s.noCodeIcon}>
        <Ionicons name="hourglass-outline" size={28} color={kit.color.inkFaint} />
      </View>
      <UIText style={s.codeLabel}>{t("invite.noCodeTitle")}</UIText>
      <UIText style={{ fontFamily: theme.fonts.regular, fontSize: 13, color: kit.color.inkFaint, textAlign: "center" }}>
        {t("invite.noCodeBody")}
      </UIText>
    </View>
  );
}

function UnauthCard() {
  const { t } = useTranslation();
  return (
    <View style={[s.codeCard, { alignItems: "center", paddingVertical: 20, gap: 10 }]}>
      <View style={s.noCodeIcon}>
        <Ionicons name="lock-closed-outline" size={28} color={kit.color.inkFaint} />
      </View>
      <UIText style={s.codeLabel}>{t("invite.unauthTitle")}</UIText>
      <UIText style={{ fontFamily: theme.fonts.regular, fontSize: 13, color: kit.color.inkFaint, textAlign: "center" }}>
        {t("invite.unauthBody")}
      </UIText>
    </View>
  );
}

function StatCell({ icon, label, value, color }: {
  icon:  React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
  color: string;
}) {
  const { i18n } = useTranslation();
  const locale   = i18n.language.startsWith("en") ? "en-US" : "ar-EG";
  return (
    <View style={s.statCell}>
      <View style={[s.statIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <UIText style={s.statValue}>{value.toLocaleString(locale)}</UIText>
      <UIText style={s.statLabel}>{label}</UIText>
    </View>
  );
}

function HowStep({ num, color, title, body }: { num: string; color: string; title: string; body: string }) {
  const IS_RTL = isRtl();
  return (
    <View style={[s.howStep, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[s.howNum, { backgroundColor: color + "18", borderColor: color + "40" }]}>
        <UIText style={[s.howNumText, { color }]}>{num}</UIText>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <UIText style={[s.howStepTitle, { textAlign: textAlignStart(IS_RTL) }]}>{title}</UIText>
        <UIText style={[s.howStepBody, { textAlign: textAlignStart(IS_RTL) }]}>{body}</UIText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: {
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: INVITE.purpleTint,
    borderWidth:     1,
    borderColor:     INVITE.purpleLine,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.3,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  headerSub: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // Hero card — flat purple, no gradient
  heroCard: {
    marginHorizontal: 20,
    marginTop:        16,
    borderRadius:     22,
    padding:          20,
    backgroundColor:  INVITE.purple,
    overflow:         "hidden",
    gap:              10,
    ...kit.shadow.floating,
  },
  deco: {
    position:        "absolute",
    borderRadius:    999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroBadge: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems:      "center",
    justifyContent:  "center",
    alignSelf:       "flex-end",
  },
  heroTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    color:              "#fff",
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  heroSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    color:              "rgba(255,255,255,0.75)",
    lineHeight:         20,
    includeFontPadding: false,
  },

  statsRow: {
    marginHorizontal: 20,
    marginTop:        12,
    backgroundColor:  kit.color.surface,
    borderRadius:     20,
    paddingVertical:  16,
    paddingHorizontal: 8,
    borderWidth:      1,
    borderColor:      kit.color.line,
    ...kit.shadow.raised,
  },
  statCell:    { flex: 1, alignItems: "center", gap: 6 },
  statIcon:    { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    color:              kit.color.ink,
    letterSpacing:      -0.5,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  statsDivider: { width: 1, height: 48, backgroundColor: kit.color.line, alignSelf: "center" },

  codeCard: {
    marginTop:       14,
    backgroundColor: kit.color.surface,
    borderRadius:    22,
    padding:         20,
    gap:             14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  codeCardSkeleton: {
    marginTop:       14,
    height:          220,
    borderRadius:    22,
    backgroundColor: kit.color.well,
  },
  codeLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  codeBox: {
    alignItems:        "center",
    justifyContent:    "space-between",
    backgroundColor:   kit.color.well,
    borderRadius:      14,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderWidth:       1,
    borderColor:       kit.color.line,
    borderStyle:       "dashed",
  },
  codeText: {
    fontFamily:         theme.fonts.black,
    fontSize:           26,
    color:              INVITE.purple,
    letterSpacing:      4,
    includeFontPadding: false,
  },
  copyBtn: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.surface,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  copyLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  copiedBanner: {
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  copiedText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  shareBtn: {
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius:    14,
    backgroundColor: INVITE.purple,
  },
  shareBtnText: {
    fontFamily:         theme.fonts.black,
    fontSize:           15,
    color:              "#fff",
    includeFontPadding: false,
  },
  waBtn: {
    alignItems:        "center",
    justifyContent:    "center",
    gap:               8,
    paddingVertical:   12,
    borderRadius:      12,
    backgroundColor:   INVITE.whatsappGreen + "14",
    borderWidth:       1,
    borderColor:       INVITE.whatsappGreen + "30",
  },
  waBtnText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    color:              INVITE.whatsappDark,
    includeFontPadding: false,
  },
  noCodeIcon: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },

  sectionWrap: { marginHorizontal: 20, marginTop: 20, gap: 12 },
  sectionTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    includeFontPadding: false,
  },
  howList: {
    backgroundColor: kit.color.surface,
    borderRadius:    18,
    padding:         16,
    gap:             16,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  howStep:     { alignItems: "flex-start", gap: 14 },
  howNum: {
    width:          36,
    height:         36,
    borderRadius:   11,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  howNumText: {
    fontFamily:         theme.fonts.black,
    fontSize:           15,
    includeFontPadding: false,
  },
  howStepTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    color:              kit.color.ink,
    letterSpacing:      -0.1,
    includeFontPadding: false,
  },
  howStepBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    color:              kit.color.inkSoft,
    lineHeight:         18,
    includeFontPadding: false,
  },

  histList: {
    backgroundColor: kit.color.surface,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  histRow: {
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 14,
    paddingVertical:   13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  histIcon: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: INVITE.purpleTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  histDate: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  histPts: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    color:              INVITE.purple,
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
});
