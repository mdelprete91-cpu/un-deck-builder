"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Presentation mode (Mario, 26 Sep 2026): the exported HTML deck, the very
 * file Download writes, shown in a full-screen frame from the slide on
 * screen, with its entrance animations, arrow keys, space and click to
 * advance. The page itself goes full screen on the Play press (a browser
 * only allows that inside the click), and leaving full screen (Esc) ends
 * the presentation. Where full screen is refused, the frame still covers
 * the window and the ✕ in the corner closes it.
 */
export default function Presenter({ src, onClose }: { src: string | null; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-[#111]" role="dialog" aria-label="Presentation">
      {src ? (
        <iframe
          ref={frameRef}
          src={src}
          title="Presentation"
          className="h-full w-full border-0"
          onLoad={() => frameRef.current?.contentWindow?.focus()}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/60">Preparing the presentation…</div>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close presentation (Esc)"
        title="Close (Esc)"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/30"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
