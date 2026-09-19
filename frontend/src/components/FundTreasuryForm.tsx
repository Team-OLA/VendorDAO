"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiPromise } from "@polkadot/api";
import { useWallet } from "@/hooks/useWallet";
import { CHAIN_TOKEN_SYMBOL, parseTokenAmount } from "@/lib/chain";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { Button } from "./ui/Button";

/** Lets anyone contribute funds to the public, transparent treasury pot. */
export function FundTreasuryForm({
  api,
  onFunded,
}: {
  api: ApiPromise | null;
  onFunded?: () => void;
}) {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { selected, connect, accounts } = useWallet();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
      const planck = parseTokenAmount(amount);
      if (demo.enabled) {
        demo.fundTreasury(planck);
      } else {
        if (!api) return;
        await signAndSendTx(api.tx.vendorDao.fundTreasury(planck.toString()), selected.address);
      }
      setAmount("");
      onFunded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to contribute.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-gray-500">
          {t("dashboard.contribute")} ({CHAIN_TOKEN_SYMBOL})
        </label>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
          inputMode="decimal"
          placeholder="0.0"
          className="mt-1 w-32 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        />
      </div>
      {accounts.length === 0 ? (
        <Button type="button" onClick={connect}>
          {t("wallet.connect")}
        </Button>
      ) : (
        <Button type="submit" disabled={submitting}>
          {submitting ? t("newProposal.submitting") : t("dashboard.contributeSubmit")}
        </Button>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
