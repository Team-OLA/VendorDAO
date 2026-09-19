import type { Ward } from "./wards";

/** Approximate centroid for each Detroit City Council district, used to place map markers for
 * RFPs and funded projects — neither has a street address on-chain, only a ward. These are
 * representative points spread across the city for visualization, not authoritative GIS
 * boundaries. */
const WARD_COORDS: Record<Ward, { lat: number; lng: number }> = {
  District1: { lat: 42.4189, lng: -83.1446 },
  District2: { lat: 42.3903, lng: -83.0857 },
  District3: { lat: 42.4104, lng: -82.9646 },
  District4: { lat: 42.4384, lng: -82.9313 },
  District5: { lat: 42.3378, lng: -82.9945 },
  District6: { lat: 42.3236, lng: -83.0917 },
  District7: { lat: 42.3535, lng: -83.2213 },
  Citywide: { lat: 42.3486, lng: -83.0645 },
};

export function wardCentroid(ward: Ward): { lat: number; lng: number } {
  return WARD_COORDS[ward];
}

/** Deterministically nudges a ward centroid so multiple markers in the same ward don't stack
 * exactly on top of each other. `seed` should be a stable per-item number (e.g. an id) so a given
 * item always lands at the same offset point. */
export function jitteredWardCoord(ward: Ward, seed: number): { lat: number; lng: number } {
  const base = wardCentroid(ward);
  // Golden-angle spread keeps successive seeds from clustering, without needing real randomness.
  const angle = (seed * 137.508) % 360;
  const radius = 0.0035 + ((seed * 0.618) % 1) * 0.004;
  const rad = (angle * Math.PI) / 180;
  return { lat: base.lat + Math.cos(rad) * radius, lng: base.lng + Math.sin(rad) * radius };
}
