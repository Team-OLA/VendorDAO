"use client";

import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();

  return (
    <select
      aria-label="Language"
      value={i18n.language}
      onChange={(event) => i18n.changeLanguage(event.target.value)}
      className={`rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-inherit ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code} className="text-black">
          {lang.label}
        </option>
      ))}
    </select>
  );
}
