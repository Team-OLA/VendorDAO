"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useVendors } from "@/hooks/useVendors";
import { useWallet } from "@/hooks/useWallet";
import { parseTokenAmount, CHAIN_TOKEN_SYMBOL, truncateAddress } from "@/lib/chain";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";

export default function NewProposalPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { vendors } = useVendors(api);
  const { accounts, selected, connect } = useWallet();

  const [vendor, setVendor] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selected) {
      setError(t("common.connectWalletFirst"));
      return;
    }
    if (!vendor) {
      setError(t("newProposal.selectVendor"));
      return;
    }

    setSubmitting(true);
    try {
      const planck = parseTokenAmount(amount);
      if (demo.enabled) {
        demo.submitProposal(vendor, title, description, planck);
      } else {
        if (!api) return;
        const tx = api.tx.vendorDao.submitProposal(vendor, title, description, planck.toString());
        await signAndSendTx(tx, selected.address, setStatus);
      }
      router.push("/proposals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit proposal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("newProposal.title")}</h1>

      {accounts.length === 0 && (
        <button
          type="button"
          onClick={connect}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {t("wallet.connect")}
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("newProposal.vendorLabel")}
          </label>
          <select
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          >
            <option value="" className="text-black">
              {t("newProposal.selectVendor")}
            </option>
            {vendors.map((v) => (
              <option key={v.address} value={v.address} className="text-black">
                {v.name} ({truncateAddress(v.address)})
              </option>
            ))}
          </select>
          {vendors.length === 0 && (
            <p className="mt-1 text-xs text-white/50">{t("newProposal.noVendors")}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("newProposal.titleLabel")}
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={128}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("newProposal.descriptionLabel")}
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={5}
            maxLength={4096}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("newProposal.amountLabel")} ({CHAIN_TOKEN_SYMBOL})
          </label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            inputMode="decimal"
            placeholder="0.0"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {status && !error && <p className="text-sm text-white/60">{status}</p>}

        <button
          type="submit"
          disabled={submitting || (!demo.enabled && !api)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? t("newProposal.submitting") : t("newProposal.submit")}
        </button>
      </form>
    </div>
  );
}
