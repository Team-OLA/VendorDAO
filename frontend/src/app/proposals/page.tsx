"use client";

import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useProposals } from "@/hooks/useProposals";
import { ProposalCard } from "@/components/ProposalCard";
import { LinkButton } from "@/components/ui/Button";

export default function ProposalsPage() {
  const { t } = useTranslation();
  const { api, error: apiError } = usePolkadotApi();
  const { proposals, loading, error } = useProposals(api);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("proposals.title")}</h1>
        <LinkButton href="/proposals/new">{t("proposals.submitNew")}</LinkButton>
      </div>

      {(apiError || error) && <p className="text-sm text-red-600">{apiError ?? error}</p>}
      {loading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
      {!loading && proposals.length === 0 && (
        <p className="text-sm text-gray-500">{t("proposals.empty")}</p>
      )}
    </div>
  );
}
