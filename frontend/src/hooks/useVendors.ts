"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeVendor } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { VendorInfo } from "@/lib/types";

/** Loads the full VendorDAO vendor registry from chain storage (or demo data). */
export function useVendors(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [vendors, setVendors] = useState<VendorInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.vendors.entries();
			const decoded = entries.map(([key, value]) => {
				const address = (key.args[0] as unknown as { toString(): string }).toString();
				return decodeVendor(address, value as unknown as Record<string, unknown>);
			});
			decoded.sort((a, b) => b.registeredAt - a.registeredAt);
			setVendors(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load vendors.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setVendors([...demo.vendors].sort((a, b) => b.registeredAt - a.registeredAt));
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.vendors]);

	return { vendors, loading, error, refresh };
}
