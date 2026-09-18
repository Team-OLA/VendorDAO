"use client";

import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/lib/demo/DemoModeContext";

export function DemoModeToggle() {
  const { t } = useTranslation();
  const demo = useDemoMode();

  return (
    <button
      type="button"
      onClick={demo.toggle}
      title={t("demo.banner")}
      className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
        demo.enabled
          ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
          : "bg-white/5 text-white/60 ring-white/15"
      }`}
    >
      {demo.enabled ? `🎭 ${t("demo.toggleOn")}` : t("demo.toggleOff")}
    </button>
  );
}
