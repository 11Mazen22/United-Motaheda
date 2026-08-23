import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { reconcileStoredLanguage, setAppLanguage, type AppLanguage } from "./index";

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // i18n is initialised as a module-level side-effect when "@/i18n" is
  // imported — never call init during render.
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<AppLanguage>(i18n.language === "en" ? "en" : "ar");

  useEffect(() => {
    void reconcileStoredLanguage();
  }, []);

  useEffect(() => {
    const onChange = (lng: string) => setLanguageState(lng === "en" ? "en" : "ar");
    i18n.on("languageChanged", onChange);
    return () => { i18n.off("languageChanged", onChange); };
  }, [i18n]);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    await setAppLanguage(lang);
    setLanguageState(lang);
  }, []);

  const value = useMemo(() => ({ language, setLanguage, isRTL: language === "ar" }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useAppLanguage must be used within LanguageProvider");
  return ctx;
}
