"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useVendors } from "@/hooks/useVendors";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

export default function VendorsPage() {
  const { t } = useTranslation();
  const { api, error: apiError } = usePolkadotApi();
  const { vendors, loading, error } = useVendors(api);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("vendors.title")}</h1>
        <LinkButton href="/vendors/register">{t("vendors.registerNew")}</LinkButton>
      </div>

      {(apiError || error) && <p className="text-sm text-red-600">{apiError ?? error}</p>}
      {loading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {vendors.map((vendor) => (
          <div key={vendor.address} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">
                <Link href={`/vendors/${vendor.address}`} className="hover:text-[#1736F5]">
                  {vendor.name}
                </Link>
              </h3>
              <Badge variant={vendor.verified ? "emerald" : "zinc"}>
                {vendor.verified ? t("vendors.verified") : t("vendors.unverified")}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">{truncateAddress(vendor.address, 8)}</p>
            <div className="mt-2">
              <Badge variant="indigo">{t(`vendorCategory.${vendor.category}`)}</Badge>
            </div>
            <p className="mt-2 text-sm text-gray-600">{vendor.description}</p>
            <p className="mt-1 text-xs text-gray-500">{vendor.businessAddress}</p>
            <p className="mt-1 text-xs text-gray-500">
              {t("vendors.contact")}: {vendor.contact}
            </p>
            {vendor.website && (
              <p className="mt-1 text-xs">
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1736F5] hover:text-[#122bc9]"
                >
                  {vendor.website}
                </a>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
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
              className="mt-3 inline-block text-xs text-[#1736F5] hover:text-[#122bc9]"
            >
              {t("vendorDetail.updatesTitle")} →
            </Link>
          </div>
        ))}
      </div>
      {!loading && vendors.length === 0 && (
        <p className="text-sm text-gray-500">{t("vendors.empty")}</p>
      )}
    </div>
  );
}
