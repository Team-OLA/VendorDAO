"use client";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import hi from "./locales/hi.json";
import zh from "./locales/zh.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
] as const;

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: en },
        es: { common: es },
        fr: { common: fr },
        ar: { common: ar },
        zh: { common: zh },
        hi: { common: hi },
      },
      fallbackLng: "en",
      defaultNS: "common",
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
      // Force a deterministic initial language for both server and client renders (avoids a
      // hydration mismatch from the client picking up a different stored/browser language than
      // the server). `Providers` applies any stored preference client-side right after mount.
      lng: "en",
    });
}

export default i18n;
