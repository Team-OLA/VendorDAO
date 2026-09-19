import { type VendorCategory } from "./vendorCategories";

/** Fixed, stable color per vendor category — used for map markers/legend/filter chips.
 * Unlike chart colors (assigned by sort-rank), these must stay constant regardless of dataset
 * order. Palette mirrors the hues used in CategoryBreakdownChart for visual consistency. */
export const VENDOR_CATEGORY_COLORS: Record<VendorCategory, string> = {
  Construction: "#6366f1",
  ParksAndRecreation: "#FFC709",
  ArtsAndCulture: "#f59e0b",
  Environmental: "#ef4444",
  Housing: "#06b6d4",
  Infrastructure: "#ec4899",
  Technology: "#84cc16",
  FoodAndAgriculture: "#8b5cf6",
  YouthAndCommunity: "#f97316",
  PublicSafety: "#14b8a6",
  Other: "#a3a3a3",
};
