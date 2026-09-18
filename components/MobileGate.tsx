"use client";

import { Check, Link, Monitor } from "lucide-react";
import { useState } from "react";
import Button from "@/components/Button";

/**
 * The editor needs a wide screen: a sidebar, the slide at a readable size
 * and the filmstrip side by side. Under 1024px the layout has nowhere to go,
 * and people opening the link on a phone reported the tool as broken.
 *
 * So below that width this screen covers the editor and says so plainly,
 * with one useful thing to do: copy the link for later on a computer. It is
 * gated by viewport width in CSS (`lg:hidden`), not by user agent, so a tablet
 * in landscape or a phone that is somehow wide enough still gets the editor,
 * and there is no flicker on hydration. The editor keeps rendering underneath:
 * nothing is lost by turning the device or resizing the window.
 */
export default function MobileGate() {
  const [copied, setCopied] = useState(false);
  /** Set when the clipboard is refused (an in-app browser, say): the link is shown instead. */
  const [shown, setShown] = useState<string | null>(null);
  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShown(url);
    }
  };
  return (
    <div
      role="dialog"
      aria-labelledby="mobile-gate-title"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-canvas px-6 text-center lg:hidden"
    >
      <Monitor size={28} className="text-ink-faint" aria-hidden />
      <div className="flex flex-col gap-2">
        <h1 id="mobile-gate-title" className="text-xl font-medium text-ink">
          Giga Deck Builder works on desktop
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
          The editor needs a large screen for the slides and their controls. Open this link on your
          computer to build a deck.
        </p>
      </div>
      <Button variant="secondary" icon={copied ? Check : Link} onClick={copy}>
        {copied ? "Link copied" : "Copy link"}
      </Button>
      {shown && (
        <p className="max-w-full break-all text-xs text-ink-muted select-all">{shown}</p>
      )}
    </div>
  );
}
