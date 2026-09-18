"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePolkadotApi } from "@/hooks/usePolkadotApi";
import { useWallet } from "@/hooks/useWallet";
import { useDemoMode } from "@/lib/demo/DemoModeContext";
import { signAndSendTx } from "@/lib/signAndSend";
import { VENDOR_CATEGORIES, type VendorCategory } from "@/lib/vendorCategories";
import { EmailVerification } from "@/components/EmailVerification";

export default function RegisterVendorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const demo = useDemoMode();
  const { api } = usePolkadotApi();
  const { accounts, selected, connect } = useWallet();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("Construction");
  const [description, setDescription] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-lock verification if the address changes after already verifying.
  useEffect(() => setEmailVerified(false), [email]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selected) {
      setError(t("common.connectWalletFirst"));
      return;
    }
    if (!emailVerified) {
      setError(t("registerVendor.verifyEmailFirst"));
      return;
    }

    setSubmitting(true);
    try {
      if (demo.enabled) {
        demo.registerVendor(name, category, description, email, businessAddress, website);
      } else {
        if (!api) return;
        const tx = api.tx.vendorDao.registerVendor(
          name,
          category,
          description,
          email,
          businessAddress,
          website,
        );
        await signAndSendTx(tx, selected.address, setStatus);
      }
      router.push("/vendors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">{t("registerVendor.title")}</h1>

      {accounts.length === 0 && (
        <button
          type="button"
          onClick={connect}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {t("wallet.connect")}
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("registerVendor.nameLabel")}
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={128}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("registerVendor.categoryLabel")}
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as VendorCategory)}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          >
            {VENDOR_CATEGORIES.map((c) => (
              <option key={c} value={c} className="text-black">
                {t(`vendorCategory.${c}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("registerVendor.descriptionLabel")}
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={4}
            maxLength={1024}
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("registerVendor.businessAddressLabel")}
          </label>
          <input
            value={businessAddress}
            onChange={(event) => setBusinessAddress(event.target.value)}
            required
            maxLength={256}
            placeholder="123 Main St, Detroit, MI 48201"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("registerVendor.websiteLabel")}
          </label>
          <input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            maxLength={256}
            placeholder="https://example.com"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80">
            {t("registerVendor.emailLabel")}
          </label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            maxLength={256}
            placeholder="hello@example.com"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2"
          />
          <div className="mt-2">
            <EmailVerification
              email={email}
              verified={emailVerified}
              onVerified={() => setEmailVerified(true)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {status && !error && <p className="text-sm text-white/60">{status}</p>}

        <button
          type="submit"
          disabled={submitting || (!demo.enabled && !api) || !emailVerified}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? t("registerVendor.submitting") : t("registerVendor.submit")}
        </button>
      </form>
    </div>
  );
}

