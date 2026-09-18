"use client";

import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGUAGES } from "@/i18n/config";
import { DemoModeProvider } from "@/lib/demo/DemoModeContext";
import { WalletProvider } from "@/hooks/useWallet";

const LANGUAGE_STORAGE_KEY = "i18nextLng";

/** Applies a previously-stored language preference once mounted on the client (SSR always
 * renders the deterministic default language to avoid a hydration mismatch). */
function useStoredLanguage() {
  const { i18n: instance } = useTranslation();

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const supported = SUPPORTED_LANGUAGES.some((l) => l.code === stored);
    if (stored && supported && stored !== instance.language) {
      instance.changeLanguage(stored);
    }
    // Only ever run once, right after the client mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Keeps <html lang="…" dir="rtl|ltr"> in sync with the active i18n language. */
function DocumentLangSync() {
  const { i18n: instance } = useTranslation();
  useStoredLanguage();

  useEffect(() => {
    const apply = (lng: string) => {
      const entry = SUPPORTED_LANGUAGES.find((l) => l.code === lng);
      document.documentElement.lang = lng;
      document.documentElement.dir = entry && "rtl" in entry && entry.rtl ? "rtl" : "ltr";
    };
    apply(instance.language);
    instance.on("languageChanged", apply);
    return () => {
      instance.off("languageChanged", apply);
    };
  }, [instance]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <DemoModeProvider>
        <WalletProvider>
          <DocumentLangSync />
          {children}
        </WalletProvider>
      </DemoModeProvider>
    </I18nextProvider>
  );
}
