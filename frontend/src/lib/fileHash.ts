/** Computes a client-side SHA-256 hash of an arbitrary file's bytes (e.g. a receipt photo/scan). */
export async function hashFile(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(digest);
}

/** Reads a file as a base64 data URL, for local preview/caching. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
