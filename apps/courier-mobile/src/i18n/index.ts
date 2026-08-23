/**
 * Global i18n — Arabic / English with RTL reload.
 *
 * Mirrors apps/shopper-native/src/i18n's boot pattern (same fallback language,
 * same forceRTL-then-reload-on-mismatch strategy) so both apps behave
 * identically for a driver switching languages. The one deliberate
 * difference: shopper-native reads its stored language synchronously via
 * MMKV before the first render; this app has no MMKV dependency, so it boots
 * optimistically on the fallback language and reconciles asynchronously
 * against AsyncStorage, reloading only if the stored choice differs — the
 * app's splash screen (kept visible via `SplashScreen.preventAutoHideAsync`)
 * covers that one-time check.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DevSettings, I18nManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

export type AppLanguage = "ar" | "en";

/** Same key the previous hand-rolled LanguageContext used — no migration needed. */
export const LANGUAGE_STORAGE_KEY = "@pharmacy/courier-language";

const resources = { ar: { translation: ar }, en: { translation: en } };

const bootLang: AppLanguage = "ar";

if (bootLang === "ar") {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} else {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

const initOptions = {
  resources,
  lng: bootLang,
  fallbackLng: "ar",
  supportedLngs: ["ar", "en"],
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
  initImmediate: false,
  react: { useSuspense: false },
} as const;

void i18n.use(initReactI18next).init(initOptions);

async function reloadApp(): Promise<void> {
  try {
    if (!__DEV__ && Updates.isEnabled) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    // fall through
  }
  if (__DEV__ && Platform.OS !== "web") DevSettings.reload();
}

/** Reconciles the optimistic boot language against the persisted choice; reloads only on mismatch. */
export async function reconcileStoredLanguage(): Promise<void> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const lang: AppLanguage = stored === "en" ? "en" : "ar";
  if (lang === bootLang) return;
  await setAppLanguage(lang);
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  const nextIsRtl = lang === "ar";
  const changingDirection = I18nManager.isRTL !== nextIsRtl;
  I18nManager.allowRTL(nextIsRtl);
  I18nManager.forceRTL(nextIsRtl);
  await i18n.changeLanguage(lang);
  if (changingDirection) await reloadApp();
}

export default i18n;
