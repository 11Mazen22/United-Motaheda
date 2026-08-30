export {
  signIn, signUp, signOut, getSession,
  requestPasswordReset, updatePassword, updateProfile, deleteAccount,
  type AuthUser,
} from "./api";
export { AuthProvider, useAuth } from "./context";
export { getAuthError, authErrorToArabic } from "./errorMap";
export {
  sendPhoneOtp,
  verifyPhoneOtp,
  normalizeEgyptianPhone,
  maskPhoneForDisplay,
  OTP_TTL_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_VERIFICATION_ENABLED,
} from "./phoneOtp";
export type { OtpError, SendOtpOptions, VerifyOtpOptions } from "./phoneOtp";
export { PhoneVerifyModal } from "./components/PhoneVerifyModal";
export type { PhoneVerifyModalProps } from "./components/PhoneVerifyModal";
export { LangSwitcher }  from "./components/LangSwitcher";
export { SocialButtons } from "./components/SocialButtons";
export type { SocialProvider } from "./components/SocialButtons";
export { AuthDivider }   from "./components/AuthDivider";
export { TrustBadges }   from "./components/TrustBadges";
