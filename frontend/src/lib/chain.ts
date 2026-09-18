import { stringToU8a, u8aConcat } from "@polkadot/util";
import { encodeAddress } from "@polkadot/util-crypto";

/** WebSocket endpoint of the VendorDAO node. Override via NEXT_PUBLIC_CHAIN_WS_ENDPOINT. */
export const CHAIN_WS_ENDPOINT =
  process.env.NEXT_PUBLIC_CHAIN_WS_ENDPOINT ?? "ws://127.0.0.1:9944";

/** Must match `TreasuryPalletId` in chain/runtime/src/configs/mod.rs. */
export const TREASURY_PALLET_ID = "py/vddao";

/** Must match the `UNIT` constant in chain/runtime/src/lib.rs (12 decimals). */
export const CHAIN_DECIMALS = 12;
export const CHAIN_TOKEN_SYMBOL = "VDAO";

/**
 * Derives the sovereign account address for a pallet's `PalletId`, using the same
 * "modl" + id + zero-padding scheme as Substrate's `PalletId::into_account_truncating`.
 */
export function derivePalletAccount(palletId: string, ss58Format = 42): string {
  const raw = u8aConcat(stringToU8a("modl"), stringToU8a(palletId), new Uint8Array(32)).subarray(
    0,
    32,
  );
  return encodeAddress(raw, ss58Format);
}

export function deriveTreasuryAccount(ss58Format = 42): string {
  return derivePalletAccount(TREASURY_PALLET_ID, ss58Format);
}

/** Parses a user-entered decimal token amount (e.g. "12.5") into planck as a bigint. */
export function parseTokenAmount(input: string, decimals = CHAIN_DECIMALS): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid positive number.");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFrac || "0");
}

/** Formats a planck amount (string/bigint) back into a human-readable decimal token string. */
export function formatTokenAmount(planck: string | bigint, decimals = CHAIN_DECIMALS): string {
  const value = typeof planck === "bigint" ? planck : BigInt(planck || "0");
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

export function truncateAddress(address: string, size = 6): string {
  if (!address || address.length <= size * 2 + 1) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}

/** Reads a field off a decoded polkadot.js Struct, tolerating either snake_case or camelCase keys. */
export function pickField<T = unknown>(raw: Record<string, unknown>, ...names: string[]): T {
  for (const name of names) {
    if (raw[name] !== undefined) return raw[name] as T;
  }
  throw new Error(`None of the fields [${names.join(", ")}] were found on the decoded value.`);
}
