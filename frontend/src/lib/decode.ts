import { hexToString } from "@polkadot/util";
import { pickField } from "./chain";
import type { Proposal, ProposalStatus, VendorInfo, VendorUpdate } from "./types";

export function decodeProposal(id: number, raw: Record<string, unknown>): Proposal {
  const title = pickField<{ toHex(): string }>(raw, "title");
  const description = pickField<{ toHex(): string }>(raw, "description");
  const status = pickField<{ type: ProposalStatus }>(raw, "status");
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
