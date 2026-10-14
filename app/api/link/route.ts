import { fetchPage } from "@/lib/slides/links-server";

export const runtime = "nodejs";
export const maxDuration = 40;

/**
 * One link of the brief read as the user writes it (Mario, 14 Oct 2026), so
 * the composer can show what the deck will draw on: its host, title and date,
 * or that it could not be read. The text goes back cut, for the brief's
 * questions; generate reads the page again in full. No model call.
 */
export async function POST(request: Request): Promise<Response> {
  let url = "";
  try {
    url = String(((await request.json()) as { url?: unknown }).url ?? "").slice(0, 2000);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  let host = "";
  try {
    host = new URL(url).host.replace(/^www\./, "");
  } catch {
    return Response.json({ url, ok: false, reason: "not a web address" });
  }
  const page = await fetchPage(url).catch(() => null);
  if (!page || page.kind !== "text") return Response.json({ url, host, ok: false, reason: "the page could not be read" });
  const title = page.text.split("\n").map((l) => l.trim()).find((l) => l.length > 3)?.slice(0, 120) ?? host;
  return Response.json(
    { url, host, ok: true, title, published: page.published, chars: page.text.length, excerpt: page.text.slice(0, 6000) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
