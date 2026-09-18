"use client";

import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useProposals } from "@/hooks/useProposals";
import { useVendors } from "@/hooks/useVendors";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { buildLedger, type LedgerEntryType } from "@/lib/ledger";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

const TYPE_COLORS: Record<LedgerEntryType, string> = {
  TreasuryContribution: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  VendorRegistered: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  ProposalSubmitted: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  ProposalFunded: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  ProposalRejected: "bg-red-500/15 text-red-300 ring-red-500/30",
  ProposalCancelled: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
};

export default function LedgerPage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api, error: apiError } = usePolkadotApi();
  const { proposals } = useProposals(api);
  const { vendors } = useVendors(api);

  const ledger = buildLedger(proposals, vendors, demo.enabled ? demo.treasuryContributions : []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ledger.title")}</h1>
        <p className="mt-1 max-w-2xl text-white/70">{t("ledger.subtitle")}</p>
      </div>

      {apiError && <p className="text-sm text-red-400">{apiError}</p>}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-3 py-2 font-medium">{t("ledger.block")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.type")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.description")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.amount")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.party")}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry, index) => (
              <tr key={`${entry.block}-${entry.type}-${index}`} className="border-t border-white/10">
                <td className="px-3 py-2 text-white/60">#{entry.block}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${TYPE_COLORS[entry.type]}`}
                  >
                    {t(`ledgerType.${entry.type}`)}
                  </span>
                </td>
                <td className="px-3 py-2">{entry.title}</td>
                <td className="px-3 py-2 text-white/80">
                  {entry.amount ? `${formatTokenAmount(entry.amount)} ${CHAIN_TOKEN_SYMBOL}` : "—"}
                </td>
                <td className="px-3 py-2 text-white/50">
                  {entry.address ? truncateAddress(entry.address) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ledger.length === 0 && <p className="text-sm text-white/60">{t("ledger.empty")}</p>}
    </div>
  );
}
