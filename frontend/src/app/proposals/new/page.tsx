"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useRfp } from "@/hooks/useRfp";
import { useVendors } from "@/hooks/useVendors";
import { useWallet } from "@/hooks/useWallet";
import { parseTokenAmount, CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { WARDS, type Ward } from "@/lib/wards";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function NewProposalForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId") !== null ? Number(searchParams.get("rfpId")) : null;
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { vendors } = useVendors(api);
  const { rfp } = useRfp(api, rfpId ?? Number.NaN);
  const { accounts, selected, connect } = useWallet();

  const [vendor, setVendor] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [ward, setWard] = useState<Ward>("Citywide");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rfp) setWard(rfp.ward);
  }, [rfp]);

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
        demo.submitProposal(vendor, title, description, planck, ward, rfpId);
      } else {
        if (!api) return;
        const tx = api.tx.vendorDao.submitProposal(vendor, title, description, planck.toString(), ward, rfpId);
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

      {rfp && (
        <Card className="border-indigo-200 bg-indigo-50 text-sm text-indigo-800">
          {t("newProposal.respondingToRfp", { title: rfp.title })}{" "}
          {t("newProposal.rfpMaxAmount", {
            amount: formatTokenAmount(rfp.maxAmount),
            symbol: CHAIN_TOKEN_SYMBOL,
          })}
        </Card>
      )}

      {accounts.length === 0 && (
        <Button type="button" onClick={connect}>
          {t("wallet.connect")}
        </Button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("newProposal.vendorLabel")}
          </label>
          <select
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
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
            <p className="mt-1 text-xs text-gray-500">{t("newProposal.noVendors")}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("newProposal.titleLabel")}
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={128}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("newProposal.descriptionLabel")}
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={5}
            maxLength={4096}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("newProposal.wardLabel")}
          </label>
          <select
            value={ward}
            onChange={(event) => setWard(event.target.value as Ward)}
            disabled={!!rfp}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-60"
          >
            {WARDS.map((option) => (
              <option key={option} value={option} className="text-black">
                {t(`ward.${option}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{t("newProposal.wardHint")}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("newProposal.amountLabel")} ({CHAIN_TOKEN_SYMBOL})
          </label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            inputMode="decimal"
            placeholder="0.0"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status && !error && <p className="text-sm text-gray-500">{status}</p>}

        <Button type="submit" disabled={submitting || (!demo.enabled && !api)}>
          {submitting ? t("newProposal.submitting") : t("newProposal.submit")}
        </Button>
      </form>
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={null}>
      <NewProposalForm />
    </Suspense>
  );
}
