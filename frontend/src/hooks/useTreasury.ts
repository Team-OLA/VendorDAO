"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { deriveTreasuryAccount } from "@/lib/chain";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { TreasuryStats } from "@/lib/types";

/** Loads the public, transparent treasury ledger: pot balance + lifetime totals (chain or demo). */
export function useTreasury(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [stats, setStats] = useState<TreasuryStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const ss58Format = api.registry.chainSS58 ?? 42;
			const potAddress = deriveTreasuryAccount(ss58Format);
			const [accountInfo, totalReceived, totalDisbursed] = await Promise.all([
				api.query.system.account(potAddress),
				api.query.vendorDao.totalFundsReceived(),
				api.query.vendorDao.totalFundsDisbursed(),
			]);
			setStats({
				potAddress,
				potBalance: (accountInfo as unknown as { data: { free: { toString(): string } } }).data.free.toString(),
				totalReceived: (totalReceived as unknown as { toString(): string }).toString(),
				totalDisbursed: (totalDisbursed as unknown as { toString(): string }).toString(),
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load treasury stats.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setStats(demo.treasury);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.treasury]);

	return { stats, loading, error, refresh };
}
