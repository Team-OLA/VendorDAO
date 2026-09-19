"use client";

import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useDonors } from "@/hooks/useDonors";
import { useGrants } from "@/hooks/useGrants";
import { useProposals } from "@/hooks/useProposals";
import { useVendors } from "@/hooks/useVendors";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { WardBadge } from "@/components/WardBadge";
import { CategoryBreakdownChart } from "@/components/CategoryBreakdownChart";
import { WardBreakdownChart } from "@/components/WardBreakdownChart";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import {
  buildCategoryBreakdown,
  buildLedger,
  buildVendorBreakdown,
  buildWardBreakdown,
  type LedgerEntryType,
} from "@/lib/ledger";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

const TYPE_VARIANTS: Record<LedgerEntryType, BadgeVariant> = {
  TreasuryContribution: "indigo",
  VendorRegistered: "blue",
  ProposalSubmitted: "blue",
  ProposalFunded: "emerald",
  ProposalRejected: "red",
  ProposalCancelled: "zinc",
  DonorRegistered: "teal",
  GrantSubmitted: "fuchsia",
  TokensStaked: "amber",
};

export default function LedgerPage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api, error: apiError } = usePolkadotApi();
  const { proposals } = useProposals(api);
  const { vendors } = useVendors(api);
  const { donors } = useDonors(api);
  const { grants } = useGrants(api);

  const ledger = buildLedger(
    proposals,
    vendors,
    demo.enabled ? demo.treasuryContributions : [],
    donors,
    grants,
  );
  const wardBreakdown = buildWardBreakdown(proposals);
  const categoryBreakdown = buildCategoryBreakdown(proposals, vendors);
  const vendorBreakdown = buildVendorBreakdown(proposals, vendors);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ledger.title")}</h1>
        <p className="mt-1 max-w-2xl text-gray-600">{t("ledger.subtitle")}</p>
      </div>

      {apiError && <p className="text-sm text-red-600">{apiError}</p>}

      <div className="space-y-4">
        <h2 className="text-lg font-medium">{t("ledger.spendingBreakdown")}</h2>
        {vendorBreakdown.length === 0 ? (
          <p className="text-sm text-gray-500">{t("ledger.noSpending")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-medium text-gray-700">{t("ledger.byWard")}</h3>
                <WardBreakdownChart data={wardBreakdown} />
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-medium text-gray-700">{t("ledger.byCategory")}</h3>
                <CategoryBreakdownChart data={categoryBreakdown} />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("ledger.topVendors")}</th>
                    <th className="px-3 py-2 font-medium">{t("vendors.category")}</th>
                    <th className="px-3 py-2 font-medium">{t("vendors.proposalsFunded")}</th>
                    <th className="px-3 py-2 font-medium">{t("vendors.totalReceived")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBreakdown.map((v) => (
                    <tr key={v.address} className="border-t border-gray-200">
                      <td className="px-3 py-2">
                        <div>{v.name}</div>
                        <div className="text-xs text-gray-500">{truncateAddress(v.address)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="indigo">{t(`vendorCategory.${v.category}`)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{v.proposalsFunded}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {v.totalFunded.toLocaleString()} {CHAIN_TOKEN_SYMBOL}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">{t("ledger.block")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.type")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.description")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.amount")}</th>
              <th className="px-3 py-2 font-medium">{t("ledger.party")}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry, index) => {
              const proposal = entry.proposalId !== undefined ? proposals.find((p) => p.id === entry.proposalId) : undefined;
              return (
                <tr key={`${entry.block}-${entry.type}-${index}`} className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-500">#{entry.block}</td>
                  <td className="px-3 py-2">
                    <Badge variant={TYPE_VARIANTS[entry.type]}>{t(`ledgerType.${entry.type}`)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{entry.title}</span>
                      {proposal && <WardBadge ward={proposal.ward} />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {entry.amount ? `${formatTokenAmount(entry.amount)} ${CHAIN_TOKEN_SYMBOL}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {entry.address ? truncateAddress(entry.address) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ledger.length === 0 && <p className="text-sm text-gray-500">{t("ledger.empty")}</p>}
    </div>
  );
}

