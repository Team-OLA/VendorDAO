import type { VendorCategory } from "./vendorCategories";

export type ProposalStatus = "Proposed" | "Approved" | "Rejected" | "Funded" | "Cancelled";

export interface Proposal {
  id: number;
  proposer: string;
  vendor: string;
  title: string;
  description: string;
  /** Amount requested, in planck (smallest unit), as a decimal string. */
  amount: string;
  status: ProposalStatus;
  ayes: number;
  nays: number;
  createdAt: number;
  votingEnd: number;
}

export interface VendorInfo {
  address: string;
  name: string;
  category: VendorCategory;
  description: string;
  /** Verified email address. */
  contact: string;
  businessAddress: string;
  website: string;
  verified: boolean;
  registeredAt: number;
  /** Lifetime funds received, in planck, as a decimal string. */
  totalReceived: string;
  proposalsFunded: number;
}

export interface TreasuryStats {
  potAddress: string;
  potBalance: string;
  totalReceived: string;
  totalDisbursed: string;
}

export interface VendorUpdate {
  id: number;
  vendor: string;
  content: string;
  proposalId: number | null;
  postedAt: number;
}
