"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "./StatusBadge";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";
import type { Proposal } from "@/lib/types";

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation();

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="block rounded-lg border border-white/10 p-4 transition hover:border-white/25 hover:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">
          #{proposal.id} — {proposal.title}
        </h3>
        <StatusBadge status={proposal.status} />
      </div>
      <p className="mt-1 text-sm text-white/60">
        {t("proposalDetail.vendor")}: {truncateAddress(proposal.vendor)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
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
