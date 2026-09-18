"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeVendor } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { VendorInfo } from "@/lib/types";

/** Loads a single VendorDAO vendor profile by address (chain or demo), with a `refresh()` for after actions. */
export function useVendor(api: ApiPromise | null, address: string) {
	const demo = useDemoMode();
	const [vendor, setVendor] = useState<VendorInfo | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notFound, setNotFound] = useState(false);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api || !address) return;
		setLoading(true);
		setError(null);
		try {
			const option = await api.query.vendorDao.vendors(address);
			const opt = option as unknown as { isNone: boolean; unwrap(): Record<string, unknown> };
			if (opt.isNone) {
				setVendor(null);
				setNotFound(true);
			} else {
				setVendor(decodeVendor(address, opt.unwrap()));
				setNotFound(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load vendor.");
		} finally {
			setLoading(false);
		}
	}, [api, address, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			const found = demo.vendors.find((v) => v.address === address) ?? null;
			setVendor(found);
			setNotFound(!found);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.vendors, address]);

	return { vendor, loading, error, notFound, refresh };
}
