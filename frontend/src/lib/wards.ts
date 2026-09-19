export const WARDS = [
  "District1",
  "District2",
  "District3",
  "District4",
  "District5",
  "District6",
  "District7",
  "Citywide",
] as const;

export type Ward = (typeof WARDS)[number];
