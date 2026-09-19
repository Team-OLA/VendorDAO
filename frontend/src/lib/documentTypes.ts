export const DOCUMENT_TYPES = ["Passport", "DriversLicense", "StateId", "NationalId"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
