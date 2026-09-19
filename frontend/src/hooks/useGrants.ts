"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeGrant } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { Grant } from "@/lib/types";

/** Loads every grant ever submitted to the public grants registry (chain or demo), newest first. */
export function useGrants(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [grants, setGrants] = useState<Grant[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.grants.entries();
			const decoded = entries.map(([key, value]) => {
				const id = (key.args[0] as unknown as { toNumber(): number }).toNumber();
				return decodeGrant(id, value as unknown as Record<string, unknown>);
			});
			decoded.sort((a, b) => b.id - a.id);
			setGrants(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load grants.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setGrants([...demo.grants].sort((a, b) => b.id - a.id));
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.grants]);

	return { grants, loading, error, refresh };
}
