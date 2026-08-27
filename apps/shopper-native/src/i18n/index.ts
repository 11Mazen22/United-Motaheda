/**
 * Global i18n — Arabic / English with RTL reload.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DevSettings, I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";
import RNRestart from "react-native-restart";
import { appKV } from "@/lib/mmkv";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

export type AppLanguage = "ar" | "en";

export const LANG_STORAGE_KEY = "app_lang_v1";

const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

const stored = appKV.getString(LANG_STORAGE_KEY) as AppLanguage | undefined;
const bootLang: AppLanguage = stored === "en" ? "en" : "ar";

// Capture the REAL native layout direction before we touch it. forceRTL()
// updates this getter's return value immediately (optimistically), even
// though the native view tree it actually needs to affect a reload to
// apply the new direction — so reading isRTL AFTER calling forceRTL always
// appears to match and can never detect a mismatch. We need the pre-call
// value to know whether the native layout engine is really already correct.
const nativeRtlBeforeInit = I18nManager.isRTL;

function applyWebDocumentDirection(lang: AppLanguage): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

if (bootLang === "ar") {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} else {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}
applyWebDocumentDirection(bootLang);

// Android: forceRTL() only takes visual effect on the native layout engine
// after a reload — this includes a device's very first launch of a fresh
// install (native default is LTR until this runs), not just a process kill
// mid-session (e.g. during the Google OAuth browser flow). Compare against
// the PRE-call state so a fresh install correctly triggers the one-time
// reload needed to actually render in the right direction.
if (Platform.OS === "android" && nativeRtlBeforeInit !== (bootLang === "ar")) {
  void reloadApp();
}

// initImmediate: false  — forces synchronous initialisation so i18n.isInitialized
// is TRUE by the time React renders for the first time. All resources are
// bundled (no network backend) so sync init is safe and instantaneous.
// Without this, i18next 23+ defers completion to a microtask, leaving
// isInitialized=false on the first render. react-i18next 17 has useSuspense:true
// by default, which throws a Promise when !ready. With no <Suspense> boundary
// in the tree, React 18 converts that into a hard error that the root
// ErrorBoundary catches — rendering the grey #F4F7FA DefaultFallback screen.
//
// react.useSuspense: false — belt-and-suspenders: even if init somehow ends up
// async (e.g. a future i18next change), useTranslation() will degrade gracefully
// by returning the key instead of throwing, rather than crashing the tree.
const initOptions = {
  resources,
  lng:               bootLang,
  fallbackLng:       "ar",
  supportedLngs:     ["ar", "en"],
  interpolation:     { escapeValue: false },
  compatibilityJSON: "v4",
  initImmediate:     false,
  react: {
    useSuspense: false,
  },
} as const;

void i18n.use(initReactI18next).init(initOptions);

export function initI18n(): void {
  // Side-effect init runs at import; kept for explicit boot calls.
}

// A driver approved for the first time (or any account with a fresh install)
// needs I18nManager.forceRTL()'s change to actually take visual effect on
// Android, which only happens after a real process restart -- forceRTL()
// only flips the flag for the NEXT launch, it never re-lays-out the current
// one. Updates.reloadAsync() was the only mechanism here, but it silently
// no-ops whenever Updates.isEnabled is false (any build not wired to an EAS
// Update channel exactly right) or throws for any other reason -- caught and
// swallowed by the try/catch below, leaving a production APK with no restart
// at all and the app stuck rendering in the wrong direction until the user
// manually force-closes and reopens it. react-native-restart's native
// restart doesn't depend on expo-updates being configured at all, so it's
// the guaranteed fallback whenever the Updates path doesn't come through.
async function reloadApp(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (!__DEV__ && Updates.isEnabled) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    // fall through to the guaranteed native restart below
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  RNRestart.restart();
}

export function getStoredLanguage(): AppLanguage {
  const stored = appKV.getString(LANG_STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  appKV.set(LANG_STORAGE_KEY, lang);
  if (lang === "ar") {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } else {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  }
  applyWebDocumentDirection(lang);
  await i18n.changeLanguage(lang);
  await reloadApp();
}

export default i18n;
