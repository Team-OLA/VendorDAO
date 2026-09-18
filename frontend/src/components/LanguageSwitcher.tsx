"use client";

import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      aria-label="Language"
      value={i18n.language}
      onChange={(event) => i18n.changeLanguage(event.target.value)}
      className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm text-inherit"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code} className="text-black">
          {lang.label}
        </option>
      ))}
    </select>
  );
}
