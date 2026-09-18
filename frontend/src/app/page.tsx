"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useTreasury } from "@/hooks/useTreasury";
import { useProposals } from "@/hooks/useProposals";
import { useVendors } from "@/hooks/useVendors";
import { ProposalCard } from "@/components/ProposalCard";
import { FundTreasuryForm } from "@/components/FundTreasuryForm";
import { FundingHistoryChart } from "@/components/FundingHistoryChart";
import { CategoryBreakdownChart } from "@/components/CategoryBreakdownChart";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { buildCategoryBreakdown, buildFundingHistory, buildLedger } from "@/lib/ledger";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, truncateAddress } from "@/lib/chain";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api, error: apiError } = usePolkadotApi();
  const { stats, error: treasuryError, refresh: refreshTreasury } = useTreasury(api);
  const { proposals, error: proposalsError } = useProposals(api);
  const { vendors } = useVendors(api);

  const ledger = buildLedger(proposals, vendors, demo.enabled ? demo.treasuryContributions : []);
  const fundingHistory = buildFundingHistory(ledger);
  const categoryBreakdown = buildCategoryBreakdown(proposals, vendors);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
        <p className="mt-1 max-w-2xl text-white/70">{t("dashboard.subtitle")}</p>
      </div>

      {apiError && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {apiError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("dashboard.treasuryBalance")}
          value={stats ? `${formatTokenAmount(stats.potBalance)} ${CHAIN_TOKEN_SYMBOL}` : "—"}
        />
        <StatCard
          label={t("dashboard.totalReceived")}
          value={stats ? `${formatTokenAmount(stats.totalReceived)} ${CHAIN_TOKEN_SYMBOL}` : "—"}
        />
        <StatCard
          label={t("dashboard.totalDisbursed")}
          value={stats ? `${formatTokenAmount(stats.totalDisbursed)} ${CHAIN_TOKEN_SYMBOL}` : "—"}
        />
      </div>
      {treasuryError && <p className="text-sm text-red-400">{treasuryError}</p>}
      {stats && (
        <p className="text-xs text-white/50">
          {t("dashboard.potAddress")}: {truncateAddress(stats.potAddress, 8)}
        </p>
      )}

      <FundTreasuryForm api={api} onFunded={refreshTreasury} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-4">
          <h2 className="mb-2 text-lg font-medium">{t("dashboard.fundingHistory")}</h2>
          <FundingHistoryChart data={fundingHistory} />
        </div>
        <div className="rounded-lg border border-white/10 p-4">
          <h2 className="mb-2 text-lg font-medium">{t("dashboard.categoryBreakdown")}</h2>
          <CategoryBreakdownChart data={categoryBreakdown} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("dashboard.recentProposals")}</h2>
          <Link href="/proposals" className="text-sm text-indigo-400 hover:text-indigo-300">
            {t("dashboard.viewAll")} →
          </Link>
        </div>
        {proposalsError && <p className="mt-2 text-sm text-red-400">{proposalsError}</p>}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {proposals.slice(0, 4).map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
        {proposals.length === 0 && !proposalsError && (
          <p className="mt-4 text-sm text-white/60">{t("proposals.empty")}</p>
        )}
      </div>
    </div>
  );
}
