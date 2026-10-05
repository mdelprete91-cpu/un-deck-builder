export const runtime = "nodejs";

/**
 * A public Google Sheet as .xlsx bytes, for the chart import (Mario, 5 Oct
 * 2026). Google sends no CORS headers, so the browser cannot read the export
 * itself; this fetches it and the client reads it with the same workbook
 * reader as an uploaded file (readWorkbook in lib/slides/attachments.ts),
 * every sheet included. Only docs.google.com/spreadsheets links: this is not
 * a general proxy. A sheet that is not shared publicly answers with Google's
 * sign-in page, which is said in plain words.
 */
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5_000_000;
const SHEET_URL = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/;

export async function POST(request: Request): Promise<Response> {
  let body: { url?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const id = SHEET_URL.exec(url)?.[1];
  if (!id) return new Response("Paste a Google Sheets link: https://docs.google.com/spreadsheets/d/…", { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { redirect: "follow", signal: controller.signal });
    const type = res.headers.get("content-type") ?? "";
    // A private sheet redirects to the sign-in page: HTML, not a workbook.
    if (!res.ok || type.includes("text/html")) {
      return new Response("This sheet isn't shared publicly. In Google Sheets, set Share to “Anyone with the link can view” and try again.", { status: 403 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new Response("This sheet is too large to import (5 MB at most).", { status: 413 });
    // The sheet's title, from the download's file name, to name the link in the panel.
    const disposition = res.headers.get("content-disposition") ?? "";
    const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="([^"]+)"/i.exec(disposition)?.[1] ?? "Google Sheet").replace(/\.xlsx$/i, "");
    return new Response(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "X-Sheet-Name": encodeURIComponent(name.slice(0, 120)) } });
  } catch {
    return new Response("Could not reach Google Sheets. Check the link and try again.", { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
