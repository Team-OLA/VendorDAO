export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

/**
 * Calls the Google Cloud Translation API (v2, API-key auth) from the server only.
 * Swap this function out to point at Azure Translator, DeepL, LibreTranslate, etc.
 * without changing any client code, since the client only ever calls our own
 * `/api/translate` route.
 */
export async function translateWithGoogle(
  text: string,
  target: string,
  source?: string,
): Promise<TranslateResult> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_TRANSLATE_API_KEY is not configured on the server. See .env.local.example.",
    );
  }

  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, target, format: "text", ...(source ? { source } : {}) }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Translate request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const translation = json?.data?.translations?.[0];
  if (!translation) {
    throw new Error("Unexpected response shape from Google Translate.");
  }

  return {
    translatedText: translation.translatedText,
    detectedSourceLanguage: translation.detectedSourceLanguage,
  };
}
