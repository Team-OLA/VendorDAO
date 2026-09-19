"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DemoModeToggle } from "./DemoModeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { WalletConnect } from "./WalletConnect";
import { useDemoMode } from "@/lib/demo/DemoModeContext";

const NAV_ITEMS = [
  { href: "/", key: "nav.dashboard" },
  { href: "/proposals", key: "nav.proposals" },
  { href: "/rfps", key: "nav.rfps" },
  { href: "/vendors", key: "nav.vendors" },
  { href: "/donors", key: "nav.donors" },
  { href: "/map", key: "nav.map" },
  { href: "/stake", key: "nav.stake" },
  { href: "/kyc", key: "nav.kyc" },
  { href: "/ledger", key: "nav.ledger" },
] as const;

export function Navbar() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      {demo.enabled && (
        <div className="bg-[#FFC709] px-4 py-1.5 text-center text-xs font-medium text-[#0b1333]">
          🎭 {t("demo.banner")}
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- static logo, no known intrinsic dimensions */}
            <img src="/logo-icon.png" alt="" className="h-8 w-auto" />
            {/* "VendorDAO" is a fixed brand name, not translated across locales (see app.name). */}
            <span className="font-heading text-lg font-bold tracking-tight">
              <span className="text-[#0b1333]">Vendor</span>
              <span className="text-[#1736F5]">DAO</span>
            </span>
          </Link>
          <nav className="hidden shrink-0 items-center gap-3 text-sm text-gray-600 xl:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[#1736F5]">
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center gap-3 xl:flex">
            <DemoModeToggle />
            <LanguageSwitcher />
            <WalletConnect />
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 text-lg text-gray-600 hover:bg-gray-100 xl:hidden"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {menuOpen && (
          <div className="mt-3 border-t border-gray-200 pt-3 xl:hidden">
            <nav className="flex flex-col gap-1 text-sm text-gray-600">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-2 py-2 hover:bg-gray-100 hover:text-[#1736F5]"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex flex-col items-stretch gap-2 border-t border-gray-200 pt-3">
              <DemoModeToggle className="w-full" />
              <LanguageSwitcher className="w-full" />
              <WalletConnect className="w-full" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

