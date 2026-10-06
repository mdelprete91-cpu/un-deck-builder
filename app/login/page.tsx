"use client";

import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import Button from "@/components/Button";

/**
 * The password gate's one screen (Mario, 6 Oct 2026): the lockup, a password
 * field and Sign in, on the editor's own surfaces. A wrong password says so
 * under the field; the right one goes back to the page that was asked for.
 */
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "That password is not right." : "Could not sign in. Try again.");
        setBusy(false);
        return;
      }
      // Only a path on this site: never an address handed in from outside.
      const next = new URLSearchParams(window.location.search).get("next") ?? "/";
      window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("Could not sign in. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <form onSubmit={submit} className="pop-in w-full max-w-sm rounded-3xl bg-surface p-7 shadow-float">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/unicef-digital-impact-unboxed.svg" alt="UNICEF Digital Impact Division" className="h-11 w-auto dark:brightness-0 dark:invert" />
        <h1 className="mt-6 text-xl font-medium text-ink">UNICEF Deck Builder</h1>
        <p className="mt-1 text-sm text-ink-muted">Enter the team password to continue.</p>
        <label className="mt-5 block">
          <span className="sr-only">Password</span>
          <span className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 transition-shadow duration-150 focus-within:border-giga focus-within:ring-[3px] focus-within:ring-giga/15">
            <LockKeyhole size={16} className="shrink-0 text-ink-muted" aria-hidden />
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Password"
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </span>
        </label>
        {error && (
          <p id="login-error" role="alert" className="mt-2 text-[13px] text-status-red">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={!password || busy} className="mt-4 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
