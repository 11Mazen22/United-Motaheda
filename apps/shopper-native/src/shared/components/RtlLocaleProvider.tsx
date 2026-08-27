/**
 * RtlLocaleProvider.tsx — native passthrough.
 *
 * Native's real I18nManager.forceRTL already mirrors layout correctly; the
 * web-only workaround lives in RtlLocaleProvider.web.tsx (see its header
 * comment for why it's needed there).
 */
import React from "react";

export function RtlLocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>;
}
