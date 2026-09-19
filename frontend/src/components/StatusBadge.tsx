"use client";

import { useTranslation } from "react-i18next";
import type { ProposalStatus } from "@/lib/types";
import { Badge, type BadgeVariant } from "./ui/Badge";

const VARIANTS: Record<ProposalStatus, BadgeVariant> = {
  PendingReview: "amber",
  Proposed: "blue",
  Approved: "amber",
  Rejected: "red",
  Funded: "emerald",
  Cancelled: "zinc",
  Vetoed: "red",
};

export function StatusBadge({ status }: { status: ProposalStatus }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANTS[status]}>{t(`status.${status}`)}</Badge>;
}

