"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { translateText } from "@/lib/translate";

/** Translates arbitrary (user-submitted) chain content on demand via /api/translate. */
export function TranslateButton({ text }: { text: string }) {
  const { t, i18n } = useTranslation();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (translated) {
    return (
      <div className="space-y-1">
        <p className="whitespace-pre-wrap">{translated}</p>
        <button
          type="button"
          onClick={() => setTranslated(null)}
          className="text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
        >
          {t("proposalDetail.showOriginal")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="whitespace-pre-wrap">{text}</p>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            setTranslated(await translateText(text, i18n.language));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Translation failed.");
          } finally {
            setLoading(false);
          }
        }}
        className="text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300 disabled:opacity-60"
      >
        {loading ? t("proposalDetail.translating") : `🌐 ${t("proposalDetail.translate")}`}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
