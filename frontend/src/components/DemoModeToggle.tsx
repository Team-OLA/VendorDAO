"use client";

import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/lib/demo/DemoModeContext";

export function DemoModeToggle({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const demo = useDemoMode();

  return (
    <button
      type="button"
      onClick={demo.toggle}
      title={t("demo.banner")}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
        demo.enabled ? "bg-[#FFC709] text-[#0b1333] hover:bg-[#e6b408]" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
      } ${className}`}
    >
      {demo.enabled ? `🎭 ${t("demo.toggleOn")}` : t("demo.toggleOff")}
    </button>
  );
}
