"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useRfp } from "@/hooks/useRfp";
import { useProposals } from "@/hooks/useProposals";
import { useWallet } from "@/hooks/useWallet";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { WardBadge } from "@/components/WardBadge";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount } from "@/lib/chain";

export default function RfpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const rfpId = Number(id);
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { rfp, loading, notFound, refresh } = useRfp(api, rfpId);
  const { proposals } = useProposals(api);
  const { selected } = useWallet();

  const isAdmin = !!selected && selected.address === demo.admin.address;
  const responses = proposals.filter((p) => p.rfpId === rfpId);

  const handleClose = async () => {
    if (!selected) return;
    try {
      if (demo.enabled) {
        demo.closeRfp(rfpId);
      } else {
        if (!api) return;
        await signAndSendTx(api.tx.vendorDao.closeRfp(rfpId), selected.address);
      }
      await refresh();
    } catch {
      // Surfacing this error isn't essential here; the RFP status simply won't change.
    }
  };

  if (loading && !rfp) {
    return <p className="text-sm text-gray-500">{t("common.loading")}</p>;
  }
  if (notFound) {
    return <p className="text-sm text-red-600">{t("rfps.notFound")}</p>;
  }
  if (!rfp) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/rfps" className="text-sm text-[#1736F5] hover:text-[#122bc9]">
        ← {t("rfps.back")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          #{rfp.id} — {rfp.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <WardBadge ward={rfp.ward} />
          <Badge variant={rfp.status === "Open" ? "emerald" : "zinc"}>{t(`rfpStatus.${rfp.status}`)}</Badge>
        </div>
      </div>

      <Card className="text-sm">{rfp.description}</Card>

      <p className="text-sm text-gray-600">
        {t("rfps.maxAmount")}: {formatTokenAmount(rfp.maxAmount)} {CHAIN_TOKEN_SYMBOL}
      </p>

      <div className="flex flex-wrap gap-3">
        {rfp.status === "Open" && (
          <LinkButton href={`/proposals/new?rfpId=${rfp.id}`}>{t("rfps.respond")}</LinkButton>
        )}
        {isAdmin && rfp.status === "Open" && (
          <Button type="button" variant="neutral" onClick={handleClose}>
            {t("rfps.close")}
          </Button>
        )}
      </div>

      <div className="space-y-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">{t("rfps.responses")}</h2>
        {responses.length === 0 && <p className="text-sm text-gray-500">{t("rfps.noResponses")}</p>}
        <div className="space-y-2">
          {responses.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  #{proposal.id} — {proposal.title}
                </span>
                <StatusBadge status={proposal.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
