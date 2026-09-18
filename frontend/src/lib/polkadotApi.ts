import type { ApiPromise } from "@polkadot/api";
import { CHAIN_WS_ENDPOINT } from "./chain";

let apiPromise: Promise<ApiPromise> | null = null;

/** Lazily creates a single shared `ApiPromise` connection for the whole app. */
export function getApi(endpoint: string = CHAIN_WS_ENDPOINT): Promise<ApiPromise> {
  if (!apiPromise) {
    apiPromise = import("@polkadot/api").then(({ ApiPromise, WsProvider }) =>
      ApiPromise.create({ provider: new WsProvider(endpoint) }),
    );
  }
  return apiPromise;
}
