import type { VendorCategory } from "./vendorCategories";
import type { DonorType } from "./donorTypes";
import type { Ward } from "./wards";
import type { DocumentType } from "./documentTypes";

export type ProposalStatus =
  | "PendingReview"
  | "Proposed"
  | "Approved"
  | "Rejected"
  | "Funded"
  | "Cancelled"
  | "Vetoed";


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
  /** The neighborhood/district this proposal is scoped to for voting eligibility. */
  ward: Ward;
  /** The RFP this proposal responds to, if any. */
  rfpId: number | null;
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

export interface DonorInfo {
  address: string;
  name: string;
  donorType: DonorType;
  registeredAt: number;
  /** Lifetime total this donor has contributed via submitGrant, in planck, as a decimal string. */
  totalContributed: string;
  grantsMade: number;
}

export interface Grant {
  id: number;
  donor: string;
  /** Amount contributed, in planck, as a decimal string. */
  amount: string;
  purpose: string;
  submittedAt: number;
}

export type RfpStatus = "Open" | "Closed";

export interface Rfp {
  id: number;
  title: string;
  description: string;
  ward: Ward;
  /** Maximum amount any single responding proposal may request, in planck, as a decimal string. */
  maxAmount: string;
  status: RfpStatus;
  createdAt: number;
}

export type KycStatus = "Pending" | "Verified" | "Rejected";

export interface KycRecord {
  ward: Ward;
  documentType: DocumentType;
  /** Hex-encoded SHA-256 hash of the applicant's name/DOB/document number, computed client-side. */
  documentHash: string;
  status: KycStatus;
  submittedAt: number;
  verifiedAt: number | null;
  /** Block at which this verification expires and must be renewed, if approved. */
  expiresAt: number | null;
  rejectionReason: string | null;
}

/** An itemized record of how part of a funded proposal's disbursed funds were spent. */
export interface SpendingReceipt {
  /** Per-proposal receipt index (not globally unique). */
  id: number;
  proposalId: number;
  vendor: string;
  /** Amount this receipt accounts for, in planck, as a decimal string. */
  amount: string;
  /** Short label for the kind of spending (e.g. "Materials", "Labor"). */
  category: string;
  description: string;
  /** Hex-encoded SHA-256 hash of an optional attached photo/scan, computed client-side. */
  attachmentHash: string | null;
  postedAt: number;
}
