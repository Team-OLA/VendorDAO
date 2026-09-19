import { hexToString } from "@polkadot/util";
import { pickField } from "./chain";
import type {
  DonorInfo,
  Grant,
  KycRecord,
  Proposal,
  ProposalStatus,
  Rfp,
  RfpStatus,
  SpendingReceipt,
  VendorInfo,
  VendorUpdate,
} from "./types";
import type { Ward } from "./wards";
import type { DocumentType } from "./documentTypes";

export function decodeProposal(id: number, raw: Record<string, unknown>): Proposal {
  const title = pickField<{ toHex(): string }>(raw, "title");
  const description = pickField<{ toHex(): string }>(raw, "description");
  const status = pickField<{ type: ProposalStatus }>(raw, "status");
  const ward = pickField<{ type: Ward }>(raw, "ward");
  const rfpId = pickField<{ isSome: boolean; unwrap(): { toNumber(): number } }>(raw, "rfpId", "rfp_id");
  return {
    id,
    proposer: pickField<{ toString(): string }>(raw, "proposer").toString(),
    vendor: pickField<{ toString(): string }>(raw, "vendor").toString(),
    title: hexToString(title.toHex()),
    description: hexToString(description.toHex()),
    amount: pickField<{ toString(): string }>(raw, "amount").toString(),
    status: status.type,
    ayes: pickField<{ toNumber(): number }>(raw, "ayes").toNumber(),
    nays: pickField<{ toNumber(): number }>(raw, "nays").toNumber(),
    createdAt: pickField<{ toNumber(): number }>(raw, "createdAt", "created_at").toNumber(),
    votingEnd: pickField<{ toNumber(): number }>(raw, "votingEnd", "voting_end").toNumber(),
    ward: ward.type,
    rfpId: rfpId.isSome ? rfpId.unwrap().toNumber() : null,
  };
}

export function decodeVendor(address: string, raw: Record<string, unknown>): VendorInfo {
  const name = pickField<{ toHex(): string }>(raw, "name");
  const description = pickField<{ toHex(): string }>(raw, "description");
  const contact = pickField<{ toHex(): string }>(raw, "contact");
  const businessAddress = pickField<{ toHex(): string }>(raw, "businessAddress", "business_address");
  const website = pickField<{ toHex(): string }>(raw, "website");
  const category = pickField<{ type: VendorInfo["category"] }>(raw, "category");
  return {
    address,
    name: hexToString(name.toHex()),
    category: category.type,
    description: hexToString(description.toHex()),
    contact: hexToString(contact.toHex()),
    businessAddress: hexToString(businessAddress.toHex()),
    website: hexToString(website.toHex()),
    verified: pickField<boolean>(raw, "verified"),
    registeredAt: pickField<{ toNumber(): number }>(raw, "registeredAt", "registered_at").toNumber(),
    totalReceived: pickField<{ toString(): string }>(
      raw,
      "totalReceived",
      "total_received",
    ).toString(),
    proposalsFunded: pickField<{ toNumber(): number }>(
      raw,
      "proposalsFunded",
      "proposals_funded",
    ).toNumber(),
  };
}

export function decodeVendorUpdate(id: number, raw: Record<string, unknown>): VendorUpdate {
  const content = pickField<{ toHex(): string }>(raw, "content");
  const proposalId = pickField<{ isSome: boolean; unwrap(): { toNumber(): number } }>(
    raw,
    "proposalId",
    "proposal_id",
  );
  return {
    id,
    vendor: pickField<{ toString(): string }>(raw, "vendor").toString(),
    content: hexToString(content.toHex()),
    proposalId: proposalId.isSome ? proposalId.unwrap().toNumber() : null,
    postedAt: pickField<{ toNumber(): number }>(raw, "postedAt", "posted_at").toNumber(),
  };
}

export function decodeDonor(address: string, raw: Record<string, unknown>): DonorInfo {
  const name = pickField<{ toHex(): string }>(raw, "name");
  const donorType = pickField<{ type: DonorInfo["donorType"] }>(raw, "donorType", "donor_type");
  return {
    address,
    name: hexToString(name.toHex()),
    donorType: donorType.type,
    registeredAt: pickField<{ toNumber(): number }>(raw, "registeredAt", "registered_at").toNumber(),
    totalContributed: pickField<{ toString(): string }>(
      raw,
      "totalContributed",
      "total_contributed",
    ).toString(),
    grantsMade: pickField<{ toNumber(): number }>(raw, "grantsMade", "grants_made").toNumber(),
  };
}

export function decodeGrant(id: number, raw: Record<string, unknown>): Grant {
  const purpose = pickField<{ toHex(): string }>(raw, "purpose");
  return {
    id,
    donor: pickField<{ toString(): string }>(raw, "donor").toString(),
    amount: pickField<{ toString(): string }>(raw, "amount").toString(),
    purpose: hexToString(purpose.toHex()),
    submittedAt: pickField<{ toNumber(): number }>(raw, "submittedAt", "submitted_at").toNumber(),
  };
}

export function decodeSpendingReceipt(proposalId: number, id: number, raw: Record<string, unknown>): SpendingReceipt {
  const category = pickField<{ toHex(): string }>(raw, "category");
  const description = pickField<{ toHex(): string }>(raw, "description");
  const attachmentHash = pickField<{ isSome: boolean; unwrap(): { toHex(): string } }>(
    raw,
    "attachmentHash",
    "attachment_hash",
  );
  return {
    id,
    proposalId,
    vendor: pickField<{ toString(): string }>(raw, "vendor").toString(),
    amount: pickField<{ toString(): string }>(raw, "amount").toString(),
    category: hexToString(category.toHex()),
    description: hexToString(description.toHex()),
    attachmentHash: attachmentHash.isSome ? attachmentHash.unwrap().toHex() : null,
    postedAt: pickField<{ toNumber(): number }>(raw, "postedAt", "posted_at").toNumber(),
  };
}

export function decodeRfp(id: number, raw: Record<string, unknown>): Rfp {
  const title = pickField<{ toHex(): string }>(raw, "title");
  const description = pickField<{ toHex(): string }>(raw, "description");
  const ward = pickField<{ type: Ward }>(raw, "ward");
  const status = pickField<{ type: RfpStatus }>(raw, "status");
  return {
    id,
    title: hexToString(title.toHex()),
    description: hexToString(description.toHex()),
    ward: ward.type,
    maxAmount: pickField<{ toString(): string }>(raw, "maxAmount", "max_amount").toString(),
    status: status.type,
    createdAt: pickField<{ toNumber(): number }>(raw, "createdAt", "created_at").toNumber(),
  };
}

export function decodeKycRecord(raw: Record<string, unknown>): KycRecord {
  const ward = pickField<{ type: Ward }>(raw, "ward");
  const documentType = pickField<{ type: DocumentType }>(raw, "documentType", "document_type");
  const documentHash = pickField<{ toHex(): string }>(raw, "documentHash", "document_hash");
  const status = pickField<{ type: KycRecord["status"] }>(raw, "status");
  const verifiedAt = pickField<{ isSome: boolean; unwrap(): { toNumber(): number } }>(
    raw,
    "verifiedAt",
    "verified_at",
  );
  const expiresAt = pickField<{ isSome: boolean; unwrap(): { toNumber(): number } }>(
    raw,
    "expiresAt",
    "expires_at",
  );
  const rejectionReason = pickField<{ isSome: boolean; unwrap(): { toHex(): string } }>(
    raw,
    "rejectionReason",
    "rejection_reason",
  );
  return {
    ward: ward.type,
    documentType: documentType.type,
    documentHash: documentHash.toHex(),
    status: status.type,
    submittedAt: pickField<{ toNumber(): number }>(raw, "submittedAt", "submitted_at").toNumber(),
    verifiedAt: verifiedAt.isSome ? verifiedAt.unwrap().toNumber() : null,
    expiresAt: expiresAt.isSome ? expiresAt.unwrap().toNumber() : null,
    rejectionReason: rejectionReason.isSome ? hexToString(rejectionReason.unwrap().toHex()) : null,
  };
}
