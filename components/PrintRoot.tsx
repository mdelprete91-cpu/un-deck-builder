"use client";

import { useEffect, useRef } from "react";
import { isPage, type Slide } from "@/lib/slides/schema";
import type { BrandTheme } from "@/lib/slides/brand";
import { renderSlide } from "@/lib/slides/layouts";
import { autofitAll } from "@/lib/slides/autofit";

/** Full-size copies of every slide, visible only when printing. */
export default function PrintRoot({ slides, theme }: { slides: Slide[]; theme: BrandTheme }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Autofit long edited text before printing (the print root is display:none
  // on screen, so measuring only works inside the beforeprint window).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onBeforePrint = () => {
      // Force the hidden root measurable for a synchronous autofit pass.
      root.style.display = "block";
      autofitAll(root);
      root.style.display = "";
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [slides, theme]);

  return (
    <div id="print-root" ref={rootRef}>
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          // A two-pager page prints from the named A4 @page rule; a slide keeps
          // the 1920x1080 sheet. The class is what picks the paper size.
          className={isPage(slide) ? "print-page slide-root page-root" : "print-slide slide-root"}
          dangerouslySetInnerHTML={{
            __html: renderSlide(slide, theme, { index: i, total: slides.length }),
          }}
        />
      ))}
    </div>
  );
}
