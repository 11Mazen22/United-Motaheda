/**
 * Shifaa (شفاء) — AI pharmacist consultation screen.
 * Architecture: App → Railway (/pharmacist/chat) → OpenRouter → AI
 * OpenRouter API key never touches the client bundle.
 */

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
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { railwayApi } from "@/lib/railwayApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface ChatMsg {
  id:        string;
  role:      Role;
  content:   string;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCLAIMER_KEY = "@um_pharmacist_disclaimer_v1";
const IS_RTL         = isRtl();
const TEXT_START     = textAlignStart(IS_RTL);

const TEAL      = "#0E7E74";
const TEAL_DEEP = "#065A52";
const TEAL_PALE = "#e6f7f4";
const BG        = "#f0f5f4";

// ─── Pulsing AI avatar ────────────────────────────────────────────────────────

const AIAvatar = React.memo(function AIAvatar({ size = 34 }: { size?: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1000 }),
        withTiming(1,    { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity:   interpolate(pulse.value, [1, 1.35], [0.3, 0]),
  }));

  return (
    <View style={{ width: size + 10, height: size + 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[
        {
          position:        "absolute",
          width:           size + 10, height: size + 10,
          borderRadius:    (size + 10) / 2,
          backgroundColor: TEAL,
        },
        ring,
      ]} />
      <View style={{
        width:           size, height: size,
        borderRadius:    size / 2,
        backgroundColor: TEAL,
        alignItems:      "center",
        justifyContent:  "center",
      }}>
        <Ionicons name="medkit" size={Math.round(size * 0.44)} color="#fff" />
      </View>
    </View>
  );
});

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingDot = ({ delay }: { delay: number }) => {
  const y = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      y.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 320 }),
          withTiming(0,  { duration: 320 }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(t);
  }, [y, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[s.typingDot, style]} />;
};

const TypingIndicator = () => (
  <Animated.View entering={FadeInUp.duration(200)} style={s.typingRow}>
    <AIAvatar size={28} />
    <View style={s.typingBubble}>
      <TypingDot delay={0}   />
      <TypingDot delay={120} />
      <TypingDot delay={240} />
    </View>
  </Animated.View>
);

// ─── Welcome card ─────────────────────────────────────────────────────────────

const WelcomeCard = React.memo(function WelcomeCard({ title, body, badge247, badgeEvidence }: {
  title:        string;
  body:         string;
  badge247:     string;
  badgeEvidence:string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={s.welcomeCard}>
      <AIAvatar size={52} />
      <View style={s.welcomeTextWrap}>
        <UIText style={s.welcomeTitle}>{title}</UIText>
        <UIText style={s.welcomeBody}>{body}</UIText>
      </View>
      <View style={s.badgeRow}>
        <View style={s.badge}>
          <Ionicons name="time-outline" size={12} color={TEAL} />
          <UIText style={s.badgeText}>{badge247}</UIText>
        </View>
        <View style={s.badge}>
          <Ionicons name="shield-checkmark-outline" size={12} color={TEAL} />
          <UIText style={s.badgeText}>{badgeEvidence}</UIText>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";

  if (msg.id === "welcome") {
    const parts = msg.content.split("\n\n");
    return (
      <WelcomeCard
        title={parts[0] ?? ""}
        body={parts[1] ?? ""}
        badge247="24/7"
        badgeEvidence={IS_RTL ? "معلومات موثوقة" : "Evidence-based"}
      />
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAI]}
    >
      {!isUser && <AIAvatar size={28} />}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        <UIText style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAI]}>
          {msg.content}
        </UIText>
      </View>
      {isUser && <View style={{ width: 28 }} />}
    </Animated.View>
  );
});

// ─── Disclaimer modal ─────────────────────────────────────────────────────────

const DisclaimerModal = ({
  visible,
  onAccept,
}: {
  visible:  boolean;
  onAccept: () => void;
}) => {
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <Animated.View
          entering={FadeInUp.springify().damping(18).stiffness(130)}
          style={[s.modalCard, { paddingBottom: insets.bottom + 24 }]}
        >
          <View style={s.modalHandle} />

          <LinearGradient colors={[TEAL, TEAL_DEEP]} style={s.modalIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="shield-checkmark" size={30} color="#fff" />
          </LinearGradient>

          <UIText style={s.modalTitle}>{t("pharmacist.title")}</UIText>
          <UIText style={s.modalSubtitle}>{t("pharmacist.subtitle")}</UIText>

          <View style={s.modalDivider} />

          <UIText style={s.modalBody}>{t("pharmacist.disclaimer")}</UIText>

          <Pressable
            onPress={onAccept}
            style={({ pressed }) => [s.modalBtnWrap, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
          >
            <LinearGradient colors={[TEAL, TEAL_DEEP]} style={s.modalBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="checkmark" size={17} color="#fff" />
              <UIText style={s.modalBtnText}>{t("pharmacist.disclaimerAck")}</UIText>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PharmacistScreen() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const listRef  = useRef<FlashList<ChatMsg>>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages,       setMessages]       = useState<ChatMsg[]>([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const sendScale = useSharedValue(0.85);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((v) => {
      if (v !== "1") setShowDisclaimer(true);
    });
  }, []);

  const acceptDisclaimer = useCallback(() => {
    AsyncStorage.setItem(DISCLAIMER_KEY, "1").catch(() => {});
    setShowDisclaimer(false);
  }, []);

  useEffect(() => {
    sendScale.value = withSpring(input.trim() ? 1 : 0.85, { damping: 14, stiffness: 200 });
  }, [input, sendScale]);

  const suggestedQuestions = useMemo(() => [
    t("pharmacist.suggested0"),
    t("pharmacist.suggested1"),
    t("pharmacist.suggested2"),
    t("pharmacist.suggested3"),
    t("pharmacist.suggested4"),
  ], [t]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMsg = {
      id:        `u-${Date.now()}`,
      role:      "user",
      content:   trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const history = messages
      .filter((m) => m.id !== "welcome")
      .map(({ role, content }) => ({ role, content }));

    try {
      const { reply } = await railwayApi.pharmacistChat(trimmed, history);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply, timestamp: Date.now() },
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setError(t("pharmacist.errorBody"));
    } finally {
      setLoading(false);
    }
  }, [loading, messages, t]);

  const handleSend      = useCallback(() => sendMessage(input), [input, sendMessage]);
  const handleSuggested = useCallback((q: string) => sendMessage(q), [sendMessage]);

  const displayMessages = useMemo((): ChatMsg[] => {
    if (messages.length > 0) return messages;
    return [{
      id:        "welcome",
      role:      "assistant",
      content:   `${t("pharmacist.welcomeTitle")}\n\n${t("pharmacist.welcomeBody")}`,
      timestamp: 0,
    }];
  }, [messages, t]);

  const renderItem    = useCallback(({ item }: { item: ChatMsg }) => <MessageBubble msg={item} />, []);
  const keyExtractor  = useCallback((item: ChatMsg) => item.id, []);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />
      <DisclaimerModal visible={showDisclaimer} onAccept={acceptDisclaimer} />

      {/* ── Gradient header ─────────────────────────── */}
      <LinearGradient
        colors={[TEAL_DEEP, TEAL]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name={BACK_CHEVRON} size={18} color="rgba(255,255,255,0.9)" />
        </Pressable>

        <View style={s.headerCenter}>
          <AIAvatar size={34} />
          <View>
            <UIText style={s.headerTitle}>{t("pharmacist.title")}</UIText>
            <UIText style={s.headerSub}>{t("pharmacist.subtitle")}</UIText>
          </View>
        </View>

        <View style={s.liveRow}>
          <View style={s.liveDot} />
          <UIText style={s.liveText}>{t("pharmacist.available247")}</UIText>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 70}
      >
        {/* ── Chat list ── */}
        <FlashList
          ref={listRef}
          data={displayMessages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={110}
          contentContainerStyle={s.listContent}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* ── Suggested questions ── */}
        {messages.length === 0 && !loading && (
          <Animated.View entering={FadeIn.delay(350)} style={s.suggestedWrap}>
            <UIText style={s.suggestedLabel}>{t("pharmacist.suggestedTitle")}</UIText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.suggestedRow}
            >
              {suggestedQuestions.map((q, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleSuggested(q)}
                  style={({ pressed }) => [s.chip, pressed && s.chipPressed]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={11} color={TEAL} />
                  <UIText style={s.chipText}>{q}</UIText>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Error bar ── */}
        {error && (
          <Animated.View entering={FadeIn} style={s.errorBar}>
            <Ionicons name="alert-circle-outline" size={14} color={kit.color.danger} />
            <UIText style={s.errorText} numberOfLines={2}>{error}</UIText>
            <Pressable onPress={() => setError(null)} hitSlop={10}>
              <UIText style={s.errorRetry}>{t("pharmacist.errorRetry")}</UIText>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Input area ── */}
        <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder={t("pharmacist.inputPlaceholder")}
              placeholderTextColor={kit.color.inkFaint}
              style={[s.textInput, { textAlign: TEXT_START }]}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!loading}
            />
            <Animated.View style={sendStyle}>
              <Pressable
                onPress={handleSend}
                disabled={!input.trim() || loading}
                accessibilityRole="button"
                accessibilityLabel={t("pharmacist.send")}
              >
                <LinearGradient
                  colors={input.trim() && !loading ? [TEAL, TEAL_DEEP] : [kit.color.line, kit.color.line]}
                  style={s.sendBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="arrow-up" size={20} color="#fff" />
                  }
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
          <UIText style={s.inputFooter}>{t("pharmacist.certifiedInfo")}</UIText>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  flex:   { flex: 1 },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 14,
    paddingBottom:     16,
  },
  backBtn: {
    width:           38, height: 38,
    borderRadius:    19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerCenter: {
    flex:          1,
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontFamily: theme.fonts.black,
    fontSize:   16, lineHeight: 21,
    color:      "#fff",
    includeFontPadding: false,
  },
  headerSub: {
    fontFamily: theme.fonts.regular,
    fontSize:   11, lineHeight: 15,
    color:      "rgba(255,255,255,0.75)",
    includeFontPadding: false,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80" },
  liveText: {
    fontFamily: theme.fonts.bold,
    fontSize:   10, lineHeight: 14,
    color:      "rgba(255,255,255,0.85)",
    includeFontPadding: false,
  },

  // Chat list
  listContent: { padding: 16, paddingBottom: 8 },

  // Welcome card
  welcomeCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    22,
    padding:         22,
    marginBottom:    20,
    alignItems:      "center",
    gap:             14,
    borderWidth:     1,
    borderColor:     `${TEAL}22`,
    ...kit.shadow.raised,
  },
  welcomeTextWrap: { alignItems: "center", gap: 6 },
  welcomeTitle: {
    fontFamily:  theme.fonts.black,
    fontSize:    18, lineHeight: 24,
    color:       kit.color.ink,
    textAlign:   "center",
    includeFontPadding: false,
  },
  welcomeBody: {
    fontFamily:  theme.fonts.regular,
    fontSize:    13, lineHeight: 21,
    color:       kit.color.inkSoft,
    textAlign:   "center",
    maxWidth:    280,
    includeFontPadding: false,
  },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  badge: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             4,
    backgroundColor: TEAL_PALE,
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:     1,
    borderColor:     `${TEAL}33`,
  },
  badgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize:   11, lineHeight: 15,
    color:      TEAL,
    includeFontPadding: false,
  },

  // Bubbles
  bubbleRow:     { flexDirection: "row", marginBottom: 14, gap: 8, alignItems: "flex-end" },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAI:   { justifyContent: "flex-start" },
  bubble: {
    maxWidth:          "78%",
    borderRadius:      18,
    paddingHorizontal: 14,
    paddingVertical:   10,
  },
  bubbleUser: {
    backgroundColor:     TEAL,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor:    kit.color.surface,
    borderBottomLeftRadius: 4,
    borderWidth:        1,
    borderColor:        kit.color.line,
    borderLeftWidth:    3,
    borderLeftColor:    TEAL,
    ...kit.shadow.raised,
  },
  bubbleText:     { fontSize: 14, lineHeight: 22, includeFontPadding: false },
  bubbleTextUser: { fontFamily: theme.fonts.regular, color: "#fff" },
  bubbleTextAI:   { fontFamily: theme.fonts.regular, color: kit.color.ink },

  // Typing
  typingRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 14 },
  typingBubble: {
    flexDirection:      "row",
    alignItems:         "center",
    gap:                5,
    backgroundColor:    kit.color.surface,
    borderRadius:       18,
    borderBottomLeftRadius: 4,
    borderWidth:        1,
    borderColor:        kit.color.line,
    borderLeftWidth:    3,
    borderLeftColor:    TEAL,
    paddingHorizontal:  14,
    paddingVertical:    13,
    ...kit.shadow.raised,
  },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TEAL },

  // Suggested questions
  suggestedWrap: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  suggestedLabel: {
    fontFamily:    theme.fonts.bold,
    fontSize:      10, lineHeight: 14,
    color:         kit.color.inkFaint,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  suggestedRow: { gap: 8, paddingRight: 16 },
  chip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.surface,
    borderWidth:       1.5,
    borderColor:       `${TEAL}40`,
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   7,
    ...kit.shadow.raised,
  },
  chipPressed: { opacity: 0.65 },
  chipText: {
    fontFamily: theme.fonts.semibold,
    fontSize:   12, lineHeight: 17,
    color:      kit.color.ink,
    includeFontPadding: false,
  },

  // Error
  errorBar: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              6,
    marginHorizontal: 16,
    marginBottom:     8,
    padding:          12,
    backgroundColor:  kit.color.dangerTint,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      "rgba(239,68,68,0.2)",
  },
  errorText: {
    fontFamily: theme.fonts.regular,
    fontSize:   12, lineHeight: 17,
    color:      kit.color.danger,
    flex:       1,
    includeFontPadding: false,
  },
  errorRetry: {
    fontFamily: theme.fonts.black,
    fontSize:   12, lineHeight: 17,
    color:      kit.color.danger,
    includeFontPadding: false,
  },

  // Input area
  inputArea: {
    backgroundColor:  kit.color.surface,
    borderTopWidth:   StyleSheet.hairlineWidth,
    borderTopColor:   kit.color.line,
    paddingTop:       10,
    paddingHorizontal: 12,
    shadowColor:      "#000",
    shadowOffset:     { width: 0, height: -3 },
    shadowOpacity:    0.07,
    shadowRadius:     10,
    elevation:        10,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  textInput: {
    flex:              1,
    fontFamily:        theme.fonts.regular,
    fontSize:          14,
    lineHeight:        20,
    color:             kit.color.ink,
    backgroundColor:   BG,
    borderRadius:      22,
    paddingHorizontal: 16,
    paddingVertical:   11,
    maxHeight:         120,
    borderWidth:       1.5,
    borderColor:       `${TEAL}35`,
    includeFontPadding: false,
  },
  sendBtn: {
    width:        46, height: 46,
    borderRadius: 23,
    alignItems:   "center",
    justifyContent: "center",
  },
  inputFooter: {
    fontFamily:  theme.fonts.regular,
    fontSize:    10, lineHeight: 15,
    color:       kit.color.inkFaint,
    textAlign:   "center",
    marginTop:   7,
    marginBottom: 2,
    includeFontPadding: false,
  },

  // Disclaimer modal
  modalOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent:  "flex-end",
  },
  modalCard: {
    backgroundColor:      kit.color.surface,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    28,
    paddingTop:           20,
    alignItems:           "center",
    gap:                  14,
  },
  modalHandle: {
    width:           40, height: 4,
    borderRadius:    2,
    backgroundColor: kit.color.line,
    marginBottom:    6,
  },
  modalIcon: {
    width:        68, height: 68,
    borderRadius: 22,
    alignItems:   "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  modalTitle: {
    fontFamily:  theme.fonts.black,
    fontSize:    22, lineHeight: 28,
    color:       kit.color.ink,
    textAlign:   "center",
    includeFontPadding: false,
  },
  modalSubtitle: {
    fontFamily:  theme.fonts.semibold,
    fontSize:    13, lineHeight: 19,
    color:       TEAL,
    textAlign:   "center",
    includeFontPadding: false,
  },
  modalDivider: {
    width:           "100%",
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.line,
    marginVertical:  2,
  },
  modalBody: {
    fontFamily:  theme.fonts.regular,
    fontSize:    13, lineHeight: 21,
    color:       kit.color.inkSoft,
    textAlign:   "center",
    maxWidth:    320,
    includeFontPadding: false,
  },
  modalBtnWrap: { alignSelf: "stretch", borderRadius: 16, overflow: "hidden", marginTop: 4 },
  modalBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    paddingVertical: 15,
  },
  modalBtnText: {
    fontFamily: theme.fonts.black,
    fontSize:   15, lineHeight: 20,
    color:      "#fff",
    includeFontPadding: false,
  },
});
