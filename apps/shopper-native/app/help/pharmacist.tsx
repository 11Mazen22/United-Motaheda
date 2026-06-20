/**
 * PharmaCare AI — AI pharmacist consultation screen.
 *
 * Architecture:
 *   React Native App → Railway backend (/pharmacist/chat) → OpenRouter → AI
 *
 * The OpenRouter API key NEVER touches the client bundle.
 * All model calls happen server-side in the NestJS PharmacistService.
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
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
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

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingDot = ({ delay }: { delay: number }) => {
  const op = useSharedValue(0.3);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 400 }),
        withTiming(0.3, { duration: 400 }),
      ),
      -1,
      false,
    );
  }, [op]);
  // stagger via a small initial delay
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View
      entering={FadeIn.delay(delay)}
      style={[s.typingDot, style]}
    />
  );
};

const TypingIndicator = () => (
  <View style={s.typingBubble}>
    <TypingDot delay={0}   />
    <TypingDot delay={150} />
    <TypingDot delay={300} />
  </View>
);

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAI]}
    >
      {!isUser && (
        <View style={s.aiAvatar}>
          <Ionicons name="medical" size={14} color={kit.color.onInk} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        <UIText style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAI]}>
          {msg.content}
        </UIText>
      </View>
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <Animated.View entering={FadeInUp.duration(300)} style={[s.modalCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.modalIconWell}>
            <Ionicons name="shield-checkmark" size={32} color={kit.color.accentDeep} />
          </View>
          <UIText style={s.modalTitle}>{t("pharmacist.title")}</UIText>
          <UIText style={s.modalDisclaimer}>{t("pharmacist.disclaimer")}</UIText>
          <Pressable
            style={({ pressed }) => [s.modalBtn, pressed && { opacity: 0.85 }]}
            onPress={onAccept}
            accessibilityRole="button"
          >
            <UIText style={s.modalBtnText}>{t("pharmacist.disclaimerAck")}</UIText>
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

  const [messages,        setMessages]        = useState<ChatMsg[]>([]);
  const [input,           setInput]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [showDisclaimer,  setShowDisclaimer]  = useState(false);

  // Check if disclaimer was already accepted
  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((v) => {
      if (v !== "1") setShowDisclaimer(true);
    });
  }, []);

  const acceptDisclaimer = useCallback(() => {
    AsyncStorage.setItem(DISCLAIMER_KEY, "1").catch(() => {});
    setShowDisclaimer(false);
  }, []);

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

    // Scroll to bottom after user message
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    // Build history for context (exclude welcome message)
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map(({ role, content }) => ({ role, content }));

    try {
      const { reply } = await railwayApi.pharmacistChat(trimmed, history);
      const aiMsg: ChatMsg = {
        id:        `a-${Date.now()}`,
        role:      "assistant",
        content:   reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setError(t("pharmacist.errorBody"));
    } finally {
      setLoading(false);
    }
  }, [loading, messages, t]);

  const handleSend = useCallback(() => sendMessage(input), [input, sendMessage]);

  const handleSuggested = useCallback((q: string) => {
    sendMessage(q);
  }, [sendMessage]);

  // Welcome message — shown when history is empty
  const displayMessages = useMemo((): ChatMsg[] => {
    const welcome: ChatMsg = {
      id:        "welcome",
      role:      "assistant",
      content:   `${t("pharmacist.welcomeTitle")}\n\n${t("pharmacist.welcomeBody")}`,
      timestamp: 0,
    };
    return messages.length === 0 ? [welcome] : messages;
  }, [messages, t]);

  const renderItem = useCallback(({ item }: { item: ChatMsg }) => (
    <MessageBubble msg={item} />
  ), []);

  const keyExtractor = useCallback((item: ChatMsg) => item.id, []);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <DisclaimerModal visible={showDisclaimer} onAccept={acceptDisclaimer} />

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>

        <View style={s.headerCenter}>
          <View style={s.headerBadge}>
            <Ionicons name="medical" size={14} color={kit.color.onInk} />
          </View>
          <View>
            <UIText style={s.headerTitle}>{t("pharmacist.title")}</UIText>
            <UIText style={s.headerSub}>{t("pharmacist.subtitle")}</UIText>
          </View>
        </View>

        <View style={s.liveIndicator}>
          <View style={s.liveDot} />
          <UIText style={s.liveText}>{t("pharmacist.available247")}</UIText>
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        {/* ── Chat list ── */}
        <FlashList
          ref={listRef}
          data={displayMessages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={80}
          contentContainerStyle={s.listContent}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* ── Suggested questions (shown when empty) ── */}
        {messages.length === 0 && !loading && (
          <Animated.View entering={FadeIn.delay(200)} style={s.suggestedWrap}>
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
                  style={({ pressed }) => [s.chip, pressed && { opacity: 0.75 }]}
                >
                  <UIText style={s.chipText}>{q}</UIText>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Error bar ── */}
        {error && (
          <Animated.View entering={FadeIn} style={s.errorBar}>
            <UIText style={s.errorText}>{error}</UIText>
            <Pressable onPress={() => setError(null)} hitSlop={8}>
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
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!loading}
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim() || loading}
              style={({ pressed }) => [
                s.sendBtn,
                (!input.trim() || loading) && s.sendBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("pharmacist.send")}
            >
              {loading
                ? <ActivityIndicator size="small" color={kit.color.onInk} />
                : <Ionicons name="send" size={16} color={kit.color.onInk} />
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: kit.color.canvas },
  flex:    { flex: 1 },

  // Header
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor: kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:  40, height: 40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    flex:          1,
    marginHorizontal: 12,
  },
  headerBadge: {
    width:           36, height: 36,
    borderRadius:    12,
    backgroundColor: kit.color.ink,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerTitle: {
    fontFamily: theme.fonts.black,
    fontSize:   15, lineHeight: 20,
    color:      kit.color.ink,
    includeFontPadding: false,
  },
  headerSub: {
    fontFamily: theme.fonts.regular,
    fontSize:   11, lineHeight: 15,
    color:      kit.color.inkSoft,
    includeFontPadding: false,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },
  liveDot: {
    width:           7, height: 7,
    borderRadius:    4,
    backgroundColor: kit.color.success,
  },
  liveText: {
    fontFamily: theme.fonts.bold,
    fontSize:   10, lineHeight: 14,
    color:      kit.color.success,
    includeFontPadding: false,
  },

  // Chat list
  listContent: { padding: 16, paddingBottom: 8 },

  // Bubbles
  bubbleRow:     { flexDirection: "row", marginBottom: 12, gap: 8 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAI:   { justifyContent: "flex-start" },

  aiAvatar: {
    width:           30, height: 30,
    borderRadius:    10,
    backgroundColor: kit.color.ink,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    alignSelf:       "flex-end",
  },

  bubble: {
    maxWidth:      "80%",
    borderRadius:  16,
    paddingHorizontal: 14,
    paddingVertical:   10,
  },
  bubbleUser: {
    backgroundColor: kit.color.ink,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderBottomLeftRadius: 4,
    ...kit.shadow.raised,
  },
  bubbleText:     { fontSize: 14, lineHeight: 22, includeFontPadding: false },
  bubbleTextUser: { fontFamily: theme.fonts.regular, color: kit.color.onInk },
  bubbleTextAI:   { fontFamily: theme.fonts.regular, color: kit.color.ink },

  // Typing
  typingBubble: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderRadius:    16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical:   12,
    alignSelf:       "flex-start",
    marginLeft:      38,
    marginBottom:    12,
    ...kit.shadow.raised,
  },
  typingDot: {
    width:           8, height: 8,
    borderRadius:    4,
    backgroundColor: kit.color.accentDeep,
  },

  // Suggested
  suggestedWrap: {
    paddingHorizontal: 16,
    paddingBottom:     8,
    gap:               10,
  },
  suggestedLabel: {
    fontFamily: theme.fonts.bold,
    fontSize:   12, lineHeight: 16,
    color:      kit.color.inkSoft,
    includeFontPadding: false,
  },
  suggestedRow: { gap: 8, paddingRight: 16 },
  chip: {
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:   8,
    ...kit.shadow.raised,
  },
  chipText: {
    fontFamily: theme.fonts.semibold,
    fontSize:   12, lineHeight: 17,
    color:      kit.color.ink,
    includeFontPadding: false,
  },

  // Error
  errorBar: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    marginHorizontal:  16,
    marginBottom:      8,
    padding:           12,
    backgroundColor:   kit.color.dangerTint,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       "rgba(179,38,30,0.2)",
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
    marginLeft: 8,
    includeFontPadding: false,
  },

  // Input area
  inputArea: {
    backgroundColor: kit.color.surface,
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  kit.color.line,
    paddingTop:      10,
    paddingHorizontal: 12,
    ...kit.shadow.raised,
  },
  inputRow: {
    flexDirection:   "row",
    alignItems:      "flex-end",
    gap:             8,
  },
  textInput: {
    flex:              1,
    fontFamily:        theme.fonts.regular,
    fontSize:          14,
    lineHeight:        20,
    color:             kit.color.ink,
    backgroundColor:   kit.color.well,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    maxHeight:         120,
    borderWidth:       1,
    borderColor:       kit.color.line,
    includeFontPadding: false,
  },
  sendBtn: {
    width:           44, height: 44,
    borderRadius:    22,
    backgroundColor: kit.color.ink,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  sendBtnDisabled: { backgroundColor: kit.color.line },

  // Disclaimer modal
  modalOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems:      "center",
    justifyContent:  "flex-end",
  },
  modalCard: {
    width:             "100%",
    backgroundColor:   kit.color.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:           28,
    alignItems:        "center",
    gap:               16,
  },
  modalIconWell: {
    width:           72, height: 72,
    borderRadius:    22,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    marginBottom:    4,
  },
  modalTitle: {
    fontFamily:  theme.fonts.black,
    fontSize:    20, lineHeight: 28,
    color:       kit.color.ink,
    textAlign:   "center",
    includeFontPadding: false,
  },
  modalDisclaimer: {
    fontFamily:  theme.fonts.regular,
    fontSize:    13, lineHeight: 21,
    color:       kit.color.inkSoft,
    textAlign:   "center",
    maxWidth:    320,
    includeFontPadding: false,
  },
  modalBtn: {
    backgroundColor:   kit.color.ink,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 32,
    paddingVertical:   14,
    alignSelf:         "stretch",
    alignItems:        "center",
    marginTop:         4,
    ...kit.shadow.raised,
  },
  modalBtnText: {
    fontFamily: theme.fonts.black,
    fontSize:   15, lineHeight: 20,
    color:      kit.color.onInk,
    includeFontPadding: false,
  },
});
