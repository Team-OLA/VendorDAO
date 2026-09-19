"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { decodeSpendingReceipt } from "@/lib/decode";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import type { SpendingReceipt } from "@/lib/types";

/** Loads the itemized spending receipts posted against a funded proposal (chain or demo), oldest first. */
export function useSpendingReceipts(api: ApiPromise | null, proposalId: number) {
  const demo = useDemoMode();
  const [receipts, setReceipts] = useState<SpendingReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo.enabled || !api || Number.isNaN(proposalId)) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await api.query.vendorDao.spendingReceipts.entries(proposalId);
      const decoded = entries.map(([key, value]) => {
        const id = (key.args[1] as unknown as { toNumber(): number }).toNumber();
        return decodeSpendingReceipt(proposalId, id, value as unknown as Record<string, unknown>);
      });
      decoded.sort((a, b) => a.id - b.id);
      setReceipts(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spending receipts.");
    } finally {
      setLoading(false);
    }
  }, [api, proposalId, demo.enabled]);

  useEffect(() => {
    if (demo.enabled) {
      setError(null);
      setLoading(false);
      setReceipts(
        demo.spendingReceipts.filter((r) => r.proposalId === proposalId).sort((a, b) => a.id - b.id),
      );
      return;
    }
    refresh();
  }, [refresh, demo.enabled, demo.spendingReceipts, proposalId]);

  return { receipts, loading, error, refresh };
}
