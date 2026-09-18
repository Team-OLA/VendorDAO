"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { DemoModeToggle } from "./DemoModeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { WalletConnect } from "./WalletConnect";
import { useDemoMode } from "@/lib/demo/DemoModeContext";

export function Navbar() {
  const { t } = useTranslation();
  const demo = useDemoMode();

  return (
    <header className="border-b border-white/10">
      {demo.enabled && (
        <div className="bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-300">
          🎭 {t("demo.banner")}
        </div>
      )}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            🏛️ {t("app.name")}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/80">
            <Link href="/" className="hover:text-white">
              {t("nav.dashboard")}
            </Link>
            <Link href="/proposals" className="hover:text-white">
              {t("nav.proposals")}
            </Link>
            <Link href="/vendors" className="hover:text-white">
              {t("nav.vendors")}
            </Link>
            <Link href="/ledger" className="hover:text-white">
              {t("nav.ledger")}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <DemoModeToggle />
          <LanguageSwitcher />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
