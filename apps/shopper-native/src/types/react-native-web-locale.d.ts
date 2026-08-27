/**
 * Type declaration for react-native-web's internal useLocale module.
 *
 * LocaleProvider isn't part of react-native-web's public export surface (see
 * RtlLocaleProvider.web.tsx for why it's needed anyway), so it has no shipped
 * types — the package itself is Flow-typed, not TypeScript.
 */
declare module "react-native-web/dist/modules/useLocale" {
  import type { ReactElement, ReactNode } from "react";

  export interface LocaleProviderProps {
    children: ReactNode;
    direction?: "ltr" | "rtl";
    locale?: string;
  }

  export function LocaleProvider(props: LocaleProviderProps): ReactElement;
}
