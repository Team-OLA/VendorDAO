"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useCurrentBlock } from "@/hooks/useCurrentBlock";
import { useKycRecord, usePendingKycRequests } from "@/hooks/useKyc";
import { useWallet } from "@/hooks/useWallet";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WardBadge } from "@/components/WardBadge";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { truncateAddress } from "@/lib/chain";
import { WARDS, type Ward } from "@/lib/wards";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documentTypes";
import { hashKycDocument, bytesToHex } from "@/lib/kycHash";
import type { KycStatus } from "@/lib/types";

type DisplayStatus = KycStatus | "NotStarted" | "Expired";

const STATUS_VARIANTS: Record<DisplayStatus, BadgeVariant> = {
  NotStarted: "zinc",
  Pending: "amber",
  Verified: "emerald",
  Rejected: "red",
  Expired: "red",
};

export default function KycPage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { accounts, selected, connect } = useWallet();
  const { record, refresh } = useKycRecord(api, selected?.address);
  const { requests, refresh: refreshRequests } = usePendingKycRequests(api);
  const currentBlock = useCurrentBlock(api);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("Passport");
  const [documentNumber, setDocumentNumber] = useState("");
  const [ward, setWard] = useState<Ward>("District1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [stripeVerified, setStripeVerified] = useState(false);
  const [stripeChecking, setStripeChecking] = useState(false);
  const [stripeNotConfigured, setStripeNotConfigured] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const isAdmin = !!selected && selected.address === demo.admin.address;
  const isExpired =
    record?.status === "Verified" &&
    !demo.enabled &&
    record.expiresAt !== null &&
    currentBlock !== null &&
    currentBlock > record.expiresAt;
  const statusKey: DisplayStatus = isExpired ? "Expired" : (record?.status ?? "NotStarted");
  const formValid = fullName.trim().length > 0 && dateOfBirth.length > 0 && documentNumber.trim().length > 0;

  const handleVerifyWithStripe = async () => {
    setError(null);
    setStripeChecking(true);
    try {
      const res = await fetch("/api/kyc/create-verification-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start identity verification.");
      if (!data.configured) {
        setStripeNotConfigured(true);
        return;
      }

      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
      if (!stripe) throw new Error("Stripe.js failed to load.");
      const result = await stripe.verifyIdentity(data.clientSecret);
      if (result.error) throw new Error(result.error.message);

      // Stripe processes the document/selfie asynchronously; read back the outcome once the
      // verification modal has closed.
      const statusRes = await fetch(`/api/kyc/session-status?sessionId=${data.sessionId}`);
      const statusData = await statusRes.json();
      setStripeVerified(statusData.status === "verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identity verification failed.");
    } finally {
      setStripeChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!selected || !formValid) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const hashBytes = await hashKycDocument(fullName, dateOfBirth, documentNumber);
      const documentHash = bytesToHex(hashBytes);
      // The raw name/DOB/document number never leave this point -- only the hash is submitted.
      setFullName("");
      setDateOfBirth("");
      setDocumentNumber("");

      if (demo.enabled) {
        demo.submitKyc(ward, documentType, documentHash);
      } else {
        if (!api) return;
        await signAndSendTx(
          api.tx.vendorDao.submitKyc(ward, documentType, documentHash),
          selected.address,
          setStatus,
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit KYC request.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (address: string, approve: boolean) => {
    if (!selected) return;
    const reason = rejectReasons[address]?.trim() || undefined;
    try {
      if (demo.enabled) {
        demo.setKycStatus(address, approve, reason);
      } else {
        if (!api) return;
        await signAndSendTx(api.tx.vendorDao.setKycStatus(address, approve, reason ?? null), selected.address);
      }
      await refreshRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update KYC request.");
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("kyc.title")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("kyc.subtitle")}</p>
      </div>

      {accounts.length === 0 ? (
        <Button type="button" onClick={connect}>
          {t("wallet.connect")}
        </Button>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t("kyc.statusLabel")}</span>
            <Badge variant={STATUS_VARIANTS[statusKey]}>{t(`kyc.status.${statusKey}`)}</Badge>
          </div>
          {record && (
            <div className="space-y-1 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                {t("kyc.wardLabel")}: <WardBadge ward={record.ward} />
              </p>
              <p>{t("kyc.documentTypeLabel")}: {t(`documentType.${record.documentType}`)}</p>
              {record.status === "Verified" && record.expiresAt !== null && (
                <p className="text-xs text-gray-500">
                  {isExpired
                    ? t("kyc.expiredAtBlock", { block: record.expiresAt })
                    : t("kyc.validUntilBlock", { block: record.expiresAt })}
                </p>
              )}
              {record.status === "Rejected" && record.rejectionReason && (
                <p className="text-xs text-red-600">
                  {t("kyc.rejectionReasonLabel")}: {record.rejectionReason}
                </p>
              )}
            </div>
          )}

          {(!record || record.status === "Rejected" || isExpired) && (
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <p className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
                {t("kyc.privacyNotice")}
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t("kyc.fullNameLabel")}</label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  maxLength={128}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t("kyc.dobLabel")}</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("kyc.documentTypeLabel")}</label>
                  <select
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  >
                    {DOCUMENT_TYPES.map((option) => (
                      <option key={option} value={option} className="text-black">
                        {t(`documentType.${option}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("kyc.documentNumberLabel")}</label>
                  <input
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    required
                    maxLength={64}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t("kyc.wardLabel")}</label>
                <select
                  value={ward}
                  onChange={(event) => setWard(event.target.value as Ward)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                >
                  {WARDS.filter((option) => option !== "Citywide").map((option) => (
                    <option key={option} value={option} className="text-black">
                      {t(`ward.${option}`)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{t("kyc.wardHint")}</p>
              </div>

              {!demo.enabled && !stripeVerified && !stripeNotConfigured && (
                <Button type="button" variant="neutral" onClick={handleVerifyWithStripe} disabled={stripeChecking}>
                  {stripeChecking ? t("kyc.verifying") : t("kyc.verifyWithStripe")}
                </Button>
              )}
              {stripeNotConfigured && (
                <p className="text-xs text-amber-700">{t("kyc.stripeNotConfiguredNotice")}</p>
              )}
              {stripeVerified && <p className="text-xs text-emerald-700">{t("kyc.stripeVerifiedNotice")}</p>}

              {error && <p className="text-sm text-red-600">{error}</p>}
              {status && !error && <p className="text-sm text-gray-500">{status}</p>}

              <Button type="button" onClick={handleSubmit} disabled={busy || !formValid || (!demo.enabled && !api)}>
                {busy ? t("kyc.submitting") : t("kyc.submit")}
              </Button>
            </div>
          )}
          {record?.status === "Pending" && <p className="text-xs text-gray-500">{t("kyc.pendingNotice")}</p>}
        </Card>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("kyc.adminPendingTitle")}</h2>
          {requests.length === 0 && <p className="text-sm text-gray-500">{t("kyc.adminEmpty")}</p>}
          <div className="space-y-2">
            {requests.map(({ address, record: pendingRecord }) => (
              <div key={address} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{truncateAddress(address)}</span>
                  <WardBadge ward={pendingRecord.ward} />
                  <Badge variant="indigo">{t(`documentType.${pendingRecord.documentType}`)}</Badge>
                  <span className="font-mono text-xs text-gray-400">
                    {pendingRecord.documentHash.slice(0, 10)}…
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={rejectReasons[address] ?? ""}
                    onChange={(event) =>
                      setRejectReasons((prev) => ({ ...prev, [address]: event.target.value }))
                    }
                    placeholder={t("kyc.rejectReasonPlaceholder")}
                    className="w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs sm:flex-1"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="success" className="flex-1 sm:flex-none" onClick={() => decide(address, true)}>
                      {t("kyc.approve")}
                    </Button>
                    <Button type="button" variant="danger" className="flex-1 sm:flex-none" onClick={() => decide(address, false)}>
                      {t("kyc.reject")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
