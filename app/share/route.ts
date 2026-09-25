import { NextResponse } from "next/server";

/**
 * Android share-sheet target (see share_target in app/manifest.ts): puts
 * whatever was shared into the command bar, ready to edit and send.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = ["title", "text", "url"]
    .map((k) => searchParams.get(k)?.trim())
    .filter((v, i, all): v is string => !!v && all.indexOf(v) === i)
    .join(" ")
    .slice(0, 2000);
  const target = new URL("/", request.url);
  if (text) target.searchParams.set("compose", text);
  return NextResponse.redirect(target);
}
