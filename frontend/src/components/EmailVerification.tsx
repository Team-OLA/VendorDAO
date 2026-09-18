"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

type Stage = "idle" | "captcha" | "code" | "done";

/**
 * Client-side anti-spam gate for vendor registration: a self-hosted math CAPTCHA followed by a
 * 6-digit email code. Verification is a UX/spam-reduction measure only — the chain itself has no
 * concept of email and cannot enforce this; it just unlocks the registration form's submit button.
 */
export function EmailVerification({
  email,
  verified,
  onVerified,
}: {
  email: string;
  verified: boolean;
  onVerified: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>("idle");
  const [question, setQuestion] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startChallenge = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/vendor-verification/challenge", { method: "POST" });
      const json = await res.json();
      setQuestion(json.question);
      setCaptchaToken(json.token);
      setCaptchaAnswer("");
      setStage("captcha");
    } catch {
      setError(t("registerVendor.verificationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/vendor-verification/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken, captchaAnswer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("registerVendor.verificationFailed"));
      setVerificationToken(json.verificationToken);
      setDevCode(json.devCode ?? null);
      setCode("");
      setStage("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registerVendor.verificationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/vendor-verification/confirm-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("registerVendor.verificationFailed"));
      setStage("done");
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registerVendor.verificationFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return <p className="text-sm text-emerald-400">✓ {t("registerVendor.emailVerified")}</p>;
  }

  return (
    <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
      {stage === "idle" && (
        <button
          type="button"
          disabled={!email || busy}
          onClick={startChallenge}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {t("registerVendor.verifyEmail")}
        </button>
      )}

      {stage === "captcha" && (
        <div className="space-y-2">
          <p className="text-sm text-white/80">
            {t("registerVendor.captchaPrompt", { question })}
          </p>
          <div className="flex gap-2">
            <input
              value={captchaAnswer}
              onChange={(event) => setCaptchaAnswer(event.target.value)}
              inputMode="numeric"
              className="w-24 rounded-md border border-white/20 bg-transparent px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={busy || !captchaAnswer}
              onClick={sendCode}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {t("registerVendor.sendCode")}
            </button>
          </div>
        </div>
      )}

      {stage === "code" && (
        <div className="space-y-2">
          <p className="text-sm text-white/80">{t("registerVendor.enterCode")}</p>
          {devCode && (
            <p className="text-xs text-amber-300">
              {t("registerVendor.devCodeNotice")} <strong>{devCode}</strong>
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={6}
              inputMode="numeric"
              placeholder="123456"
              className="w-28 rounded-md border border-white/20 bg-transparent px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={confirmCode}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {t("registerVendor.confirmCode")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={startChallenge}
              className="text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
            >
              {t("registerVendor.resendCode")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
