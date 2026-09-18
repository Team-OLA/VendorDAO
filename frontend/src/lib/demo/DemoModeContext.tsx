"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEMO_ADMIN,
  DEMO_CITIZEN,
  DEMO_MINIMUM_QUORUM,
  createDemoProposals,
  createDemoTreasury,
  createDemoTreasuryContributions,
  createDemoVendorUpdates,
  createDemoVendors,
  type TreasuryContribution,
} from "./data";
import type { Proposal, ProposalStatus, TreasuryStats, VendorInfo, VendorUpdate } from "@/lib/types";
import type { VendorCategory } from "@/lib/vendorCategories";

const STORAGE_KEY = "vendordao-demo-mode";

interface DemoModeValue {
  enabled: boolean;
  toggle: () => void;
  citizen: typeof DEMO_CITIZEN;
  admin: typeof DEMO_ADMIN;
  vendors: VendorInfo[];
  proposals: Proposal[];
  treasury: TreasuryStats;
  treasuryContributions: TreasuryContribution[];
  votedProposalIds: number[];
  vendorUpdates: VendorUpdate[];
  registerVendor: (
    name: string,
    category: VendorCategory,
    description: string,
    contact: string,
    businessAddress: string,
    website: string,
  ) => void;
  submitProposal: (
    vendorAddress: string,
    title: string,
    description: string,
    amountPlanck: bigint,
  ) => void;
  vote: (id: number, approve: boolean) => void;
  closeProposal: (id: number) => void;
  disburse: (id: number) => void;
  cancelProposal: (id: number) => void;
  fundTreasury: (amountPlanck: bigint) => void;
  postVendorUpdate: (vendorAddress: string, content: string, proposalId: number | null) => void;
  resetDemo: () => void;
}

const DemoModeContext = createContext<DemoModeValue | null>(null);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [vendors, setVendors] = useState<VendorInfo[]>(() => createDemoVendors());
  const [proposals, setProposals] = useState<Proposal[]>(() => createDemoProposals());
  const [treasury, setTreasury] = useState<TreasuryStats>(() => createDemoTreasury());
  const [treasuryContributions, setTreasuryContributions] = useState<TreasuryContribution[]>(() =>
    createDemoTreasuryContributions(),
  );
  const [votedProposalIds, setVotedProposalIds] = useState<number[]>([]);
  const [vendorUpdates, setVendorUpdates] = useState<VendorUpdate[]>(() => createDemoVendorUpdates());

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setEnabled(stored === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }, [enabled, hydrated]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  const registerVendor = useCallback(
    (
      name: string,
      category: VendorCategory,
      description: string,
      contact: string,
      businessAddress: string,
      website: string,
    ) => {
      setVendors((prev) => {
        if (prev.some((v) => v.address === DEMO_CITIZEN.address)) return prev;
        const latestBlock = Math.max(0, ...prev.map((v) => v.registeredAt));
        return [
          ...prev,
          {
            address: DEMO_CITIZEN.address,
            name,
            category,
            description,
            contact,
            businessAddress,
            website,
            verified: false,
            registeredAt: latestBlock + 100,
            totalReceived: "0",
            proposalsFunded: 0,
          },
        ];
      });
    },
    [],
  );

  const submitProposal = useCallback(
    (vendorAddress: string, title: string, description: string, amountPlanck: bigint) => {
      setProposals((prev) => {
        const newId = prev.length ? Math.max(...prev.map((p) => p.id)) + 1 : 0;
        const createdAt = prev.length ? Math.max(...prev.map((p) => p.votingEnd)) : 100;
        const next: Proposal = {
          id: newId,
          proposer: DEMO_CITIZEN.address,
          vendor: vendorAddress,
          title,
          description,
          amount: amountPlanck.toString(),
          status: "Proposed",
          ayes: 0,
          nays: 0,
          createdAt,
          votingEnd: createdAt + 14400,
        };
        return [next, ...prev];
      });
    },
    [],
  );

  const vote = useCallback((id: number, approve: boolean) => {
    setVotedProposalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setProposals((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, ayes: approve ? p.ayes + 1 : p.ayes, nays: approve ? p.nays : p.nays + 1 }
          : p,
      ),
    );
  }, []);

  const disburse = useCallback((id: number) => {
    setProposals((prevProposals) => {
      const proposal = prevProposals.find((p) => p.id === id);
      if (!proposal || proposal.status !== "Approved") return prevProposals;

      const amount = BigInt(proposal.amount);
      let funded = false;
      setTreasury((prevTreasury) => {
        const potBalance = BigInt(prevTreasury.potBalance);
        if (potBalance < amount) return prevTreasury;
        funded = true;
        return {
          ...prevTreasury,
          potBalance: (potBalance - amount).toString(),
          totalDisbursed: (BigInt(prevTreasury.totalDisbursed) + amount).toString(),
        };
      });
      if (!funded) return prevProposals;

      setVendors((prevVendors) =>
        prevVendors.map((v) =>
          v.address === proposal.vendor
            ? {
                ...v,
                totalReceived: (BigInt(v.totalReceived) + amount).toString(),
                proposalsFunded: v.proposalsFunded + 1,
              }
            : v,
        ),
      );
      return prevProposals.map((p) => (p.id === id ? { ...p, status: "Funded" as ProposalStatus } : p));
    });
  }, []);

  const closeProposal = useCallback(
    (id: number) => {
      let justApproved = false;
      setProposals((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const totalVotes = p.ayes + p.nays;
          const passed = totalVotes >= DEMO_MINIMUM_QUORUM && p.ayes > p.nays;
          justApproved = passed;
          return { ...p, status: (passed ? "Approved" : "Rejected") as ProposalStatus };
        }),
      );
      if (justApproved) {
        // Mirrors the pallet: an approval immediately attempts disbursement.
        queueMicrotask(() => disburse(id));
      }
    },
    [disburse],
  );

  const cancelProposal = useCallback((id: number) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "Cancelled" as ProposalStatus } : p)),
    );
  }, []);

  const fundTreasury = useCallback((amountPlanck: bigint) => {
    setTreasury((prev) => ({
      ...prev,
      potBalance: (BigInt(prev.potBalance) + amountPlanck).toString(),
      totalReceived: (BigInt(prev.totalReceived) + amountPlanck).toString(),
    }));
    setTreasuryContributions((prev) => {
      const latestBlock = Math.max(0, ...prev.map((c) => c.block));
      return [
        ...prev,
        {
          block: latestBlock + 50,
          amount: amountPlanck.toString(),
          from: DEMO_CITIZEN.address,
          source: "Community contribution",
        },
      ];
    });
  }, []);

  const resetDemo = useCallback(() => {
    setVendors(createDemoVendors());
    setProposals(createDemoProposals());
    setTreasury(createDemoTreasury());
    setTreasuryContributions(createDemoTreasuryContributions());
    setVotedProposalIds([]);
    setVendorUpdates(createDemoVendorUpdates());
  }, []);

  const postVendorUpdate = useCallback(
    (vendorAddress: string, content: string, proposalId: number | null) => {
      setVendorUpdates((prev) => {
        const newId = prev.length ? Math.max(...prev.map((u) => u.id)) + 1 : 0;
        const latestBlock = Math.max(0, ...prev.map((u) => u.postedAt));
        const next: VendorUpdate = {
          id: newId,
          vendor: vendorAddress,
          content,
          proposalId,
          postedAt: latestBlock + 50,
        };
        return [next, ...prev];
      });
    },
    [],
  );

  const value = useMemo<DemoModeValue>(
    () => ({
      enabled,
      toggle,
      citizen: DEMO_CITIZEN,
      admin: DEMO_ADMIN,
      vendors,
      proposals,
      treasury,
      treasuryContributions,
      votedProposalIds,
      vendorUpdates,
      registerVendor,
      submitProposal,
      vote,
      closeProposal,
      disburse,
      cancelProposal,
      fundTreasury,
      postVendorUpdate,
      resetDemo,
    }),
    [
      enabled,
      toggle,
      vendors,
      proposals,
      treasury,
      treasuryContributions,
      votedProposalIds,
      vendorUpdates,
      registerVendor,
      submitProposal,
      vote,
      closeProposal,
      disburse,
      cancelProposal,
      fundTreasury,
      postVendorUpdate,
      resetDemo,
    ],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error("useDemoMode must be used within a DemoModeProvider");
  return ctx;
}
