"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { demoVendorCoords } from "@/lib/demo/data";
import { VENDOR_CATEGORIES, type VendorCategory } from "@/lib/vendorCategories";
import { VENDOR_CATEGORY_COLORS } from "@/lib/vendorCategoryColors";
import { WARDS, type Ward } from "@/lib/wards";
import { jitteredWardCoord } from "@/lib/wardCoords";
import type { Proposal, Rfp, VendorInfo } from "@/lib/types";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    __vendorMapInit?: () => void;
    gm_authFailure?: () => void;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// Optional: a vector-rendering Map ID (created in the Cloud Console under Map Management).
// Vector maps are the only way the JS API supports a tilted/isometric-style perspective; without
// one, `tilt` below is a no-op on the classic flat roadmap renderer.
const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
let googleMapsLoadPromise: Promise<void> | null = null;

// Detroit's civic colors — blue key corridors and a gold accent — on a clean, minimal light basemap.
// NOTE: this `styles` array only applies to the classic flat renderer; if GOOGLE_MAPS_MAP_ID is
// set, Google's vector renderer takes over and styling must instead be configured in the Cloud
// Console against that Map ID (the JSON styles below are ignored in that mode).
const CIVIC_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f8f9fb" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#374151" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f0f1f4" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#dcebe0" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4b8a63" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e5ea" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#1736F5" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0f2899" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#3355ff" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dcf0" }] },
];

function loadGoogleMapsScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("Google Maps is not configured."));
  if (!googleMapsLoadPromise) {
    googleMapsLoadPromise = new Promise((resolve, reject) => {
      window.__vendorMapInit = () => resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=__vendorMapInit`;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Google Maps JavaScript API."));
      document.head.appendChild(script);
    });
  }
  return googleMapsLoadPromise;
}

const RFP_COLOR = "#FFC709";
const PROJECT_FALLBACK_COLOR = "#1736F5";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vendorIcon(google: any, color: string) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function projectIcon(color: string) {
  return {
    path: "M -6,-6 6,-6 6,6 -6,6 Z",
    scale: 1,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function rfpIcon() {
  return {
    path: "M 0,-9 9,0 0,9 -9,0 Z",
    scale: 1,
    fillColor: RFP_COLOR,
    fillOpacity: 1,
    strokeColor: "#0b1333",
    strokeWeight: 1.5,
  };
}

/** Builds InfoWindow content via safe DOM APIs (never innerHTML) — vendor/proposal/RFP titles are
 * user-supplied on-chain data and must never be interpreted as HTML. */
function buildInfoContent(opts: {
  title: string;
  badges: { label: string; color: string }[];
  href: string;
  linkLabel: string;
}): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "170px";
  root.style.font = "13px Inter, Arial, Helvetica, sans-serif";

  const titleEl = document.createElement("p");
  titleEl.style.margin = "0 0 6px";
  titleEl.style.fontWeight = "600";
  titleEl.style.color = "#0b1333";
  titleEl.textContent = opts.title;
  root.appendChild(titleEl);

  if (opts.badges.length > 0) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexWrap = "wrap";
    row.style.gap = "4px";
    row.style.marginBottom = "6px";
    opts.badges.forEach(({ label, color }) => {
      const chip = document.createElement("span");
      chip.textContent = label;
      chip.style.borderRadius = "9999px";
      chip.style.padding = "1px 8px";
      chip.style.fontSize = "11px";
      chip.style.fontWeight = "600";
      chip.style.color = "#ffffff";
      chip.style.backgroundColor = color;
      row.appendChild(chip);
    });
    root.appendChild(row);
  }

  const link = document.createElement("a");
  link.href = opts.href;
  link.textContent = opts.linkLabel;
  link.style.color = "#1736F5";
  link.style.fontSize = "12px";
  link.style.fontWeight = "600";
  root.appendChild(link);

  return root;
}

interface LayerState {
  vendors: boolean;
  projects: boolean;
  rfps: boolean;
}

/** Renders vendors, funded projects, and open RFPs as filterable pins on a Google Maps view.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (see .env.local.example) — falls back to a plain list
 * of "Open in Google Maps" / detail-page links (no API key required) when unavailable. */
export function VendorMap({
  vendors,
  proposals,
  rfps,
}: {
  vendors: VendorInfo[];
  proposals: Proposal[];
  rfps: Rfp[];
}) {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [layers, setLayers] = useState<LayerState>({ vendors: true, projects: true, rfps: true });
  const [activeCategories, setActiveCategories] = useState<Set<VendorCategory>>(
    () => new Set(VENDOR_CATEGORIES),
  );
  const [activeWards, setActiveWards] = useState<Set<Ward>>(() => new Set(WARDS));

  const vendorsByAddress = useMemo(() => new Map(vendors.map((v) => [v.address, v])), [vendors]);
  const fundedProjects = useMemo(() => proposals.filter((p) => p.status === "Funded"), [proposals]);

  const toggleLayer = (key: keyof LayerState) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleCategory = (category: VendorCategory) =>
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const toggleWard = (ward: Ward) =>
    setActiveWards((prev) => {
      const next = new Set(prev);
      if (next.has(ward)) next.delete(ward);
      else next.add(ward);
      return next;
    });

  // Google's global hook for key/auth/API-not-enabled failures, which happen after the script
  // has already loaded successfully (so they can't be caught by loadGoogleMapsScript() itself).
  useEffect(() => {
    window.gm_authFailure = () => setUnavailable(true);
    return () => {
      delete window.gm_authFailure;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Create the map instance once — filter/data changes below only touch markers, so panning or
  // zooming the user has already done isn't reset every time a filter chip is toggled.
  useEffect(() => {
    if (!ready || !containerRef.current || !window.google?.maps || mapRef.current) return;
    const google = window.google;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: 42.3486, lng: -83.0645 },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      ...(GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID, tilt: 45 } : { styles: CIVIC_MAP_STYLE }),
    });
    infoWindowRef.current = new google.maps.InfoWindow();
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const google = window.google;
    const map = mapRef.current;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    const addMarker = (
      position: { lat: number; lng: number },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon: any,
      title: string,
      onClick: (marker: unknown) => void,
    ) => {
      const marker = new google.maps.Marker({ map, position, title, icon });
      marker.addListener("click", () => onClick(marker));
      markersRef.current.push(marker);
      bounds.extend(position);
      hasPoint = true;
    };

    if (layers.vendors) {
      const geocoder = new google.maps.Geocoder();
      vendors
        .filter((vendor) => activeCategories.has(vendor.category))
        .forEach((vendor) => {
          const color = VENDOR_CATEGORY_COLORS[vendor.category];
          const icon = vendorIcon(google, color);
          const onClick = (marker: unknown) => {
            infoWindowRef.current?.setContent(
              buildInfoContent({
                title: vendor.name,
                badges: [{ label: t(`vendorCategory.${vendor.category}`), color }],
                href: `/vendors/${vendor.address}`,
                linkLabel: t("map.viewVendor"),
              }),
            );
            infoWindowRef.current?.open({ map, anchor: marker });
          };
          const demoCoords = demo.enabled ? demoVendorCoords(vendor.address) : null;
          if (demoCoords) {
            addMarker(demoCoords, icon, vendor.name, onClick);
          } else if (vendor.businessAddress) {
            geocoder.geocode({ address: vendor.businessAddress }, (results: unknown, status: string) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const location = (results as any)?.[0]?.geometry?.location;
              if (status === "OK" && location) {
                const coord = { lat: location.lat(), lng: location.lng() };
                addMarker(coord, icon, vendor.name, onClick);
                map.fitBounds(bounds);
              }
            });
          }
        });
    }

    if (layers.projects) {
      fundedProjects
        .filter((proposal) => activeWards.has(proposal.ward))
        .forEach((proposal) => {
          const vendor = vendorsByAddress.get(proposal.vendor);
          if (vendor && !activeCategories.has(vendor.category)) return;
          const color = vendor ? VENDOR_CATEGORY_COLORS[vendor.category] : PROJECT_FALLBACK_COLOR;
          const coord = jitteredWardCoord(proposal.ward, proposal.id);
          const badges = [{ label: t(`ward.${proposal.ward}`), color: "#1736F5" }];
          if (vendor) badges.push({ label: t(`vendorCategory.${vendor.category}`), color });
          addMarker(coord, projectIcon(color), proposal.title, (marker) => {
            infoWindowRef.current?.setContent(
              buildInfoContent({
                title: proposal.title,
                badges,
                href: `/proposals/${proposal.id}`,
                linkLabel: t("map.viewProject"),
              }),
            );
            infoWindowRef.current?.open({ map, anchor: marker });
          });
        });
    }

    if (layers.rfps) {
      rfps
        .filter((rfp) => activeWards.has(rfp.ward))
        .forEach((rfp) => {
          const coord = jitteredWardCoord(rfp.ward, rfp.id + 1000);
          addMarker(coord, rfpIcon(), rfp.title, (marker) => {
            infoWindowRef.current?.setContent(
              buildInfoContent({
                title: rfp.title,
                badges: [{ label: t(`ward.${rfp.ward}`), color: "#1736F5" }],
                href: `/rfps/${rfp.id}`,
                linkLabel: t("map.viewRfp"),
              }),
            );
            infoWindowRef.current?.open({ map, anchor: marker });
          });
        });
    }

    if (hasPoint) map.fitBounds(bounds);
  }, [
    ready,
    vendors,
    fundedProjects,
    rfps,
    demo.enabled,
    layers,
    activeCategories,
    activeWards,
    vendorsByAddress,
    t,
  ]);

  if (unavailable) {
    return (
      <div className="space-y-4 rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-600">{t("map.unavailable")}</p>
        <div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {t("map.layerVendors")}
          </p>
          <ul className="mt-1 space-y-1">
            {vendors.map((vendor) => (
              <li key={vendor.address} className="text-sm">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${vendor.name}, ${vendor.businessAddress}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1736F5] hover:text-[#122bc9]"
                >
                  {vendor.name} — {vendor.businessAddress}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {t("map.layerProjects")}
          </p>
          <ul className="mt-1 space-y-1">
            {fundedProjects.map((proposal) => (
              <li key={proposal.id} className="text-sm">
                <a href={`/proposals/${proposal.id}`} className="text-[#1736F5] hover:text-[#122bc9]">
                  {proposal.title} — {t(`ward.${proposal.ward}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{t("map.layerRfps")}</p>
          <ul className="mt-1 space-y-1">
            {rfps.map((rfp) => (
              <li key={rfp.id} className="text-sm">
                <a href={`/rfps/${rfp.id}`} className="text-[#1736F5] hover:text-[#122bc9]">
                  {rfp.title} — {t(`ward.${rfp.ward}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={layers.vendors} onChange={() => toggleLayer("vendors")} />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
          {t("map.layerVendors")} ({vendors.length})
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={layers.projects} onChange={() => toggleLayer("projects")} />
          <span className="inline-block h-2.5 w-2.5 bg-gray-400" />
          {t("map.layerProjects")} ({fundedProjects.length})
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={layers.rfps} onChange={() => toggleLayer("rfps")} />
          <span
            className="inline-block h-2.5 w-2.5"
            style={{ backgroundColor: RFP_COLOR, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
          />
          {t("map.layerRfps")} ({rfps.length})
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          {t("map.categoryFilter")}
        </span>
        <button
          type="button"
          onClick={() => setActiveCategories(new Set(VENDOR_CATEGORIES))}
          className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          {t("map.allCategories")}
        </button>
        {VENDOR_CATEGORIES.map((category) => {
          const active = activeCategories.has(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: active ? VENDOR_CATEGORY_COLORS[category] : "#e5e7eb",
                color: active ? "#ffffff" : "#4b5563",
              }}
            >
              {t(`vendorCategory.${category}`)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          {t("map.wardFilter")}
        </span>
        <button
          type="button"
          onClick={() => setActiveWards(new Set(WARDS))}
          className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          {t("map.allWards")}
        </button>
        {WARDS.map((ward) => {
          const active = activeWards.has(ward);
          return (
            <button
              key={ward}
              type="button"
              onClick={() => toggleWard(ward)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-[#1736F5] bg-[#1736F5] text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t(`ward.${ward}`)}
            </button>
          );
        })}
      </div>

      <div ref={containerRef} className="h-[480px] w-full rounded-lg border border-gray-200" />

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="font-semibold tracking-wide uppercase">{t("map.legendTitle")}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> {t("map.legendVendor")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 bg-gray-400" /> {t("map.legendProject")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5"
            style={{ backgroundColor: RFP_COLOR, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
          />
          {t("map.legendRfp")}
        </span>
      </div>
    </div>
  );
}

