import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, sameSecret, sessionToken } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Checks the password and sets the session cookie (lib/auth/session.ts). */
export async function POST(request: Request): Promise<Response> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });
  let given = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    given = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }
  if (!sameSecret(given, password)) {
    // A small delay so the form is no use for guessing.
    await new Promise((r) => setTimeout(r, 600));
    return new NextResponse("Wrong password", { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
