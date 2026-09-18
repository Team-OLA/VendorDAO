export const VENDOR_CATEGORIES = [
  "Construction",
  "ParksAndRecreation",
  "ArtsAndCulture",
  "Environmental",
  "Housing",
  "Infrastructure",
  "Technology",
  "FoodAndAgriculture",
  "YouthAndCommunity",
  "PublicSafety",
  "Other",
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];
