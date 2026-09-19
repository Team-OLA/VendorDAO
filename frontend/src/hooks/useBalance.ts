"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { useDemoMode } from "@/lib/demo/DemoModeContext";

/** Reads an account's free/transferable native token balance (chain or demo staked balance). */
export function useBalance(api: ApiPromise | null, address: string | undefined) {
	const demo = useDemoMode();
	const [balance, setBalance] = useState<string>("0");
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api || !address) return;
		setLoading(true);
		try {
			const account = await api.query.system.account(address);
			const data = (account as unknown as { data: { free: { toString(): string } } }).data;
			setBalance(data.free.toString());
		} finally {
			setLoading(false);
		}
	}, [api, address, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setLoading(false);
			setBalance(address ? (demo.stakedBalances[address] ?? "0") : "0");
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.stakedBalances, address]);

	return { balance, loading, refresh };
}
