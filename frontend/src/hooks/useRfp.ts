"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeRfp } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { Rfp } from "@/lib/types";

/** Loads a single RFP by id (chain or demo), with a `refresh()` for after actions. */
export function useRfp(api: ApiPromise | null, id: number) {
	const demo = useDemoMode();
	const [rfp, setRfp] = useState<Rfp | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notFound, setNotFound] = useState(false);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api || Number.isNaN(id)) return;
		setLoading(true);
		setError(null);
		try {
			const option = await api.query.vendorDao.rfps(id);
			const opt = option as unknown as { isNone: boolean; unwrap(): Record<string, unknown> };
			if (opt.isNone) {
				setRfp(null);
				setNotFound(true);
			} else {
				setRfp(decodeRfp(id, opt.unwrap()));
				setNotFound(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load RFP.");
		} finally {
			setLoading(false);
		}
	}, [api, id, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			const found = demo.rfps.find((r) => r.id === id) ?? null;
			setRfp(found);
			setNotFound(!found);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.rfps, id]);

	return { rfp, loading, error, notFound, refresh };
}
