"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import SlideFrame from "@/components/SlideFrame";
import type { BrandTheme } from "@/lib/slides/brand";
import { switchTargets } from "@/lib/slides/families";
import { renderSlide } from "@/lib/slides/layouts";
import type { Slide, SlideContent } from "@/lib/slides/schema";

interface LayoutSwitcherProps {
  slide: Slide;
  theme: BrandTheme;
  onApply: (content: SlideContent) => void;
  onClose: () => void;
}

/**
 * "Change layout", in the register of the "Add a slide" picker: the same
 * modal, the same three-column grid of previews. Every card is this slide,
 * text and photo included, rendered in another layout of its family
 * (lib/slides/families.ts), so what you see is what a pick gives, at once
 * and with no model call. The captions say what each layout does, how many
 * of the slide's items it shows, and whether the text had to shrink to fit
 * (the preview runs the same autofit as the editor and reports it).
 */
export default function LayoutSwitcher({ slide, theme, onApply, onClose }: LayoutSwitcherProps) {
  const [shrunk, setShrunk] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { id: _id, ...content } = slide;
  void _id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const targets = useMemo(() => switchTargets(content), [slide]);
  const total = targets[0]?.total ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-scrim" />
      <div
        className="pop-in relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline-light px-7 py-5">
          <h2 className="text-xl font-medium text-ink">Change layout</h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>
        <div className="flex-1 overflow-y-auto p-7">
          <p className="mb-3 text-[13px] text-ink-faint">
            The same text in other layouts{total > 1 ? `, ${total} items` : ""}
          </p>
          {!targets.length && (
            <p className="text-sm text-ink-muted">No other layout of the template holds this slide as it is.</p>
          )}
          <div className="grid grid-cols-3 gap-6">
            {targets.map(({ layoutId, label, note, keeps }) => {
              const preview = { ...content, layoutId, id: `option-${layoutId}` };
              const badges: { text: string; warn: boolean }[] = [];
              if (total > 1) badges.push(keeps >= total ? { text: `All ${total} items`, warn: false } : { text: `${keeps} of ${total} items`, warn: true });
              if (shrunk[layoutId]) badges.push({ text: "Text shrinks", warn: true });
              return (
                <button
                  key={layoutId}
                  onClick={() => onApply({ ...content, layoutId })}
                  title={label}
                  className="group block w-full rounded-2xl text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
                >
                  <div className="pointer-events-none overflow-hidden rounded-2xl shadow-stripe transition-shadow duration-150 group-hover:shadow-float">
                    <SlideFrame
                      html={renderSlide(preview, theme)}
                      className="aspect-video w-full"
                      onAutofit={(n) =>
                        setShrunk((map) => (map[layoutId] === n > 0 ? map : { ...map, [layoutId]: n > 0 }))
                      }
                    />
                  </div>
                  <div className="mt-2.5 px-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{label}</span>
                      {badges.length > 0 && (
                        <span className="flex shrink-0 gap-2 text-xs">
                          {badges.map((b) => (
                            <span key={b.text} className={b.warn ? "text-status-red" : "text-ink-faint"}>
                              {b.text}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{note}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
