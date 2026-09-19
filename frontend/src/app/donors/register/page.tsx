"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useWallet } from "@/hooks/useWallet";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { DONOR_TYPES, type DonorType } from "@/lib/donorTypes";
import { Button } from "@/components/ui/Button";

export default function RegisterDonorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { accounts, selected, connect } = useWallet();

  const [name, setName] = useState("");
  const [donorType, setDonorType] = useState<DonorType>("Individual");
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

    setSubmitting(true);
    try {
      if (demo.enabled) {
        demo.registerDonor(name, donorType);
      } else {
        if (!api) return;
        const tx = api.tx.vendorDao.registerDonor(name, donorType);
        await signAndSendTx(tx, selected.address, setStatus);
      }
      router.push("/donors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">{t("registerDonor.title")}</h1>

      {accounts.length === 0 && (
        <Button type="button" onClick={connect}>
          {t("wallet.connect")}
        </Button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("registerDonor.nameLabel")}</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={128}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t("registerDonor.typeLabel")}</label>
          <select
            value={donorType}
            onChange={(event) => setDonorType(event.target.value as DonorType)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          >
            {DONOR_TYPES.map((option) => (
              <option key={option} value={option} className="text-black">
                {t(`donorType.${option}`)}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status && !error && <p className="text-sm text-gray-500">{status}</p>}

        <Button type="submit" disabled={submitting || (!demo.enabled && !api)}>
          {submitting ? t("registerDonor.submitting") : t("registerDonor.submit")}
        </Button>
      </form>
    </div>
  );
}
