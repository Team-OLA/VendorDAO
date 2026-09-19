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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
    return <p className="text-sm text-gray-500">{t("common.loading")}</p>;
  }
  if (notFound) {
    return <p className="text-sm text-red-600">{t("vendorDetail.notFound")}</p>;
  }
  if (!vendor) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/vendors" className="text-sm text-[#1736F5] hover:text-[#122bc9]">
        ← {t("vendorDetail.back")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{vendor.name}</h1>
        <Badge variant={vendor.verified ? "emerald" : "zinc"}>
          {vendor.verified ? t("vendors.verified") : t("vendors.unverified")}
        </Badge>
      </div>

      <Badge variant="indigo">{t(`vendorCategory.${vendor.category}`)}</Badge>

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
        <TranslateButton text={vendor.description} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 sm:grid-cols-3">
        <div>
          <p className="text-gray-500">{t("vendors.contact")}</p>
          <p className="break-words">{vendor.contact}</p>
        </div>
        <div>
          <p className="text-gray-500">{t("registerVendor.businessAddressLabel")}</p>
          <p className="break-words">{vendor.businessAddress}</p>
        </div>
        {vendor.website && (
          <div>
            <p className="text-gray-500">{t("registerVendor.websiteLabel")}</p>
            <a
              href={vendor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-[#1736F5] hover:text-[#122bc9]"
            >
              {vendor.website}
            </a>
          </div>
        )}
        <div>
          <p className="text-gray-500">{t("vendors.totalReceived")}</p>
          <p>
            {formatTokenAmount(vendor.totalReceived)} {CHAIN_TOKEN_SYMBOL}
          </p>
        </div>
        <div>
          <p className="text-gray-500">{t("vendors.proposalsFunded")}</p>
          <p>{vendor.proposalsFunded}</p>
        </div>
        <div>
          <p className="text-gray-500">{t("common.address")}</p>
          <p>{truncateAddress(vendor.address, 8)}</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">{t("vendorDetail.updatesTitle")}</h2>

        {isOwner ? (
          <form onSubmit={handlePost} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("vendorDetail.postUpdate")}
              </label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
                rows={3}
                maxLength={2048}
                placeholder={t("vendorDetail.updatePlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              />
            </div>
            {ownProposals.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("vendorDetail.linkProposal")}
                </label>
                <select
                  value={proposalId}
                  onChange={(event) => setProposalId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="" className="text-black">
                    {t("vendorDetail.noProposalOption")}
                  </option>
                  {ownProposals.map((p) => (
                    <option key={p.id} value={p.id} className="text-black">
                      #{p.id} — {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{t("vendorDetail.postSuccess")}</p>}
            <Button type="submit" disabled={busy || !content.trim()}>
              {busy ? t("vendorDetail.posting") : t("vendorDetail.post")}
            </Button>
          </form>
        ) : accounts.length === 0 ? (
          <Button type="button" onClick={connect}>
            {t("wallet.connect")}
          </Button>
        ) : (
          <p className="text-sm text-gray-500">{t("vendorDetail.onlyVendorCanPost")}</p>
        )}

        {updatesLoading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}
        {!updatesLoading && updates.length === 0 && (
          <p className="text-sm text-gray-500">{t("vendorDetail.noUpdates")}</p>
        )}
        <div className="space-y-3">
          {updates.map((update) => {
            const relatedProposal =
              update.proposalId !== null ? proposals.find((p) => p.id === update.proposalId) : null;
            return (
              <div key={update.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm">
                  <TranslateButton text={update.content} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{t("vendorDetail.postedAtBlock", { block: update.postedAt })}</span>
                  {relatedProposal && (
                    <Link
                      href={`/proposals/${relatedProposal.id}`}
                      className="text-[#1736F5] hover:text-[#122bc9]"
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
