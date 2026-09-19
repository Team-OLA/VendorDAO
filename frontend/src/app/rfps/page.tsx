"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useRfps } from "@/hooks/useRfps";
import { useWallet } from "@/hooks/useWallet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WardBadge } from "@/components/WardBadge";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { CHAIN_TOKEN_SYMBOL, formatTokenAmount, parseTokenAmount } from "@/lib/chain";
import { WARDS, type Ward } from "@/lib/wards";

export default function RfpsPage() {
  const { t } = useTranslation();
  const demo = useDemoMode();
  const { api, error: apiError } = usePolkadotApi();
  const { rfps, loading, error, refresh } = useRfps(api);
  const { selected } = useWallet();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ward, setWard] = useState<Ward>("Citywide");
  const [maxAmount, setMaxAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<string | null>(null);

  const isAdmin = !!selected && selected.address === demo.admin.address;

  const handlePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setPostError(null);
    setPostStatus(null);
    try {
      const planck = parseTokenAmount(maxAmount);
      if (demo.enabled) {
        demo.postRfp(title, description, ward, planck);
      } else {
        if (!api) return;
        await signAndSendTx(
          api.tx.vendorDao.postRfp(title, description, ward, planck.toString()),
          selected.address,
          setPostStatus,
        );
      }
      setTitle("");
      setDescription("");
      setMaxAmount("");
      await refresh();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to post RFP.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async (id: number) => {
    if (!selected) return;
    try {
      if (demo.enabled) {
        demo.closeRfp(id);
      } else {
        if (!api) return;
        await signAndSendTx(api.tx.vendorDao.closeRfp(id), selected.address);
      }
      await refresh();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to close RFP.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("rfps.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">{t("rfps.subtitle")}</p>
      </div>

      {(apiError || error) && <p className="text-sm text-red-600">{apiError ?? error}</p>}
      {loading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rfps.map((rfp) => (
          <div key={rfp.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">
                <Link href={`/rfps/${rfp.id}`} className="hover:text-[#1736F5]">
                  #{rfp.id} — {rfp.title}
                </Link>
              </h3>
              <div className="flex shrink-0 items-center gap-1.5">
                <WardBadge ward={rfp.ward} />
                <Badge variant={rfp.status === "Open" ? "emerald" : "zinc"}>{t(`rfpStatus.${rfp.status}`)}</Badge>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">{rfp.description}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-700">
                {t("rfps.maxAmount")}: {formatTokenAmount(rfp.maxAmount)} {CHAIN_TOKEN_SYMBOL}
              </span>
              <div className="flex gap-2">
                {rfp.status === "Open" && (
                  <Link
                    href={`/proposals/new?rfpId=${rfp.id}`}
                    className="inline-flex items-center rounded-md bg-[#1736F5] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#122bc9]"
                  >
                    {t("rfps.respond")}
                  </Link>
                )}
                {isAdmin && rfp.status === "Open" && (
                  <Button type="button" variant="neutral" onClick={() => handleClose(rfp.id)}>
                    {t("rfps.close")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!loading && rfps.length === 0 && <p className="text-sm text-gray-500">{t("rfps.empty")}</p>}

      {isAdmin && (
        <form onSubmit={handlePost} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{t("rfps.postNew")}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("rfps.titleLabel")}</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={128}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("rfps.descriptionLabel")}</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              rows={4}
              maxLength={4096}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("rfps.wardLabel")}</label>
              <select
                value={ward}
                onChange={(event) => setWard(event.target.value as Ward)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              >
                {WARDS.map((option) => (
                  <option key={option} value={option} className="text-black">
                    {t(`ward.${option}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("rfps.maxAmountLabel")} ({CHAIN_TOKEN_SYMBOL})
              </label>
              <input
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                required
                inputMode="decimal"
                placeholder="0.0"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              />
            </div>
          </div>

          {postError && <p className="text-sm text-red-600">{postError}</p>}
          {postStatus && !postError && <p className="text-sm text-gray-500">{postStatus}</p>}

          <Button type="submit" disabled={busy || (!demo.enabled && !api)}>
            {busy ? t("rfps.submitting") : t("rfps.submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
