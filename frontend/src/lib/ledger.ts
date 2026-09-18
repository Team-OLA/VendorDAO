import { CHAIN_DECIMALS, formatTokenAmount } from "./chain";
import type { Proposal, VendorInfo } from "./types";
import type { TreasuryContribution } from "./demo/data";

export type LedgerEntryType =
  | "TreasuryContribution"
  | "VendorRegistered"
  | "ProposalSubmitted"
  | "ProposalFunded"
  | "ProposalRejected"
  | "ProposalCancelled";

export interface LedgerEntry {
  block: number;
  type: LedgerEntryType;
  title: string;
  amount?: string;
  address?: string;
  proposalId?: number;
}

/** Builds a unified, chronological transaction ledger from proposals, vendors, and (if known) contributions. */
export function buildLedger(
  proposals: Proposal[],
  vendors: VendorInfo[],
  treasuryContributions: TreasuryContribution[] = [],
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  for (const v of vendors) {
    entries.push({
      block: v.registeredAt,
      type: "VendorRegistered",
      title: v.name,
      address: v.address,
    });
  }

  for (const p of proposals) {
    entries.push({
      block: p.createdAt,
      type: "ProposalSubmitted",
      title: p.title,
      amount: p.amount,
      address: p.vendor,
      proposalId: p.id,
    });
    if (p.status === "Funded") {
      entries.push({
        block: p.votingEnd,
        type: "ProposalFunded",
        title: p.title,
        amount: p.amount,
        address: p.vendor,
        proposalId: p.id,
      });
    } else if (p.status === "Rejected") {
      entries.push({ block: p.votingEnd, type: "ProposalRejected", title: p.title, proposalId: p.id });
    } else if (p.status === "Cancelled") {
      entries.push({ block: p.votingEnd, type: "ProposalCancelled", title: p.title, proposalId: p.id });
    }
  }

  for (const c of treasuryContributions) {
    entries.push({
      block: c.block,
      type: "TreasuryContribution",
      title: c.source,
      amount: c.amount,
      address: c.from,
    });
  }

  return entries.sort((a, b) => b.block - a.block);
}

export interface FundingHistoryPoint {
  block: number;
  received: number;
  disbursed: number;
}

/** Cumulative received/disbursed totals over "time" (block number), for a funding history chart. */
export function buildFundingHistory(
  ledger: LedgerEntry[],
  decimals = CHAIN_DECIMALS,
): FundingHistoryPoint[] {
  const chronological = [...ledger].sort((a, b) => a.block - b.block);
  let received = 0;
  let disbursed = 0;
  const points: FundingHistoryPoint[] = [{ block: 0, received: 0, disbursed: 0 }];

  for (const entry of chronological) {
    if (entry.type === "TreasuryContribution" && entry.amount) {
      received += Number(formatTokenAmount(entry.amount, decimals));
      points.push({ block: entry.block, received, disbursed });
    } else if (entry.type === "ProposalFunded" && entry.amount) {
      disbursed += Number(formatTokenAmount(entry.amount, decimals));
      points.push({ block: entry.block, received, disbursed });
    }
  }
  return points;
}

export interface CategoryFundingSlice {
  category: string;
  totalFunded: number;
}

/** Total funds disbursed per vendor category, for a category-breakdown chart. */
export function buildCategoryBreakdown(
  proposals: Proposal[],
  vendors: VendorInfo[],
  decimals = CHAIN_DECIMALS,
): CategoryFundingSlice[] {
  const categoryByVendor = new Map(vendors.map((v) => [v.address, v.category]));
  const totals = new Map<string, number>();

  for (const p of proposals) {
    if (p.status !== "Funded") continue;
    const category = categoryByVendor.get(p.vendor) ?? "Other";
    const amount = Number(formatTokenAmount(p.amount, decimals));
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([category, totalFunded]) => ({ category, totalFunded }))
    .sort((a, b) => b.totalFunded - a.totalFunded);
}
