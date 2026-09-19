"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useProposal } from "@/hooks/useProposal";
import { useSpendingReceipts } from "@/hooks/useSpendingReceipts";
import { useWallet } from "@/hooks/useWallet";
import { StatusBadge } from "@/components/StatusBadge";
import { WardBadge } from "@/components/WardBadge";
import { TranslateButton } from "@/components/TranslateButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, parseTokenAmount, truncateAddress } from "@/lib/chain";
import { cacheAttachment, getCachedAttachment } from "@/lib/attachmentCache";
import { fileToDataUrl, hashFile } from "@/lib/fileHash";
import { bytesToHex } from "@/lib/kycHash";

const RECEIPT_CATEGORY_SUGGESTIONS = ["Materials", "Labor", "Equipment", "Permits & Inspections", "Professional Services", "Other"];
/** Local preview cache (base64 in localStorage) can't reasonably hold huge files. */
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const proposalId = Number(id);
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { proposal, loading, notFound, refresh } = useProposal(api, proposalId);
  const { receipts, refresh: refreshReceipts } = useSpendingReceipts(api, proposalId);
  const { accounts, selected, connect } = useWallet();

  const [hasVoted, setHasVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptCategory, setReceiptCategory] = useState("");
  const [receiptDescription, setReceiptDescription] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);

  const isAdmin = !!selected && selected.address === demo.admin.address;

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
    return <p className="text-sm text-gray-500">{t("common.loading")}</p>;
  }
  if (notFound) {
    return <p className="text-sm text-red-600">{t("proposalDetail.notFound")}</p>;
  }
  if (!proposal) return null;

  const isVendor = !!selected && selected.address === proposal.vendor;
  const totalReceipted = receipts.reduce((sum, r) => sum + BigInt(r.amount), 0n);
  const disbursedAmount = BigInt(proposal.amount);
  const remaining = disbursedAmount - totalReceipted;
  const receiptedPct = disbursedAmount > 0n ? Number((totalReceipted * 100n) / disbursedAmount) : 0;

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setReceiptError(null);
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setReceiptError(t("proposalDetail.attachmentTooLarge"));
      event.target.value = "";
      return;
    }
    setAttachmentFile(file);
    setAttachmentPreviewUrl(null);
    if (file && file.type.startsWith("image/")) {
      fileToDataUrl(file).then(setAttachmentPreviewUrl).catch(() => {});
    }
  };

  const handlePostReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setReceiptBusy(true);
    setReceiptError(null);
    try {
      const planck = parseTokenAmount(receiptAmount);
      if (planck > remaining) {
        setReceiptError(t("proposalDetail.receiptExceedsRemaining"));
        return;
      }
      let attachmentHash: string | null = null;
      if (attachmentFile) {
        const hashBytes = await hashFile(attachmentFile);
        attachmentHash = bytesToHex(hashBytes);
        const dataUrl = attachmentPreviewUrl ?? (await fileToDataUrl(attachmentFile));
        cacheAttachment(attachmentHash, dataUrl);
      }
      if (demo.enabled) {
        demo.postSpendingReceipt(proposal.id, selected.address, planck, receiptCategory, receiptDescription, attachmentHash);
      } else {
        if (!api) return;
        await signAndSendTx(
          api.tx.vendorDao.postSpendingReceipt(
            proposal.id,
            planck.toString(),
            receiptCategory,
            receiptDescription,
            attachmentHash,
          ),
          selected.address,
        );
      }
      setReceiptAmount("");
      setReceiptCategory("");
      setReceiptDescription("");
      setAttachmentFile(null);
      setAttachmentPreviewUrl(null);
      await refreshReceipts();
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : "Failed to post receipt.");
    } finally {
      setReceiptBusy(false);
    }
  };


  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/proposals" className="text-sm text-[#1736F5] hover:text-[#122bc9]">
        ← {t("proposalDetail.back")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          #{proposal.id} — {proposal.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <WardBadge ward={proposal.ward} />
          <StatusBadge status={proposal.status} />
        </div>
      </div>

      {proposal.rfpId !== null && (
        <p className="text-sm text-gray-500">
          {t("proposalDetail.respondingToRfp")}{" "}
          <Link href={`/rfps/${proposal.rfpId}`} className="text-[#1736F5] hover:text-[#122bc9]">
            #{proposal.rfpId}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 sm:grid-cols-3">
        <div>
          <p className="text-gray-500">{t("proposalDetail.proposedBy")}</p>
          <p>{truncateAddress(proposal.proposer)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t("proposalDetail.vendor")}</p>
          <p>{truncateAddress(proposal.vendor)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t("proposals.amountRequested")}</p>
          <p>
            {formatTokenAmount(proposal.amount)} {CHAIN_TOKEN_SYMBOL}
          </p>
        </div>
      </div>

      {proposal.status === "Proposed" && (
        <p className="text-sm text-gray-500">
          {t("proposals.votingEndsAtBlock", { block: proposal.votingEnd })}
        </p>
      )}

      {proposal.status === "Proposed" && proposal.ward !== "Citywide" && (
        <p className="text-xs text-gray-500">
          {t("proposalDetail.wardRestrictedNotice", { ward: t(`ward.${proposal.ward}`) })}{" "}
          <Link href="/kyc" className="text-[#1736F5] hover:text-[#122bc9]">
            {t("nav.kyc")}
          </Link>
        </p>
      )}

      {proposal.status === "PendingReview" && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">
          {t("proposalDetail.pendingReviewNotice")}
        </Card>
      )}
      {proposal.status === "Vetoed" && (
        <Card className="border-red-200 bg-red-50 text-sm text-red-800">
          {t("proposalDetail.vetoedNotice")}
        </Card>
      )}

      <Card className="text-sm">
        <TranslateButton text={proposal.description} />
      </Card>

      {proposal.status !== "PendingReview" && proposal.status !== "Vetoed" && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>👍 {t("proposals.ayes")}: {proposal.ayes}</span>
          <span>👎 {t("proposals.nays")}: {proposal.nays}</span>
        </div>
      )}

      {accounts.length === 0 ? (
        <Button type="button" onClick={connect}>
          {t("wallet.connect")}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3">
            {proposal.status === "PendingReview" && isAdmin && (
              <>
                <Button
                  type="button"
                  variant="success"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => demo.vetProposal(proposal.id, true),
                      () => api!.tx.vendorDao.vetProposal(proposal.id, true),
                    )
                  }
                >
                  {t("proposalDetail.vetApprove")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => demo.vetProposal(proposal.id, false),
                      () => api!.tx.vendorDao.vetProposal(proposal.id, false),
                    )
                  }
                >
                  {t("proposalDetail.vetVeto")}
                </Button>
              </>
            )}
            {proposal.status === "Proposed" && (
              <>
                <Button
                  type="button"
                  variant="success"
                  disabled={busy || hasVoted}
                  onClick={() =>
                    runAction(
                      () => demo.vote(proposal.id, true),
                      () => api!.tx.vendorDao.vote(proposal.id, true),
                    )
                  }
                >
                  {t("proposalDetail.voteAye")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy || hasVoted}
                  onClick={() =>
                    runAction(
                      () => demo.vote(proposal.id, false),
                      () => api!.tx.vendorDao.vote(proposal.id, false),
                    )
                  }
                >
                  {t("proposalDetail.voteNay")}
                </Button>
                <Button
                  type="button"
                  variant="neutral"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => demo.closeProposal(proposal.id),
                      () => api!.tx.vendorDao.closeProposal(proposal.id),
                    )
                  }
                >
                  {t("proposalDetail.closeVoting")}
                </Button>
              </>
            )}
            {proposal.status === "Approved" && (
              <Button
                type="button"
                variant="neutral"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => demo.disburse(proposal.id),
                    () => api!.tx.vendorDao.disburse(proposal.id),
                  )
                }
              >
                {t("proposalDetail.retryDisbursement")}
              </Button>
            )}
          </div>
          {hasVoted && proposal.status === "Proposed" && (
            <p className="text-xs text-gray-500">{t("proposalDetail.alreadyVoted")}</p>
          )}
        </div>
      )}

      {proposal.status === "Funded" && (
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold">{t("proposalDetail.fundsBreakdown")}</h2>

          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, receiptedPct)}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                {t("proposalDetail.receiptedOfDisbursed", {
                  receipted: formatTokenAmount(totalReceipted.toString()),
                  disbursed: formatTokenAmount(proposal.amount),
                  symbol: CHAIN_TOKEN_SYMBOL,
                })}
              </span>
              <span>{t("proposalDetail.remainingToReceipt", { amount: formatTokenAmount(remaining.toString()), symbol: CHAIN_TOKEN_SYMBOL })}</span>
            </div>
          </div>

          {receipts.length === 0 ? (
            <p className="text-sm text-gray-500">{t("proposalDetail.noReceipts")}</p>
          ) : (
            <div className="space-y-2">
              {receipts.map((receipt) => {
                const cachedAttachment = getCachedAttachment(receipt.attachmentHash);
                return (
                  <div key={receipt.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="indigo">{receipt.category}</Badge>
                        <span className="text-sm text-gray-700">
                          {formatTokenAmount(receipt.amount)} {CHAIN_TOKEN_SYMBOL}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {t("vendorDetail.postedAtBlock", { block: receipt.postedAt })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{receipt.description}</p>
                    {receipt.attachmentHash && (
                      <div className="mt-2">
                        {cachedAttachment ? (
                          <a href={cachedAttachment} target="_blank" rel="noopener noreferrer">
                            {cachedAttachment.startsWith("data:image/") ? (
                              <img
                                src={cachedAttachment}
                                alt={t("proposalDetail.receiptAttachmentAlt")}
                                className="h-20 w-20 rounded-md border border-gray-200 object-cover"
                              />
                            ) : (
                              <span className="text-xs text-[#1736F5] hover:text-[#122bc9]">
                                📄 {t("proposalDetail.viewAttachment")}
                              </span>
                            )}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">
                            📎 {t("proposalDetail.attachmentOnFile", { hash: receipt.attachmentHash.slice(0, 10) })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isVendor && remaining > 0n && (
            <form onSubmit={handlePostReceipt} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold">{t("proposalDetail.postReceipt")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t("proposalDetail.receiptCategoryLabel")}
                  </label>
                  <input
                    value={receiptCategory}
                    onChange={(event) => setReceiptCategory(event.target.value)}
                    required
                    maxLength={64}
                    list="receipt-category-suggestions"
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  />
                  <datalist id="receipt-category-suggestions">
                    {RECEIPT_CATEGORY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t("proposalDetail.receiptAmountLabel")} ({CHAIN_TOKEN_SYMBOL})
                  </label>
                  <input
                    value={receiptAmount}
                    onChange={(event) => setReceiptAmount(event.target.value)}
                    required
                    inputMode="decimal"
                    placeholder="0.0"
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("proposalDetail.receiptDescriptionLabel")}
                </label>
                <textarea
                  value={receiptDescription}
                  onChange={(event) => setReceiptDescription(event.target.value)}
                  required
                  rows={2}
                  maxLength={2048}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("proposalDetail.receiptAttachmentLabel")}
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleAttachmentChange}
                  className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-200"
                />
                <p className="mt-1 text-xs text-gray-400">{t("proposalDetail.attachmentHint")}</p>
                {attachmentFile && (
                  <div className="mt-2 flex items-center gap-2">
                    {attachmentPreviewUrl ? (
                      <img src={attachmentPreviewUrl} alt="" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
                    ) : (
                      <span className="text-xs text-gray-600">📄 {attachmentFile.name}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        setAttachmentPreviewUrl(null);
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      {t("common.close")}
                    </button>
                  </div>
                )}
              </div>
              {receiptError && <p className="text-sm text-red-600">{receiptError}</p>}
              <Button type="submit" disabled={receiptBusy || (!demo.enabled && !api)}>
                {receiptBusy ? t("proposalDetail.postingReceipt") : t("proposalDetail.postReceipt")}
              </Button>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && !error && <p className="text-sm text-gray-500">{status}</p>}
    </div>
  );
}
