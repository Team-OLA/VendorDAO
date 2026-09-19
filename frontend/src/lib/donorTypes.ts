export const DONOR_TYPES = ["Individual", "Foundation", "Corporation", "Government", "Other"] as const;

export type DonorType = (typeof DONOR_TYPES)[number];
