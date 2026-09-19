"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useBalance } from "@/hooks/useBalance";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useWallet } from "@/hooks/useWallet";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, parseTokenAmount } from "@/lib/chain";
import { Button } from "@/components/ui/Button";

function StakeStatusBanner() {
  const { t } = useTranslation();
  const params = useSearchParams();
  if (params.get("success")) {
    return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{t("stake.success")}</p>;
  }
  if (params.get("canceled")) {
    return <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{t("stake.canceled")}</p>;
  }
  return null;
}

export default function StakePage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { accounts, selected, connect } = useWallet();
  const { balance, refresh: refreshBalance } = useBalance(api, selected?.address);

  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSimulation, setNeedsSimulation] = useState(false);

  const amountUsd = Number(amount);
  const validAmount = Number.isFinite(amountUsd) && amountUsd >= 1;

  const handleStake = async () => {
    if (!selected || !validAmount) return;
    setBusy(true);
    setError(null);
    setNeedsSimulation(false);
    try {
      if (demo.enabled) {
        demo.stakeTokens(selected.address, parseTokenAmount(amount));
        await refreshBalance();
        return;
      }

      const res = await fetch("/api/stake/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd, address: selected.address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout.");
      if (!data.configured) {
        setNeedsSimulation(true);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start staking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("stake.title")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("stake.subtitle")}</p>
      </div>

      <Suspense fallback={null}>
        <StakeStatusBanner />
      </Suspense>

      {accounts.length === 0 ? (
        <Button type="button" onClick={connect}>
          {t("wallet.connect")}
        </Button>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {t("stake.currentBalance")}: {formatTokenAmount(balance)} {CHAIN_TOKEN_SYMBOL}
          </p>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("stake.amountLabel")}</label>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="10"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              />
              <p className="mt-1 text-xs text-gray-500">{t("stake.rateNote", { amount: amountUsd || 0 })}</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {needsSimulation ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                {t("stake.notConfiguredNotice")}
              </p>
            ) : (
              <Button type="button" disabled={busy || !validAmount} onClick={handleStake}>
                {busy ? t("stake.processing") : t("stake.payWithStripe")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
