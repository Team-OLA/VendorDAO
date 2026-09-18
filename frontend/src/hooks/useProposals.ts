"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeProposal } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { Proposal } from "@/lib/types";

/** Loads every VendorDAO proposal from chain storage (or demo data), newest first. */
export function useProposals(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [proposals, setProposals] = useState<Proposal[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.proposals.entries();
			const decoded = entries.map(([key, value]) => {
				const id = (key.args[0] as unknown as { toNumber(): number }).toNumber();
				return decodeProposal(id, value as unknown as Record<string, unknown>);
			});
			decoded.sort((a, b) => b.id - a.id);
			setProposals(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load proposals.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setProposals([...demo.proposals].sort((a, b) => b.id - a.id));
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.proposals]);

	return { proposals, loading, error, refresh };
}
