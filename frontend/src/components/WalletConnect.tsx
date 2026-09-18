"use client";

import { useTranslation } from "react-i18next";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/chain";

export function WalletConnect() {
  const { t } = useTranslation();
  const { accounts, selected, setSelected, connect, connecting, error } = useWallet();

  if (accounts.length > 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <select
          aria-label={t("wallet.selectAccount")}
          value={selected?.address ?? ""}
          onChange={(event) => {
            const next = accounts.find((a) => a.address === event.target.value) ?? null;
            setSelected(next);
          }}
          className="rounded-md border border-white/20 bg-transparent px-2 py-1"
        >
          {accounts.map((account) => (
            <option key={account.address} value={account.address} className="text-black">
              {account.meta.name ?? truncateAddress(account.address)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {connecting ? t("wallet.connecting") : t("wallet.connect")}
      </button>
      {error && <p className="max-w-64 text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
