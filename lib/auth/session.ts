/**
 * The password gate (Mario, 6 Oct 2026: a login with a password only). One
 * shared password, SITE_PASSWORD in the environment, never in the code. A
 * signed-in browser carries a session cookie whose value is derived from
 * the password, so changing the password signs everyone out. Web Crypto
 * only, so the same code runs in the proxy and in the route.
 */
export const SESSION_COOKIE = "udb_session";
/** Thirty days. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** The cookie value for a password: a SHA-256 of it with a fixed prefix, hex. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`un-deck-builder session:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Equal strings, compared in constant time. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
