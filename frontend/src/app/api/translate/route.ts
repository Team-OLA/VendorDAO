import { NextResponse } from "next/server";
import { translateWithGoogle } from "@/lib/server/translateProvider";

const MAX_TEXT_LENGTH = 5000;

export async function POST(request: Request) {
  let body: { text?: string; target?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, target, source } = body;
  if (!text || !target) {
    return NextResponse.json({ error: '"text" and "target" are required.' }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_TEXT_LENGTH} characters).` },
      { status: 413 },
    );
  }

  try {
    const result = await translateWithGoogle(text, target, source);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Translate API error:", err);
    const message = err instanceof Error ? err.message : "Translation failed.";
    const status = message.includes("not configured") ? 501 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
