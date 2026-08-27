/**
 * RtlLocaleProvider.web.tsx — makes react-native-web actually render RTL.
 *
 * react-native-web compiles a `direction` CSS property onto EVERY View/Text
 * it renders, sourced from its own internal locale context — not from
 * `document.documentElement.dir`, and not from `I18nManager.isRTL` (which is
 * a hardcoded-false stub on web, see layout.ts). That context defaults to
 * "ltr" and is only ever changed by wrapping the tree in RNW's own
 * LocaleProvider. Without this, every single rendered element carries an
 * explicit `direction: ltr`, which overrides the "rtl" set on <html> for
 * everything React Native renders — i.e. the entire app. This is why
 * setting document.dir alone (i18n/index.ts's applyWebDocumentDirection)
 * fixed browser-native chrome (scrollbars, bare text) but left flex
 * row-direction and logical start/end properties silently stuck in LTR.
 *
 * LocaleProvider isn't part of react-native-web's public export surface
 * (only useLocaleContext is), so this reaches into its internal module path.
 * Native gets a plain passthrough — see RtlLocaleProvider.tsx.
 */
import React from "react";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports, import/no-internal-modules
import { LocaleProvider } from "react-native-web/dist/modules/useLocale";
import { getStoredLanguage } from "@/i18n";

export function RtlLocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const isAr = getStoredLanguage() === "ar";
  return (
    <LocaleProvider direction={isAr ? "rtl" : "ltr"} locale={isAr ? "ar" : "en"}>
      {children}
    </LocaleProvider>
  );
}
