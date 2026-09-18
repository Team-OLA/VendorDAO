"use client";

import { useEffect, useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { getApi } from "@/lib/polkadotApi";

/** Connects (once) to the VendorDAO node and exposes the shared ApiPromise instance. */
export function usePolkadotApi() {
  const { enabled: demoEnabled } = useDemoMode();
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Demo mode never touches the network - no chain node is required to browse the app.
    if (demoEnabled) {
      setApi(null);
      setError(null);
      return;
    }
    let cancelled = false;
    getApi()
      .then((instance) => {
        if (!cancelled) setApi(instance);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to connect to the VendorDAO node.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [demoEnabled]);

  return { api, isReady: demoEnabled || !!api, error };
}
