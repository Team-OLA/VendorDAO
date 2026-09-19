"use client";

import { useTranslation } from "react-i18next";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/chain";
import { Button } from "./ui/Button";

export function WalletConnect({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { accounts, selected, setSelected, connect, connecting, error } = useWallet();

  if (accounts.length > 0) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <select
          aria-label={t("wallet.selectAccount")}
          value={selected?.address ?? ""}
          onChange={(event) => {
            const next = accounts.find((a) => a.address === event.target.value) ?? null;
            setSelected(next);
          }}
          className="w-full max-w-48 min-w-0 truncate rounded-md border border-gray-300 bg-white px-2 py-1"
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
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <Button type="button" onClick={connect} disabled={connecting} className="w-full">
        {connecting ? t("wallet.connecting") : t("wallet.connect")}
      </Button>
      {error && <p className="max-w-64 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
