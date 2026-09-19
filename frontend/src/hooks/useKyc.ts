"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeKycRecord } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { KycRecord } from "@/lib/types";

/** Loads one account's KYC request/status (chain or demo), with a `refresh()` for after actions. */
export function useKycRecord(api: ApiPromise | null, address: string | undefined) {
	const demo = useDemoMode();
	const [record, setRecord] = useState<KycRecord | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api || !address) return;
		setLoading(true);
		setError(null);
		try {
			const option = await api.query.vendorDao.kycRecords(address);
			const opt = option as unknown as { isNone: boolean; unwrap(): Record<string, unknown> };
			setRecord(opt.isNone ? null : decodeKycRecord(opt.unwrap()));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load KYC status.");
		} finally {
			setLoading(false);
		}
	}, [api, address, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setRecord(address ? (demo.kycRecords[address] ?? null) : null);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.kycRecords, address]);

	return { record, loading, error, refresh };
}

/** Loads every KYC request currently awaiting admin review (chain or demo). */
export function usePendingKycRequests(api: ApiPromise | null) {
	const demo = useDemoMode();
	const [requests, setRequests] = useState<{ address: string; record: KycRecord }[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (demo.enabled || !api) return;
		setLoading(true);
		setError(null);
		try {
			const entries = await api.query.vendorDao.kycRecords.entries();
			const decoded = entries
				.map(([key, value]) => ({
					address: (key.args[0] as unknown as { toString(): string }).toString(),
					record: decodeKycRecord(value as unknown as Record<string, unknown>),
				}))
				.filter((entry) => entry.record.status === "Pending");
			setRequests(decoded);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load KYC requests.");
		} finally {
			setLoading(false);
		}
	}, [api, demo.enabled]);

	useEffect(() => {
		if (demo.enabled) {
			setError(null);
			setLoading(false);
			setRequests(
				Object.entries(demo.kycRecords)
					.filter(([, record]) => record.status === "Pending")
					.map(([address, record]) => ({ address, record })),
			);
			return;
		}
		refresh();
	}, [refresh, demo.enabled, demo.kycRecords]);

	return { requests, loading, error, refresh };
}
