"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/**
 * Light, dark or system, for the chrome only. next-themes writes the class on
 * <html> from an inline script before the first paint (no flash), keeps the
 * choice in localStorage and follows the OS live while "system" is selected.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="giga-deck:theme">
      {children}
    </NextThemes>
  );
}
