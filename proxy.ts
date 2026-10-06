import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sameSecret, sessionToken } from "@/lib/auth/session";

/**
 * Every page and API call needs the session cookie (lib/auth/session.ts),
 * except the login page and its route. Without it a page goes to /login and
 * an API call gets a 401. Files with an extension (fonts, logos, library
 * photos, help videos) are left out by the matcher. With no SITE_PASSWORD
 * set, the gate is off: development runs without it.
 */
export async function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && sameSecret(cookie, await sessionToken(password))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return new NextResponse("Sign in first", { status: 401 });
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
