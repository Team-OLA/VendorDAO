"use client";

import { useTranslation } from "react-i18next";
import type { ProposalStatus } from "@/lib/types";

const COLORS: Record<ProposalStatus, string> = {
  Proposed: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  Approved: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Rejected: "bg-red-500/15 text-red-300 ring-red-500/30",
  Funded: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Cancelled: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
};

export function StatusBadge({ status }: { status: ProposalStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${COLORS[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
