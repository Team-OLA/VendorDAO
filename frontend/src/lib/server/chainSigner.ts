import { cryptoWaitReady } from "@polkadot/util-crypto";
import { getApi } from "@/lib/polkadotApi";
import { parseTokenAmount } from "@/lib/chain";

/**
 * Mints staked VDAO for `address` by submitting a `vendorDao.stakeMint` extrinsic signed by the
 * payment-gateway account (`PAYMENT_GATEWAY_SEED`). Called after a Stripe webhook confirms an
 * off-chain card payment succeeded. Requires the chain to authorize this account via
 * `PaymentGatewayOrigin` (see chain/runtime/src/configs/mod.rs).
 */
export async function mintStakedTokens(address: string, amountUsd: number): Promise<void> {
  const seed = process.env.PAYMENT_GATEWAY_SEED;
  if (!seed) {
    throw new Error(
      "PAYMENT_GATEWAY_SEED is not configured on the server. See .env.local.example.",
    );
  }

  await cryptoWaitReady();
  const { Keyring } = await import("@polkadot/keyring");
  const keyring = new Keyring({ type: "sr25519" });
  const gateway = keyring.addFromUri(seed);

  const api = await getApi();
  // $1 = 1 VDAO: amountUsd is a whole-dollar count, converted straight to whole tokens.
  const planck = parseTokenAmount(String(amountUsd));

  return new Promise((resolve, reject) => {
    api.tx.vendorDao
      .stakeMint(address, planck)
      .signAndSend(gateway, (result) => {
        if (result.dispatchError) {
          let message = result.dispatchError.toString();
          if (result.dispatchError.isModule) {
            const decoded = api.registry.findMetaError(result.dispatchError.asModule);
            message = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
          }
          reject(new Error(message));
          return;
        }
        if (result.status.isInBlock || result.status.isFinalized) {
          resolve();
        }
      })
      .catch(reject);
  });
}
