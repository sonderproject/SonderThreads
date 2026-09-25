import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // ~several minutes of compressed speech; commands are seconds long

/**
 * Speech-to-text for voice commands on devices without built-in speech
 * recognition (notably iPhone home-screen apps). Behind the password gate
 * via middleware, so strangers can't run up the transcription bill.
 * Returns 501 when OPENAI_API_KEY isn't configured.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice transcription isn't set up yet." }, { status: 501 });
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  }

  const ext = audio.type.includes("mp4") || audio.type.includes("aac") ? "m4a" : "webm";
  const upstream = new FormData();
  upstream.append("file", audio, `voice.${ext}`);
  upstream.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });

  if (!res.ok) {
    console.error("[transcribe] OpenAI error", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "Couldn't transcribe that — try again." }, { status: 502 });
  }

  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: data.text ?? "" });
}
