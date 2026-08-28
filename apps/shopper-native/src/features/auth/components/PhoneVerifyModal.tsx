/**
 * PhoneVerifyModal — SMS OTP verification with in-modal change-number flow.
 *
 * Two sub-modes, switched by user action:
 *
 *   "code"  (default) — 6-digit code input, 15-min expiry, 60-s resend.
 *                       Header shows masked phone + "تغيير الرقم" link.
 *   "edit"            — phone-entry field + "إرسال الرمز" CTA. Reached by
 *                       tapping "تغيير الرقم" in code mode. Submitting a new
 *                       phone calls sendPhoneOtp(newPhone) and returns to
 *                       code mode with timers reset.
 *
 * Caller contract:
 *   - parent supplies the initial phone (already-normalized E.164)
 *   - on verify success → onVerified(verifiedE164) so the caller can sync
 *     local state (e.g., update the checkout form's phone field to the
 *     verified one if the user changed it mid-flow)
 *   - on cancel → onCancel()
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Text, Button, useTheme, sheetMotion, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  maskPhoneForDisplay,
  normalizeEgyptianPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
  type OtpError,
} from "../phoneOtp";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const DIGIT_COUNT = 6;

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function otpErrorMessage(e: unknown, t: TFunction): string {
  const kind = (e as Partial<OtpError>)?.kind;
  switch (kind) {
    case "rate_limit":    return t("phoneVerify.errorRateLimit");
    case "invalid_code":  return t("phoneVerify.errorInvalidCode");
    case "expired":       return t("phoneVerify.errorExpired");
    case "invalid_phone": return t("phoneVerify.errorInvalidPhone");
    case "network":       return t("phoneVerify.errorNetwork");
    default:              return e instanceof Error && e.message ? e.message : t("phoneVerify.errorDefault");
  }
}

type Mode = "code" | "edit";

export interface PhoneVerifyModalProps {
  visible:       boolean;
  /** Phone the OTP was already sent to. Can be empty when entering edit
   *  mode first (caller doesn't pre-send). */
  initialPhone:  string;
  /** Use signInWithOtp instead of updateUser. False = "verify phone on
   *  existing email session" (default). True = "phone-only sign-in". */
  signIn?:       boolean;
  /** Fires after successful verification. Receives the actual phone (E.164)
   *  that was verified — may differ from initialPhone if user changed it
   *  inside the modal. */
  onVerified:    (verifiedPhone: string) => void;
  onCancel:      () => void;
}

export function PhoneVerifyModal({
  visible,
  initialPhone,
  signIn,
  onVerified,
  onCancel,
}: PhoneVerifyModalProps): React.ReactElement {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  // Live phone — starts as initialPhone, mutates when user changes number.
  const [phone, setPhone]           = useState(initialPhone);
  const [mode,  setMode]            = useState<Mode>("code");
  const [code,  setCode]            = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending,  setResending]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Two countdowns: expiry (15m) and resend cooldown (60s).
  const [secondsLeftExpiry, setSecondsLeftExpiry]   = useState(OTP_TTL_SECONDS);
  const [secondsLeftResend, setSecondsLeftResend]   = useState(OTP_RESEND_COOLDOWN_SECONDS);

  // Edit-mode state.
  const [editPhoneInput, setEditPhoneInput] = useState("");
  const [editSending,    setEditSending]    = useState(false);

  const codeInputRef = useRef<TextInput>(null);
  const editInputRef = useRef<TextInput>(null);

  // Reset everything every time the modal opens. Keeps state clean across
  // dismiss/reopen cycles.
  useEffect(() => {
    if (!visible) return;
    setPhone(initialPhone);
    setMode("code");
    setCode("");
    setEditPhoneInput("");
    setError(null);
    setSecondsLeftExpiry(OTP_TTL_SECONDS);
    setSecondsLeftResend(OTP_RESEND_COOLDOWN_SECONDS);
    const t = setTimeout(() => codeInputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [visible, initialPhone]);

  // 1-second tick — only runs in code mode (no need to count down while
  // the user is typing a new phone).
  useEffect(() => {
    if (!visible || mode !== "code") return;
    const id = setInterval(() => {
      setSecondsLeftExpiry((s) => (s > 0 ? s - 1 : 0));
      setSecondsLeftResend((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, mode]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    if (resending || secondsLeftResend > 0 || !phone) return;
    setResending(true);
    setError(null);
    try {
      await sendPhoneOtp(phone, { signIn });
      setSecondsLeftExpiry(OTP_TTL_SECONDS);
      setSecondsLeftResend(OTP_RESEND_COOLDOWN_SECONDS);
      setCode("");
      codeInputRef.current?.focus();
    } catch (e) {
      setError(otpErrorMessage(e, t));
    } finally {
      setResending(false);
    }
  }, [phone, signIn, resending, secondsLeftResend, t]);

  const handleVerify = useCallback(async () => {
    if (submitting || code.length !== DIGIT_COUNT || !phone) return;
    setSubmitting(true);
    setError(null);
    try {
      await verifyPhoneOtp(phone, code, { signIn });
      Keyboard.dismiss();
      onVerified(phone);
    } catch (e) {
      setError(otpErrorMessage(e, t));
      setSubmitting(false);

    }
  }, [code, phone, signIn, submitting, onVerified, t]);
  // Auto-submit when 6 digits land (no extra tap).
  useEffect(() => {
    if (code.length === DIGIT_COUNT && !submitting && mode === "code") {
      void handleVerify();
    }
  }, [code, submitting, mode, handleVerify]);

  const handleEnterEditMode = useCallback(() => {
    setMode("edit");
    setError(null);
    // Prefill with the current phone (stripped to local form for editing).
    const local = phone.replace(/^\+20/, "0");
    setEditPhoneInput(local);
    setTimeout(() => editInputRef.current?.focus(), 100);
  }, [phone]);

  const handleCancelEdit = useCallback(() => {
    // Return to code mode without sending a new OTP. Only allowed when the
    // user has already received an OTP for the original phone (otherwise
    // there's nothing to go back to and we should treat as full cancel).
    if (initialPhone) {
      setMode("code");
      setError(null);
    } else {
      onCancel();
    }
  }, [initialPhone, onCancel]);

  const handleSendNewPhone = useCallback(async () => {
    const trimmed = editPhoneInput.trim();
    const newE164 = normalizeEgyptianPhone(trimmed);
    if (!newE164) {
      setError(t("phoneVerify.invalidPhoneLocal"));
      return;
    }
    setEditSending(true);
    setError(null);
    try {
      await sendPhoneOtp(trimmed, { signIn });
      // Switch to code mode with the new phone + reset timers.
      setPhone(newE164);
      setMode("code");
      setCode("");
      setSecondsLeftExpiry(OTP_TTL_SECONDS);
      setSecondsLeftResend(OTP_RESEND_COOLDOWN_SECONDS);
      setTimeout(() => codeInputRef.current?.focus(), 150);
    } catch (e) {
      setError(otpErrorMessage(e, t));
    } finally {
      setEditSending(false);

    }
  }, [editPhoneInput, signIn, t]);
  // ── Derived ─────────────────────────────────────────────────────────────

  const canSubmitCode = code.length === DIGIT_COUNT && !submitting;
  const canResend     = secondsLeftResend === 0 && !resending && !!phone;
  const expired       = secondsLeftExpiry === 0;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onCancel}>

      <Animated.View entering={sheetMotion.backdropEnter} exiting={sheetMotion.backdropExit} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={[styles.kbContainer, { pointerEvents: "box-none" }]}
          >

          <Animated.View
            entering={sheetMotion.enter}
            exiting={sheetMotion.exit}
            style={styles.sheet}>

            <View style={styles.handle} />

            {mode === "code" ? (
              <CodeStep
                theme={theme}
                styles={styles}
                phone={phone}
                code={code}
                onChangeCode={(v) => { setError(null); setCode(v); }}
                onPressBoxes={() => codeInputRef.current?.focus()}
                inputRef={codeInputRef}
                onChangeNumber={handleEnterEditMode}
                onResend={handleResend}
                onVerify={handleVerify}
                onCancel={onCancel}
                error={error}
                expired={expired}
                secondsLeftExpiry={secondsLeftExpiry}
                secondsLeftResend={secondsLeftResend}
                canSubmit={canSubmitCode}
                canResend={canResend}
                submitting={submitting}
                resending={resending}
              />
            ) : (
              <EditStep
                theme={theme}
                styles={styles}
                value={editPhoneInput}
                onChange={setEditPhoneInput}
                inputRef={editInputRef}
                onSend={handleSendNewPhone}
                onBack={handleCancelEdit}
                sending={editSending}
                error={error}
                canGoBack={!!initialPhone}
              />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ─── Code step ──────────────────────────────────────────────────────────────

interface CodeStepProps {
  theme:              NativeTheme;
  styles:             ReturnType<typeof getStyles>;
  phone:              string;
  code:               string;
  onChangeCode:       (v: string) => void;
  onPressBoxes:       () => void;
  inputRef:           React.RefObject<TextInput | null>;
  onChangeNumber:     () => void;
  onResend:           () => void;
  onVerify:           () => void;
  onCancel:           () => void;
  error:              string | null;
  expired:            boolean;
  secondsLeftExpiry:  number;
  secondsLeftResend:  number;
  canSubmit:          boolean;
  canResend:          boolean;
  submitting:         boolean;
  resending:          boolean;
}

function CodeStep(props: CodeStepProps): React.ReactElement {
  const { t } = useTranslation();
  const {
    theme, styles,
    phone, code, onChangeCode, onPressBoxes, inputRef, onChangeNumber,
    onResend, onVerify, onCancel, error, expired,
    secondsLeftExpiry, secondsLeftResend,
    canSubmit, canResend, submitting, resending,
  } = props;

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconTile}>
          <Ionicons name="phone-portrait-outline" size={22} color={theme.colors.brand.primary} />
        </View>
        <Text variant="sheet-title" align="center">{t("phoneVerify.title")}</Text>
        <Text variant="caption" color="secondary" align="center" style={{ marginTop: 2 }}>
          {t("phoneVerify.subtitle", { phone: maskPhoneForDisplay(phone) })}
        </Text>
        <Pressable
          onPress={onChangeNumber}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("phoneVerify.changeNumberA11y")}
          style={{ marginTop: theme.spacing[1] }}>
          <Text variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>
            {t("phoneVerify.changeNumber")}
          </Text>
        </Pressable>
      </View>

      {/* Hidden input drives the digit boxes */}
      <TextInput
        ref={(node) => { (inputRef as React.MutableRefObject<TextInput | null>).current = node; }}
        value={code}
        onChangeText={(v) => onChangeCode(v.replace(/\D/g, "").slice(0, DIGIT_COUNT))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={DIGIT_COUNT}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel={t("phoneVerify.codeInputA11y")}
      />

      {/* Digit boxes */}
      <Pressable onPress={onPressBoxes} style={styles.boxesRow}>
        {Array.from({ length: DIGIT_COUNT }).map((_, i) => {
          const ch = code[i] ?? "";
          const isCursor = code.length === i;
          return (
            <View
              key={i}
              style={[
                styles.box,
                ch && styles.boxFilled,
                isCursor && styles.boxCursor,
                error && styles.boxError,
              ]}>
              <Text
                variant="screen-title"
                align="center"
                style={{ fontFamily: legacyTheme.fonts.extrabold }}>
                {ch || "·"}
              </Text>
            </View>
          );
        })}
      </Pressable>

      {/* Error */}
      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.status.error} />
          <Text
            variant="caption"
            style={{ flex: 1, color: theme.colors.statusSoft.error.text, textAlign: textAlignStart(isRtl()) }}>
            {error}
          </Text>
        </View>
      )}

      {/* Expiry + Resend */}
      <View style={styles.timerRow}>
        <Text variant="caption" color={expired ? "danger" : "tertiary"}>
          {expired ? t("phoneVerify.expired") : t("phoneVerify.validFor", { time: formatMmSs(secondsLeftExpiry) })}
        </Text>

        <Pressable
          onPress={onResend}
          disabled={!canResend}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResend }}
          accessibilityLabel={t("phoneVerify.resendA11y")}
          style={({ pressed }) => pressed && canResend ? { opacity: 0.6 } : null}>
          <Text
            variant="caption"
            weight="bold"
            style={{
              color: canResend ? theme.colors.brand.primary : theme.colors.text.disabled,
            }}>
            {resending
              ? t("phoneVerify.sending")
              : canResend
                ? t("phoneVerify.resend")
                : t("phoneVerify.resendIn", { time: formatMmSs(secondsLeftResend) })}
          </Text>
        </Pressable>
      </View>

      {/* CTAs */}
      <View style={{ gap: theme.spacing[1], marginTop: theme.spacing[2] }}>
        <Button
          variant="primary"
          full
          loading={submitting}
          disabled={!canSubmit || expired}
          onPress={onVerify}
          label={t("phoneVerify.verify")}
        />
        <Button variant="ghost" full label={t("phoneVerify.cancel")} onPress={onCancel} />
      </View>
    </>
  );
}

// ─── Edit step (change phone number) ────────────────────────────────────────

interface EditStepProps {
  theme:      NativeTheme;
  styles:     ReturnType<typeof getStyles>;
  value:      string;
  onChange:   (v: string) => void;
  inputRef:   React.RefObject<TextInput | null>;
  onSend:     () => void;
  onBack:     () => void;
  sending:    boolean;
  error:      string | null;
  /** Can the user go back to the code step? Only when an OTP was already
   *  sent (i.e., initialPhone was non-empty). Otherwise "back" cancels. */
  canGoBack:  boolean;
}

function EditStep({
  theme, styles,
  value, onChange, inputRef, onSend, onBack, sending, error, canGoBack,
}: EditStepProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.header}>
        <View style={styles.iconTile}>
          <Ionicons name="create-outline" size={22} color={theme.colors.brand.primary} />
        </View>
        <Text variant="sheet-title" align="center">{t("phoneVerify.editTitle")}</Text>
        <Text variant="caption" color="secondary" align="center" style={{ marginTop: 2 }}>
          {t("phoneVerify.editSubtitle")}
        </Text>
      </View>

      <View style={styles.phoneFieldWrap}>
        <Text variant="caption" weight="bold" align="right">{t("phoneVerify.phoneLabel")}</Text>
        <View style={[styles.phoneInputBox, error && styles.phoneInputBoxError]}>
          <TextInput
            ref={(node) => { (inputRef as React.MutableRefObject<TextInput | null>).current = node; }}
            value={value}
            onChangeText={onChange}
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
            placeholderTextColor={theme.colors.text.muted}
            textAlign={textAlignStart(isRtl()) as "left" | "right"}
            maxLength={14}
            style={styles.phoneInput}
            accessibilityLabel={t("phoneVerify.phoneA11y")}
          />
          <Ionicons name="call-outline" size={18} color={theme.colors.text.muted} />
        </View>
        <Text variant="eyebrow" color="tertiary" align="right">
          {t("phoneVerify.phoneHint")}
        </Text>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.status.error} />
          <Text variant="caption" align="right" style={{ flex: 1, color: theme.colors.statusSoft.error.text }}>
            {error}
          </Text>
        </View>
      )}

      <View style={{ gap: theme.spacing[1], marginTop: theme.spacing[2] }}>
        <Button variant="primary" full loading={sending} label={t("phoneVerify.send")} onPress={onSend} />
        <Button variant="ghost" full label={canGoBack ? t("phoneVerify.backToVerify") : t("phoneVerify.cancel")} onPress={onBack} />
      </View>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    scrim: {
      flex:            1,
      backgroundColor: theme.colors.canvas.overlay,
      justifyContent:  "flex-end",
    },
    kbContainer: {
      width: "100%",
    },
    sheet: {
      backgroundColor: theme.colors.canvas.surface,
      borderTopStartRadius:  legacyTheme.layout.bottomSheetRadius,
      borderTopEndRadius: legacyTheme.layout.bottomSheetRadius,
      paddingHorizontal: legacyTheme.layout.pagePaddingH,
      paddingTop:        theme.spacing[1],
      paddingBottom:     14,
      gap:               theme.spacing[2],
      ...theme.shadows[4],
    },
    handle: {
      width:           44,
      height:          4,
      borderRadius:    2,
      backgroundColor: theme.colors.border.strong,
      alignSelf:       "center",
      marginBottom:    6,
    },
    header: {
      alignItems: "center",
      gap:        2,
    },
    iconTile: {
      width:           56,
      height:          56,
      borderRadius:    theme.radii["2xl"],
      backgroundColor: theme.colors.brand.primaryLight,
      alignItems:      "center",
      justifyContent:  "center",
      marginBottom:    theme.spacing[1],
      borderWidth:     1,
      borderColor:     theme.colors.brand.primary + "33",
    },
    hiddenInput: {
      position: "absolute",
      width: 1, height: 1,
      opacity: 0,
    },
    // OTP digit row — LTR-locked: the code is a value, not language content.
    // Reading "1 2 3 4 5 6" left-to-right is the universal OTP convention; an
    // RTL flow would put digit-1 on the right and surprise the user.
    // NOTE: a hardcoded `flexDirection: "row"` is NOT enough — under forceRTL
    // (Arabic) a literal "row" already flows right-to-left (see
    // utils/layout.ts). `flexRow(false)` is this codebase's idiom for
    // "force LTR regardless of language".
    boxesRow: {
      flexDirection:  flexRow(false),
      justifyContent: "center",
      gap:            theme.spacing[1],
      marginTop:      theme.spacing[1],
    },
    box: {
      width:           44,
      height:          56,
      borderRadius:    legacyTheme.radius.md,
      backgroundColor: theme.colors.canvas.surface,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      alignItems:      "center",
      justifyContent:  "center",
    },
    boxFilled: {
      borderColor:     theme.colors.brand.primary,
      backgroundColor: theme.colors.brand.primaryLight,
    },
    // Active cell — brand glow + thicker border for clear focus signal.
    boxCursor: {
      borderColor:     theme.colors.brand.primary,
      borderWidth:     1.5,
      ...theme.brandGlow,
    },
    boxError: {
      borderColor:     theme.colors.status.error,
      backgroundColor: theme.colors.statusSoft.error.bg,
    },
    errorRow: {
      flexDirection: flexRow(isRtl()),
      alignItems:    "center",
      gap:           theme.spacing[1],
      paddingHorizontal: theme.spacing[1],
    },
    timerRow: {
      flexDirection:  flexRow(isRtl()),
      alignItems:     "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing[1],
      marginTop:      theme.spacing[1],
    },
    // Edit step
    phoneFieldWrap: {
      gap: 2,
    },
    phoneInputBox: {
      flexDirection:     flexRow(isRtl()),
      alignItems:        "center",
      gap:               theme.spacing[1],
      paddingHorizontal: theme.spacing[2],
      height:            legacyTheme.layout.inputHeight,
      borderRadius:      legacyTheme.radius.lg,
      backgroundColor:   theme.colors.canvas.surfaceMuted,
      borderWidth:       1,
      borderColor:       theme.colors.border.default,
    },
    phoneInputBoxError: {
      borderColor:     theme.colors.status.error,
      backgroundColor: theme.colors.statusSoft.error.bg,
    },
    phoneInput: {
      flex:           1,
      fontSize:       theme.typography.sizes[16],
      fontFamily:     legacyTheme.fonts.regular,
      color:          theme.colors.text.primary,
      paddingVertical: 0,
    },
  });
}
