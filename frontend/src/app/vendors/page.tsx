"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useVendors } from "@/hooks/useVendors";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

export default function VendorsPage() {
  const { t } = useTranslation();
  const { api, error: apiError } = usePolkadotApi();
  const { vendors, loading, error } = useVendors(api);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("vendors.title")}</h1>
        <Link
          href="/vendors/register"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {t("vendors.registerNew")}
        </Link>
      </div>

      {(apiError || error) && <p className="text-sm text-red-400">{apiError ?? error}</p>}
      {loading && <p className="text-sm text-white/60">{t("common.loading")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {vendors.map((vendor) => (
          <div key={vendor.address} className="rounded-lg border border-white/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">
                <Link href={`/vendors/${vendor.address}`} className="hover:text-indigo-300">
                  {vendor.name}
                </Link>
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                  vendor.verified
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                    : "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30"
                }`}
              >
                {vendor.verified ? t("vendors.verified") : t("vendors.unverified")}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/60">{truncateAddress(vendor.address, 8)}</p>
            <span className="mt-2 inline-block rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
              {t(`vendorCategory.${vendor.category}`)}
            </span>
            <p className="mt-2 text-sm text-white/70">{vendor.description}</p>
            <p className="mt-1 text-xs text-white/50">{vendor.businessAddress}</p>
            <p className="mt-1 text-xs text-white/50">
              {t("vendors.contact")}: {vendor.contact}
            </p>
            {vendor.website && (
              <p className="mt-1 text-xs">
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {vendor.website}
                </a>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
              <span>
                {t("vendors.totalReceived")}: {formatTokenAmount(vendor.totalReceived)}{" "}
                {CHAIN_TOKEN_SYMBOL}
              </span>
              <span>
                {t("vendors.proposalsFunded")}: {vendor.proposalsFunded}
              </span>
            </div>
            <Link
              href={`/vendors/${vendor.address}`}
              className="mt-3 inline-block text-xs text-indigo-400 hover:text-indigo-300"
            >
              {t("vendorDetail.updatesTitle")} →
            </Link>
          </div>
        ))}
      </div>
      {!loading && vendors.length === 0 && (
        <p className="text-sm text-white/60">{t("vendors.empty")}</p>
      )}
    </div>
  );
}
