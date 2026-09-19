"use client";

import { useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";

/** Live current block number, used to detect an expired (but still "Verified") KYC record. */
export function useCurrentBlock(api: ApiPromise | null): number | null {
  const [block, setBlock] = useState<number | null>(null);

  useEffect(() => {
    if (!api) {
      setBlock(null);
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;
    api.rpc.chain
      .subscribeNewHeads((header) => setBlock(header.number.toNumber()))
      .then((fn) => {
        if (cancelled) fn();
        else unsub = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [api]);

  return block;
}
