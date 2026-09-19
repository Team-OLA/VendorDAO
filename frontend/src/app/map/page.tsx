"use client";

import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useVendors } from "@/hooks/useVendors";
import { useProposals } from "@/hooks/useProposals";
import { useRfps } from "@/hooks/useRfps";
import { VendorMap } from "@/components/VendorMap";

export default function MapPage() {
  const { t } = useTranslation();
  const { api, error: apiError } = usePolkadotApi();
  const { vendors, loading, error } = useVendors(api);
  const { proposals, error: proposalsError } = useProposals(api);
  const { rfps, error: rfpsError } = useRfps(api);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("map.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">{t("map.subtitle")}</p>
      </div>

      {(apiError || error || proposalsError || rfpsError) && (
        <p className="text-sm text-red-600">{apiError ?? error ?? proposalsError ?? rfpsError}</p>
      )}
      {loading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      <VendorMap vendors={vendors} proposals={proposals} rfps={rfps} />
    </div>
  );
}

