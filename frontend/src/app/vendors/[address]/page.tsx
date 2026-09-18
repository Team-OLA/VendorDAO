"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useProposals } from "@/hooks/useProposals";
import { useVendor } from "@/hooks/useVendor";
import { useVendorUpdates } from "@/hooks/useVendorUpdates";
import { useWallet } from "@/hooks/useWallet";
import { TranslateButton } from "@/components/TranslateButton";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

export default function VendorDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { vendor, loading, notFound } = useVendor(api, address);
  const { updates, loading: updatesLoading, refresh: refreshUpdates } = useVendorUpdates(api, address);
  const { proposals } = useProposals(api);
  const { accounts, selected, connect } = useWallet();

  const [content, setContent] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isOwner = !!selected && selected.address === address;
  const ownProposals = proposals.filter((p) => p.vendor === address);

  const handlePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const parsedProposalId = proposalId === "" ? null : Number(proposalId);
      if (demo.enabled) {
        demo.postVendorUpdate(address, content, parsedProposalId);
      } else {
        if (!api) return;
        await signAndSendTx(api.tx.vendorDao.postVendorUpdate(content, parsedProposalId), selected.address);
      }
      setContent("");
      setProposalId("");
      setSuccess(true);
      await refreshUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post update.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !vendor) {
    return <p className="text-sm text-white/60">{t("common.loading")}</p>;
  }
  if (notFound) {
    return <p className="text-sm text-red-400">{t("vendorDetail.notFound")}</p>;
  }
  if (!vendor) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/vendors" className="text-sm text-indigo-400 hover:text-indigo-300">
        ← {t("vendorDetail.back")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{vendor.name}</h1>
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

      <span className="inline-block rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
        {t(`vendorCategory.${vendor.category}`)}
      </span>

      <div className="rounded-lg border border-white/10 p-4 text-sm">
        <TranslateButton text={vendor.description} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-white/70 sm:grid-cols-3">
        <div>
          <p className="text-white/50">{t("vendors.contact")}</p>
          <p className="break-words">{vendor.contact}</p>
        </div>
        <div>
          <p className="text-white/50">{t("registerVendor.businessAddressLabel")}</p>
          <p className="break-words">{vendor.businessAddress}</p>
        </div>
        {vendor.website && (
          <div>
            <p className="text-white/50">{t("registerVendor.websiteLabel")}</p>
            <a
              href={vendor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-indigo-400 hover:text-indigo-300"
            >
              {vendor.website}
            </a>
          </div>
        )}
        <div>
          <p className="text-white/50">{t("vendors.totalReceived")}</p>
          <p>
            {formatTokenAmount(vendor.totalReceived)} {CHAIN_TOKEN_SYMBOL}
          </p>
        </div>
        <div>
          <p className="text-white/50">{t("vendors.proposalsFunded")}</p>
          <p>{vendor.proposalsFunded}</p>
        </div>
        <div>
          <p className="text-white/50">{t("common.address")}</p>
          <p>{truncateAddress(vendor.address, 8)}</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold">{t("vendorDetail.updatesTitle")}</h2>

        {isOwner ? (
          <form onSubmit={handlePost} className="space-y-3 rounded-lg border border-white/10 p-4">
            <div>
              <label className="block text-sm font-medium text-white/80">
                {t("vendorDetail.postUpdate")}
              </label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
                rows={3}
                maxLength={2048}
                placeholder={t("vendorDetail.updatePlaceholder")}
                className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
              />
            </div>
            {ownProposals.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-white/80">
                  {t("vendorDetail.linkProposal")}
                </label>
                <select
                  value={proposalId}
                  onChange={(event) => setProposalId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
                >
                  <option value="" className="bg-zinc-900">
                    {t("vendorDetail.noProposalOption")}
                  </option>
                  {ownProposals.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      #{p.id} — {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-emerald-400">{t("vendorDetail.postSuccess")}</p>}
            <button
              type="submit"
              disabled={busy || !content.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? t("vendorDetail.posting") : t("vendorDetail.post")}
            </button>
          </form>
        ) : accounts.length === 0 ? (
          <button
            type="button"
            onClick={connect}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {t("wallet.connect")}
          </button>
        ) : (
          <p className="text-sm text-white/50">{t("vendorDetail.onlyVendorCanPost")}</p>
        )}

        {updatesLoading && <p className="text-sm text-white/60">{t("common.loading")}</p>}
        {!updatesLoading && updates.length === 0 && (
          <p className="text-sm text-white/60">{t("vendorDetail.noUpdates")}</p>
        )}
        <div className="space-y-3">
          {updates.map((update) => {
            const relatedProposal =
              update.proposalId !== null ? proposals.find((p) => p.id === update.proposalId) : null;
            return (
              <div key={update.id} className="rounded-lg border border-white/10 p-4">
                <div className="text-sm">
                  <TranslateButton text={update.content} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                  <span>{t("vendorDetail.postedAtBlock", { block: update.postedAt })}</span>
                  {relatedProposal && (
                    <Link
                      href={`/proposals/${relatedProposal.id}`}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      {t("vendorDetail.relatedProposal")}: #{relatedProposal.id} — {relatedProposal.title}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
