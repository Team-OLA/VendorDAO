"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import { useDemoMode } from "@/lib/demo/DemoModeContext";

interface WalletValue {
  accounts: InjectedAccountWithMeta[];
  selected: InjectedAccountWithMeta | null;
  setSelected: (account: InjectedAccountWithMeta | null) => void;
  connect: () => Promise<void>;
  connecting: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { enabled: demoEnabled, citizen, vendors } = useDemoMode();
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selected, setSelected] = useState<InjectedAccountWithMeta | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo mode has no real wallet: auto-"connect" a stand-in Detroit resident account, plus one
  // account per registered vendor so their own update-posting flow can be tried out.
  useEffect(() => {
    if (!demoEnabled) {
      setAccounts([]);
      setSelected(null);
      return;
    }
    const citizenAccount: InjectedAccountWithMeta = {
      address: citizen.address,
      meta: { name: citizen.name, source: "demo" },
    };
    const vendorAccounts: InjectedAccountWithMeta[] = vendors.map((vendor) => ({
      address: vendor.address,
      meta: { name: `${vendor.name} (Vendor)`, source: "demo" },
    }));
    const all = [citizenAccount, ...vendorAccounts];
    setAccounts(all);
    setSelected((current) => all.find((a) => a.address === current?.address) ?? citizenAccount);
    setError(null);
  }, [demoEnabled, citizen, vendors]);

  const connect = useCallback(async () => {
    if (demoEnabled) return; // already auto-connected above
    setConnecting(true);
    setError(null);
    try {
      const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
      const extensions = await web3Enable("VendorDAO");
      if (extensions.length === 0) {
        setError(
          "No Polkadot{.js}-compatible wallet extension found. Install one (e.g. the Polkadot{.js} extension or Talisman) and refresh.",
        );
        return;
      }
      const found = await web3Accounts();
      setAccounts(found);
      setSelected((current) => current ?? found[0] ?? null);
      if (found.length === 0) {
        setError("No accounts were authorized. Approve VendorDAO in your wallet extension.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [demoEnabled]);

  return (
    <WalletContext.Provider value={{ accounts, selected, setSelected, connect, connecting, error }}>
      {children}
    </WalletContext.Provider>
  );
}

/** Shared wallet connection/account-selection state (one instance app-wide, so selecting an
 * account in the navbar is reflected on every page). */
export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
