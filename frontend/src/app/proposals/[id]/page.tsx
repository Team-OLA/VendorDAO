"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useProposal } from "@/hooks/useProposal";
import { useWallet } from "@/hooks/useWallet";
import { StatusBadge } from "@/components/StatusBadge";
import { TranslateButton } from "@/components/TranslateButton";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const proposalId = Number(id);
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { proposal, loading, notFound, refresh } = useProposal(api, proposalId);
  const { accounts, selected, connect } = useWallet();

  const [hasVoted, setHasVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo.enabled) {
      setHasVoted(demo.votedProposalIds.includes(proposalId));
      return;
    }
    if (!api || !selected || Number.isNaN(proposalId)) {
      setHasVoted(false);
      return;
    }
    api.query.vendorDao
      .voteOf(proposalId, selected.address)
      .then((vote) => setHasVoted(!(vote as unknown as { isNone: boolean }).isNone))
      .catch(() => setHasVoted(false));
  }, [api, selected, proposalId, demo.enabled, demo.votedProposalIds]);

  const runAction = async (
    demoAction: () => void,
    buildTx: () => SubmittableExtrinsic<"promise">,
  ) => {
    if (!selected) {
      setError(t("common.connectWalletFirst"));
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (demo.enabled) {
        demoAction();
      } else {
        if (!api) return;
        await signAndSendTx(buildTx(), selected.address, setStatus);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !proposal) {
    return <p className="text-sm text-white/60">{t("common.loading")}</p>;
  }
  if (notFound) {
    return <p className="text-sm text-red-400">{t("proposalDetail.notFound")}</p>;
  }
  if (!proposal) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/proposals" className="text-sm text-indigo-400 hover:text-indigo-300">
        ← {t("proposalDetail.back")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          #{proposal.id} — {proposal.title}
        </h1>
        <StatusBadge status={proposal.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-white/70 sm:grid-cols-3">
        <div>
          <p className="text-white/50">{t("proposalDetail.proposedBy")}</p>
          <p>{truncateAddress(proposal.proposer)}</p>
        </div>
        <div>
          <p className="text-white/50">{t("proposalDetail.vendor")}</p>
          <p>{truncateAddress(proposal.vendor)}</p>
        </div>
        <div>
          <p className="text-white/50">{t("proposals.amountRequested")}</p>
          <p>
            {formatTokenAmount(proposal.amount)} {CHAIN_TOKEN_SYMBOL}
          </p>
        </div>
      </div>

      <p className="text-sm text-white/50">
        {t("proposals.votingEndsAtBlock", { block: proposal.votingEnd })}
      </p>

      <div className="rounded-lg border border-white/10 p-4 text-sm">
        <TranslateButton text={proposal.description} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>👍 {t("proposals.ayes")}: {proposal.ayes}</span>
        <span>👎 {t("proposals.nays")}: {proposal.nays}</span>
      </div>

      {accounts.length === 0 ? (
        <button
          type="button"
          onClick={connect}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {t("wallet.connect")}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3">
            {proposal.status === "Proposed" && (
              <>
                <button
                  type="button"
                  disabled={busy || hasVoted}
                  onClick={() =>
                    runAction(
                      () => demo.vote(proposal.id, true),
                      () => api!.tx.vendorDao.vote(proposal.id, true),
                    )
                  }
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {t("proposalDetail.voteAye")}
                </button>
                <button
                  type="button"
                  disabled={busy || hasVoted}
                  onClick={() =>
                    runAction(
                      () => demo.vote(proposal.id, false),
                      () => api!.tx.vendorDao.vote(proposal.id, false),
                    )
                  }
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {t("proposalDetail.voteNay")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => demo.closeProposal(proposal.id),
                      () => api!.tx.vendorDao.closeProposal(proposal.id),
                    )
                  }
                  className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
                >
                  {t("proposalDetail.closeVoting")}
                </button>
              </>
            )}
            {proposal.status === "Approved" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => demo.disburse(proposal.id),
                    () => api!.tx.vendorDao.disburse(proposal.id),
                  )
                }
                className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
              >
                {t("proposalDetail.retryDisbursement")}
              </button>
            )}
          </div>
          {hasVoted && proposal.status === "Proposed" && (
            <p className="text-xs text-white/50">{t("proposalDetail.alreadyVoted")}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {status && !error && <p className="text-sm text-white/60">{status}</p>}
    </div>
  );
}
