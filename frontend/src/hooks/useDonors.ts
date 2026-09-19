"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeDonor } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { DonorInfo } from "@/lib/types";

/** Loads the full donor/grants registry from chain storage (or demo data). */
export function useDonors(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [donors, setDonors] = useState<DonorInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.donors.entries();
			const decoded = entries.map(([key, value]) => {
				const address = (key.args[0] as unknown as { toString(): string }).toString();
				return decodeDonor(address, value as unknown as Record<string, unknown>);
			});
			decoded.sort((a, b) => b.registeredAt - a.registeredAt);
			setDonors(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load donors.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setDonors([...demo.donors].sort((a, b) => b.registeredAt - a.registeredAt));
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.donors]);

	return { donors, loading, error, refresh };
}
