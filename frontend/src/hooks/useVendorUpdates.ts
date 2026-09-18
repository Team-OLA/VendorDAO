"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeVendorUpdate } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { VendorUpdate } from "@/lib/types";

/** Loads a vendor's public update feed (chain or demo), newest first. */
export function useVendorUpdates(api: ApiPromise | null, address: string) {
	const demo = useDemoMode();
	const [updates, setUpdates] = useState<VendorUpdate[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api || !address) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.vendorUpdates.entries(address);
			const decoded = entries.map(([key, value]) => {
				const id = (key.args[1] as unknown as { toNumber(): number }).toNumber();
				return decodeVendorUpdate(id, value as unknown as Record<string, unknown>);
			});
			decoded.sort((a, b) => b.postedAt - a.postedAt);
			setUpdates(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load vendor updates.");
		} finally {
			setLoading(false);
		}
	}, [api, address, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setUpdates(
				demo.vendorUpdates.filter((u) => u.vendor === address).sort((a, b) => b.postedAt - a.postedAt),
			);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.vendorUpdates, address]);

	return { updates, loading, error, refresh };
}
