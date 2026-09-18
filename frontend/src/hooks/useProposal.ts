"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeProposal } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { Proposal } from "@/lib/types";

/** Loads a single VendorDAO proposal by id (chain or demo), with a `refresh()` for after actions. */
export function useProposal(api: ApiPromise | null, id: number) {
	const demo = useDemoMode();
	const [proposal, setProposal] = useState<Proposal | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notFound, setNotFound] = useState(false);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api || Number.isNaN(id)) return;
		setLoading(true);
		setError(null);
		try {
			const option = await api.query.vendorDao.proposals(id);
			const opt = option as unknown as { isNone: boolean; unwrap(): Record<string, unknown> };
			if (opt.isNone) {
				setProposal(null);
				setNotFound(true);
			} else {
				setProposal(decodeProposal(id, opt.unwrap()));
				setNotFound(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load proposal.");
		} finally {
			setLoading(false);
		}
	}, [api, id, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			const found = demo.proposals.find((p) => p.id === id) ?? null;
			setProposal(found);
			setNotFound(!found);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.proposals, id]);

	return { proposal, loading, error, notFound, refresh };
}
