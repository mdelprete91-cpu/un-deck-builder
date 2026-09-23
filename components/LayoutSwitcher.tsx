"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import SlideFrame from "@/components/SlideFrame";
import type { BrandTheme } from "@/lib/slides/brand";
import { defaultContent } from "@/lib/slides/defaults";
import { LAYOUTS, renderSlide } from "@/lib/slides/layouts";
import { RELAYOUT_OPTIONS } from "@/lib/slides/prompt";
import { AI_LAYOUT_IDS, normalizeSlide, PRIMARY_ARRAY, type LayoutId, type Slide, type SlideContent } from "@/lib/slides/schema";

interface LayoutSwitcherProps {
  slide: Slide;
  theme: BrandTheme;
  brandId: string;
  brief: string;
  brandLabel: string;
  /** A suggested option, already written: applied as it is, no model call. */
  onApply: (content: SlideContent) => void;
  /** Any other layout: the model moves the text into it. */
  onRewriteTo: (layoutId: LayoutId) => void;
  onClose: () => void;
}

interface Option {
  content: SlideContent;
  reason: string;
}

/** How many items the slide's editable array holds (0 when the layout has none). */
function itemCount(slide: SlideContent): number {
  const primary = PRIMARY_ARRAY[slide.layoutId];
  if (!primary) return 0;
  return ((slide[primary.field] as unknown[] | undefined) ?? []).length;
}

/**
 * "Change layout", in the register of the "Add a slide" picker: the same
 * modal, the same three-column grid of previews. The difference is what the
 * previews show. The top row is the slide's own text, written by the model
 * into a few other layouts of the template, so what you see is what you get
 * and a pick is instant. Below it, every other layout with placeholder
 * content: a pick there sends the slide to the model to be moved.
 */
export default function LayoutSwitcher({
  slide,
  theme,
  brandId,
  brief,
  brandLabel,
  onApply,
  onRewriteTo,
  onClose,
}: LayoutSwitcherProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const items = itemCount(slide);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // One request per opening; the options stream in and land one by one.
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const { id: _id, image: _im, imagePos: _ip, logoTone: _lt, logos: _lg, grid: _gr, map: _mp, ...content } = slide;
    void _id; void _im; void _ip; void _lt; void _lg; void _gr; void _mp;
    (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "relayout", brief, brandLabel, targetSlide: content, format: "slides" }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `Request failed (${res.status})`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { type: string; slide?: Record<string, unknown>; message?: string };
            if (event.type === "slide" && event.slide) {
              const { reason, ...raw } = event.slide;
              const normalized = normalizeSlide(raw, { brandId });
              if (!normalized || normalized.layoutId === slide.layoutId) continue;
              setOptions((list) =>
                list.some((o) => o.content.layoutId === normalized.layoutId)
                  ? list
                  : [...list, { content: normalized, reason: typeof reason === "string" ? reason : "" }],
              );
            } else if (event.type === "error") {
              throw new Error(event.message || "Generation failed");
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
    // The slide is the one the modal opened on: a re-run would only happen
    // on an edit under the modal, which the scrim prevents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);

  // Every AI layout the model was not asked about, with placeholder content.
  // The deck's structure (cover, agenda, divider, closing) is not a place to
  // move text to, so those stay out here as they do in the suggestions.
  const others = useMemo(() => {
    const shown = new Set<string>([slide.layoutId, "cover", "agenda", "section-divider", "thank-you", ...options.map((o) => o.content.layoutId)]);
    return AI_LAYOUT_IDS.filter((id) => !shown.has(id)).map((id) => ({
      id,
      label: LAYOUTS[id].label,
      html: renderSlide({ ...defaultContent(id), id: `preview-${id}` }, theme),
    }));
  }, [slide.layoutId, options, theme]);

  const skeletons = Math.max(0, (loading ? RELAYOUT_OPTIONS : 0) - options.length);

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
            Suggested for this text{items > 1 ? `, ${items} items` : ""}
          </p>
          {error && !options.length && (
            <p className="mb-4 rounded-lg border border-status-red-border bg-status-red-bg p-3 text-xs leading-relaxed text-status-red">{error}</p>
          )}
          {!error && !loading && !options.length && (
            <p className="mb-4 text-sm text-ink-muted">No other layout of the template holds this text as it is.</p>
          )}
          <div className="grid grid-cols-3 gap-6">
            {options.map(({ content, reason }) => {
              const kept = itemCount(content);
              const label = LAYOUTS[content.layoutId].label;
              return (
                <button
                  key={content.layoutId}
                  onClick={() => onApply(content)}
                  title={label}
                  className="group block w-full rounded-2xl text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
                >
                  <div className="pointer-events-none overflow-hidden rounded-2xl shadow-stripe transition-shadow duration-150 group-hover:shadow-float">
                    <SlideFrame html={renderSlide({ ...content, id: `option-${content.layoutId}` }, theme)} className="aspect-video w-full" />
                  </div>
                  <div className="mt-2.5 px-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{label}</span>
                      {items > 1 && (
                        <span className={`shrink-0 text-xs ${kept >= items ? "text-ink-faint" : "text-status-red"}`}>
                          {kept >= items ? `All ${items} items` : `${kept} of ${items} items`}
                        </span>
                      )}
                    </div>
                    {reason && <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{reason}</p>}
                  </div>
                </button>
              );
            })}
            {Array.from({ length: skeletons }).map((_, i) => (
              <div key={`skeleton-${i}`} aria-hidden>
                <div className="aspect-video w-full animate-pulse rounded-2xl bg-canvas" />
                <div className="mt-3 h-3.5 w-1/2 animate-pulse rounded bg-canvas" />
                <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-canvas" />
              </div>
            ))}
          </div>

          <p className="mb-3 mt-8 text-[13px] text-ink-faint">All layouts, moved by AI</p>
          <div className="grid grid-cols-3 gap-6">
            {others.map(({ id, label, html }) => (
              <button
                key={id}
                onClick={() => onRewriteTo(id)}
                title={label}
                className="group block w-full rounded-2xl text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
              >
                <div className="pointer-events-none overflow-hidden rounded-2xl shadow-stripe transition-shadow duration-150 group-hover:shadow-float">
                  <SlideFrame html={html} className="aspect-video w-full" />
                </div>
                <div className="mt-2.5 px-1 text-sm font-medium text-ink">{label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
