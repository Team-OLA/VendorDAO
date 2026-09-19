"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useDonors } from "@/hooks/useDonors";
import { useGrants } from "@/hooks/useGrants";
import { useWallet } from "@/hooks/useWallet";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, parseTokenAmount, truncateAddress } from "@/lib/chain";

export default function DonorsPage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api, error: apiError } = usePolkadotApi();
  const { donors, loading, error, refresh: refreshDonors } = useDonors(api);
  const { grants, loading: grantsLoading, refresh: refreshGrants } = useGrants(api);
  const { selected } = useWallet();

  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantStatus, setGrantStatus] = useState<string | null>(null);

  const isDonor = !!selected && donors.some((d) => d.address === selected.address);

  const handleSubmitGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setGrantError(null);
    setGrantStatus(null);
    try {
      const planck = parseTokenAmount(amount);
      if (demo.enabled) {
        demo.submitGrant(selected.address, planck, purpose);
      } else {
        if (!api) return;
        await signAndSendTx(api.tx.vendorDao.submitGrant(planck, purpose), selected.address, setGrantStatus);
      }
      setAmount("");
      setPurpose("");
      await Promise.all([refreshDonors(), refreshGrants()]);
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Failed to submit grant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("donors.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t("donors.subtitle")}</p>
        </div>
        <LinkButton href="/donors/register">{t("donors.registerNew")}</LinkButton>
      </div>

      {(apiError || error) && <p className="text-sm text-red-600">{apiError ?? error}</p>}
      {loading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {donors.map((donor) => (
          <div key={donor.address} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{donor.name}</h3>
              <Badge variant="indigo">{t(`donorType.${donor.donorType}`)}</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">{truncateAddress(donor.address, 8)}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              <span>
                {t("donors.totalContributed")}: {formatTokenAmount(donor.totalContributed)} {CHAIN_TOKEN_SYMBOL}
              </span>
              <span>
                {t("donors.grantsMade")}: {donor.grantsMade}
              </span>
            </div>
          </div>
        ))}
      </div>
      {!loading && donors.length === 0 && <p className="text-sm text-gray-500">{t("donors.empty")}</p>}

      {isDonor && (
        <form onSubmit={handleSubmitGrant} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{t("donors.submitGrant")}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t("donors.grantAmountLabel")} ({CHAIN_TOKEN_SYMBOL})
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
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("donors.grantPurposeLabel")}</label>
            <textarea
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              required
              rows={3}
              maxLength={2048}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </div>
          {grantError && <p className="text-sm text-red-600">{grantError}</p>}
          {grantStatus && !grantError && <p className="text-sm text-gray-500">{grantStatus}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? t("donors.submittingGrant") : t("donors.submitGrant")}
          </Button>
        </form>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">{t("donors.recentGrants")}</h2>
        {grantsLoading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}
        {!grantsLoading && grants.length === 0 && (
          <p className="text-sm text-gray-500">{t("donors.noGrants")}</p>
        )}
        <div className="space-y-3">
          {grants.map((grant) => {
            const donor = donors.find((d) => d.address === grant.donor);
            return (
              <div key={grant.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{donor?.name ?? truncateAddress(grant.donor)}</span>
                  <span className="text-gray-700">
                    {formatTokenAmount(grant.amount)} {CHAIN_TOKEN_SYMBOL}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{grant.purpose}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
