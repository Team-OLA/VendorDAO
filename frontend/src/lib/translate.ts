/** Client-side helper that calls our server-side /api/translate proxy (keeps API keys secret). */
export async function translateText(
  text: string,
  target: string,
  source?: string,
): Promise<string> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target, source }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? `Translation failed (${res.status}).`);
  }
  return json.translatedText as string;
}
