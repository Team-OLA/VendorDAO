"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeRfp } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { Rfp } from "@/lib/types";

/** Loads every RFP the city has posted (chain or demo). */
export function useRfps(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [rfps, setRfps] = useState<Rfp[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.rfps.entries();
			const decoded = entries.map(([key, value]) => {
				const id = (key.args[0] as unknown as { toNumber(): number }).toNumber();
				return decodeRfp(id, value as unknown as Record<string, unknown>);
			});
			decoded.sort((a, b) => b.createdAt - a.createdAt);
			setRfps(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load RFPs.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setRfps([...demo.rfps].sort((a, b) => b.createdAt - a.createdAt));
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.rfps]);

	return { rfps, loading, error, refresh };
}
