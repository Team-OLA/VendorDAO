"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "./StatusBadge";
import { WardBadge } from "./WardBadge";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";
import type { Proposal } from "@/lib/types";

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation();

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">
          #{proposal.id} — {proposal.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <WardBadge ward={proposal.ward} />
          <StatusBadge status={proposal.status} />
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {t("proposalDetail.vendor")}: {truncateAddress(proposal.vendor)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
        <span>
          {t("proposals.amountRequested")}: {formatTokenAmount(proposal.amount)}{" "}
          {CHAIN_TOKEN_SYMBOL}
        </span>
        <span>
          👍 {t("proposals.ayes")}: {proposal.ayes}
        </span>
        <span>
          👎 {t("proposals.nays")}: {proposal.nays}
        </span>
      </div>
    </Link>
  );
}
