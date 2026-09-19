"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEMO_ADMIN,
  DEMO_CITIZEN,
  DEMO_MINIMUM_QUORUM,
  createDemoDonors,
  createDemoGrants,
  createDemoProposals,
  createDemoRfps,
  createDemoSpendingReceipts,
  createDemoTreasury,
  createDemoTreasuryContributions,
  createDemoVendorUpdates,
  createDemoVendors,
  type TreasuryContribution,
} from "./data";
import type {
  DonorInfo,
  Grant,
  KycRecord,
  Proposal,
  ProposalStatus,
  Rfp,
  SpendingReceipt,
  TreasuryStats,
  VendorInfo,
  VendorUpdate,
} from "@/lib/types";
import type { VendorCategory } from "@/lib/vendorCategories";
import type { DonorType } from "@/lib/donorTypes";
import type { Ward } from "@/lib/wards";
import type { DocumentType } from "@/lib/documentTypes";

const STORAGE_KEY = "vendordao-demo-mode";

/** Roughly mirrors the chain's ~1-year KYC validity period, in demo "block" units. */
const DEMO_KYC_VALIDITY_BLOCKS = 200_000;

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
    ward: Ward,
    rfpId: number | null,
  ) => void;
  vetProposal: (id: number, approve: boolean) => void;
  vote: (id: number, approve: boolean) => void;
  closeProposal: (id: number) => void;
  disburse: (id: number) => void;
  cancelProposal: (id: number) => void;
  fundTreasury: (amountPlanck: bigint) => void;
  postVendorUpdate: (vendorAddress: string, content: string, proposalId: number | null) => void;
  donors: DonorInfo[];
  grants: Grant[];
  stakedBalances: Record<string, string>;
  registerDonor: (name: string, donorType: DonorType) => void;
  submitGrant: (donorAddress: string, amountPlanck: bigint, purpose: string) => void;
  stakeTokens: (address: string, amountPlanck: bigint) => void;
  rfps: Rfp[];
  postRfp: (title: string, description: string, ward: Ward, maxAmountPlanck: bigint) => void;
  closeRfp: (id: number) => void;
  kycRecords: Record<string, KycRecord>;
  submitKyc: (ward: Ward, documentType: DocumentType, documentHash: string) => void;
  setKycStatus: (address: string, approve: boolean, rejectionReason?: string) => void;
  spendingReceipts: SpendingReceipt[];
  postSpendingReceipt: (
    proposalId: number,
    vendorAddress: string,
    amountPlanck: bigint,
    category: string,
    description: string,
    attachmentHash: string | null,
  ) => void;
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
  const [donors, setDonors] = useState<DonorInfo[]>(() => createDemoDonors());
  const [grants, setGrants] = useState<Grant[]>(() => createDemoGrants());
  const [stakedBalances, setStakedBalances] = useState<Record<string, string>>({});
  const [rfps, setRfps] = useState<Rfp[]>(() => createDemoRfps());
  const [kycRecords, setKycRecords] = useState<Record<string, KycRecord>>({});
  const [spendingReceipts, setSpendingReceipts] = useState<SpendingReceipt[]>(() => createDemoSpendingReceipts());

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
    (
      vendorAddress: string,
      title: string,
      description: string,
      amountPlanck: bigint,
      ward: Ward,
      rfpId: number | null,
    ) => {
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
          status: "PendingReview",
          ayes: 0,
          nays: 0,
          createdAt,
          votingEnd: createdAt,
          ward,
          rfpId,
        };
        return [next, ...prev];
      });
    },
    [],
  );

  const vetProposal = useCallback((id: number, approve: boolean) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.status !== "PendingReview") return p;
        if (approve) {
          return { ...p, status: "Proposed" as ProposalStatus, votingEnd: p.createdAt + 14400 };
        }
        return { ...p, status: "Vetoed" as ProposalStatus };
      }),
    );
  }, []);

  const vote = useCallback(
    (id: number, approve: boolean) => {
      const proposal = proposals.find((p) => p.id === id);
      if (proposal && proposal.ward !== "Citywide") {
        const record = kycRecords[DEMO_CITIZEN.address];
        if (!record || record.status !== "Verified" || record.ward !== proposal.ward) {
          throw new Error("Voting on this proposal is restricted to verified residents of its ward.");
        }
      }

      setVotedProposalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setProposals((prev) =>
        prev.map((p) =>
          p.id === id && p.status === "Proposed"
            ? { ...p, ayes: approve ? p.ayes + 1 : p.ayes, nays: approve ? p.nays : p.nays + 1 }
            : p,
        ),
      );
    },
    [proposals, kycRecords],
  );

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
      prev.map((p) =>
        p.id === id && (p.status === "PendingReview" || p.status === "Proposed")
          ? { ...p, status: "Cancelled" as ProposalStatus }
          : p,
      ),
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
    setDonors(createDemoDonors());
    setGrants(createDemoGrants());
    setStakedBalances({});
    setRfps(createDemoRfps());
    setKycRecords({});
    setSpendingReceipts(createDemoSpendingReceipts());
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

  const registerDonor = useCallback((name: string, donorType: DonorType) => {
    setDonors((prev) => {
      if (prev.some((d) => d.address === DEMO_CITIZEN.address)) return prev;
      const latestBlock = Math.max(0, ...prev.map((d) => d.registeredAt));
      return [
        ...prev,
        {
          address: DEMO_CITIZEN.address,
          name,
          donorType,
          registeredAt: latestBlock + 100,
          totalContributed: "0",
          grantsMade: 0,
        },
      ];
    });
  }, []);

  const submitGrant = useCallback((donorAddress: string, amountPlanck: bigint, purpose: string) => {
    setGrants((prev) => {
      const newId = prev.length ? Math.max(...prev.map((g) => g.id)) + 1 : 0;
      const latestBlock = Math.max(0, ...prev.map((g) => g.submittedAt));
      const next: Grant = {
        id: newId,
        donor: donorAddress,
        amount: amountPlanck.toString(),
        purpose,
        submittedAt: latestBlock + 50,
      };
      return [next, ...prev];
    });
    setDonors((prev) =>
      prev.map((d) =>
        d.address === donorAddress
          ? {
              ...d,
              totalContributed: (BigInt(d.totalContributed) + amountPlanck).toString(),
              grantsMade: d.grantsMade + 1,
            }
          : d,
      ),
    );
    setTreasury((prev) => ({
      ...prev,
      potBalance: (BigInt(prev.potBalance) + amountPlanck).toString(),
      totalReceived: (BigInt(prev.totalReceived) + amountPlanck).toString(),
    }));
  }, []);

  const stakeTokens = useCallback((address: string, amountPlanck: bigint) => {
    setStakedBalances((prev) => {
      const current = BigInt(prev[address] ?? "0");
      return { ...prev, [address]: (current + amountPlanck).toString() };
    });
  }, []);

  const postRfp = useCallback((title: string, description: string, ward: Ward, maxAmountPlanck: bigint) => {
    setRfps((prev) => {
      const newId = prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 0;
      const latestBlock = Math.max(0, ...prev.map((r) => r.createdAt));
      const next: Rfp = {
        id: newId,
        title,
        description,
        ward,
        maxAmount: maxAmountPlanck.toString(),
        status: "Open",
        createdAt: latestBlock + 50,
      };
      return [next, ...prev];
    });
  }, []);

  const closeRfp = useCallback((id: number) => {
    setRfps((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Closed" as const } : r)));
  }, []);

  const submitKyc = useCallback((ward: Ward, documentType: DocumentType, documentHash: string) => {
    setKycRecords((prev) => ({
      ...prev,
      [DEMO_CITIZEN.address]: {
        ward,
        documentType,
        documentHash,
        status: "Pending",
        submittedAt: 0,
        verifiedAt: null,
        expiresAt: null,
        rejectionReason: null,
      },
    }));
  }, []);

  const setKycStatus = useCallback((address: string, approve: boolean, rejectionReason?: string) => {
    setKycRecords((prev) => {
      const record = prev[address];
      if (!record || record.status !== "Pending") return prev;
      return {
        ...prev,
        [address]: approve
          ? { ...record, status: "Verified", verifiedAt: 100, expiresAt: 100 + DEMO_KYC_VALIDITY_BLOCKS }
          : { ...record, status: "Rejected", verifiedAt: null, expiresAt: null, rejectionReason: rejectionReason ?? null },
      };
    });
  }, []);

  const postSpendingReceipt = useCallback(
    (
      proposalId: number,
      vendorAddress: string,
      amountPlanck: bigint,
      category: string,
      description: string,
      attachmentHash: string | null,
    ) => {
      setSpendingReceipts((prev) => {
        const receiptsForProposal = prev.filter((r) => r.proposalId === proposalId);
        const newId = receiptsForProposal.length
          ? Math.max(...receiptsForProposal.map((r) => r.id)) + 1
          : 0;
        const latestBlock = Math.max(0, ...prev.map((r) => r.postedAt));
        const next: SpendingReceipt = {
          id: newId,
          proposalId,
          vendor: vendorAddress,
          amount: amountPlanck.toString(),
          category,
          description,
          attachmentHash,
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
      vetProposal,
      vote,
      closeProposal,
      disburse,
      cancelProposal,
      fundTreasury,
      postVendorUpdate,
      donors,
      grants,
      stakedBalances,
      registerDonor,
      submitGrant,
      stakeTokens,
      rfps,
      postRfp,
      closeRfp,
      kycRecords,
      submitKyc,
      setKycStatus,
      spendingReceipts,
      postSpendingReceipt,
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
      vetProposal,
      vote,
      closeProposal,
      disburse,
      cancelProposal,
      fundTreasury,
      postVendorUpdate,
      donors,
      grants,
      stakedBalances,
      registerDonor,
      submitGrant,
      stakeTokens,
      rfps,
      postRfp,
      closeRfp,
      kycRecords,
      submitKyc,
      setKycStatus,
      spendingReceipts,
      postSpendingReceipt,
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
