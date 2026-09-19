const STORAGE_PREFIX = "vendordao-attachment:";

/**
 * Client-side-only cache of receipt attachment bytes, keyed by their SHA-256 hash. The chain
 * (and demo state) only ever store the hash - never the media itself - so this is what lets an
 * uploaded photo/scan be shown back on the *same* browser after posting. It is NOT shared across
 * devices or browsers and is not real decentralized storage - treat it purely as a local preview
 * cache, not a persistence guarantee.
 */
export function cacheAttachment(hashHex: string, dataUrl: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + hashHex, dataUrl);
  } catch {
    // Quota exceeded or storage unavailable (e.g. private browsing) - the hash is still recorded
    // on-chain either way, just without a local preview.
  }
}

export function getCachedAttachment(hashHex: string | null): string | null {
  if (!hashHex) return null;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + hashHex);
  } catch {
    return null;
  }
}
