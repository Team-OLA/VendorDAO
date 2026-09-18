import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { ISubmittableResult } from "@polkadot/types/types";

/**
 * Signs and sends an extrinsic using the browser wallet extension for `address`,
 * resolving once it is included in a block (and decoding any dispatch error into a
 * readable `pallet.ErrorName: docs` message for transparency to the user).
 */
export async function signAndSendTx(
  tx: SubmittableExtrinsic<"promise">,
  address: string,
  onStatus?: (status: string) => void,
): Promise<void> {
  const { web3FromAddress } = await import("@polkadot/extension-dapp");
  const injector = await web3FromAddress(address);

  return new Promise((resolve, reject) => {
    tx
      .signAndSend(address, { signer: injector.signer }, (result: ISubmittableResult) => {
        onStatus?.(result.status.type);

        if (result.dispatchError) {
          let message = result.dispatchError.toString();
          if (result.dispatchError.isModule) {
            const decoded = tx.registry.findMetaError(result.dispatchError.asModule);
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
