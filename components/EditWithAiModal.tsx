"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import SlideFrame from "@/components/SlideFrame";
import type { BrandTheme } from "@/lib/slides/brand";
import { LAYOUTS, renderSlide } from "@/lib/slides/layouts";
import { switchTargets } from "@/lib/slides/families";
import type { LayoutId, Slide } from "@/lib/slides/schema";

const INPUT =
  "block w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15";

/**
 * "Edit with AI" (Mario, 25 Sep 2026): a dialog instead of the input that
 * used to open inside the slide bar. It asks two things: what should change
 * in the words, and whether the slide should move to another layout of its
 * family. The layouts are shown, not named (a name says nothing): the
 * slide itself rendered in each one, in the layout switcher's grid, the
 * current one first; the picked card is ringed in Ink like every picked
 * layout in the chrome, and a card that shows fewer items or shrinks its
 * text says so. Either an instruction or a layout is enough. It also says
 * the one thing people kept trying: the AI never touches a photo; images
 * change from the bar's Image button or a click on the picture.
 */
export default function EditWithAiModal({
  slide,
  theme,
  onSubmit,
  onClose,
}: {
  slide: Slide;
  theme: BrandTheme;
  /** The instruction (may be empty) and the layout to move to (null = keep). */
  onSubmit: (instruction: string, layoutId: LayoutId | null) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [layoutId, setLayoutId] = useState<LayoutId | null>(null);
  const [shrunk, setShrunk] = useState<Record<string, boolean>>({});
  const { id: _id, ...content } = slide;
  void _id;
  // Only layouts that carry every item of the slide (Mario, 26 Sep 2026): a
  // layout that would drop two of four cards is not a suggestion.
  const targets = useMemo(() => switchTargets(content).filter((t) => t.keeps >= t.total), [slide]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = targets[0]?.total ?? 0;
  const canSubmit = instruction.trim().length > 0 || layoutId !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (canSubmit) onSubmit(instruction.trim(), layoutId);
  };

  const cards: { layoutId: LayoutId | null; label: string; note: string; keeps: number }[] = [
    { layoutId: null, label: LAYOUTS[slide.layoutId]?.label ?? "Current layout", note: "As it is now", keeps: total },
    ...targets.map((t) => ({ layoutId: t.layoutId as LayoutId | null, label: t.label, note: t.note, keeps: t.keeps })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="edit-ai-title"
        className="pop-in flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline-light px-7 py-5">
          <h2 id="edit-ai-title" className="flex items-center gap-2 text-xl font-medium text-ink">
            <Sparkles size={18} className="shrink-0 text-giga" aria-hidden />
            Edit with AI
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <label className="block">
            <span className="text-sm font-medium text-ink">What should change?</span>
            <textarea
              autoFocus
              rows={2}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="E.g. make it about the northern counties, three points instead of four, shorter title"
              className={`${INPUT} mt-2 resize-y`}
            />
          </label>

          {targets.length > 0 && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium text-ink">Layout</p>
                <p className="text-[13px] text-ink-faint">
                  The words of this slide in each layout of its family{total > 1 ? `, ${total} items` : ""}. No AI call for this part.
                </p>
              </div>
              <div role="radiogroup" aria-label="Layout" className="mt-3 grid grid-cols-3 gap-5">
                {cards.map((c) => {
                  const picked = layoutId === c.layoutId;
                  const id = c.layoutId ?? slide.layoutId;
                  const preview = { ...content, layoutId: id, id: `edit-ai-${id}` };
                  const badges: { text: string; warn: boolean }[] = [
                    ...(c.layoutId === null
                      ? [{ text: "Current", warn: false }]
                      : total > 1
                        ? [c.keeps >= total ? { text: `All ${total} items`, warn: false } : { text: `${c.keeps} of ${total} items`, warn: true }]
                        : []),
                    ...(c.layoutId !== null && shrunk[id] ? [{ text: "Text shrinks", warn: true }] : []),
                  ];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      onClick={() => setLayoutId(c.layoutId)}
                      title={c.label}
                      className="group block w-full rounded-2xl text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
                    >
                      {/* The picked card is ringed in Ink, like every picked layout in the chrome. */}
                      <div
                        className={`pointer-events-none overflow-hidden rounded-2xl transition-shadow duration-150 ${
                          picked ? "ring-2 ring-ink shadow-float" : "shadow-stripe group-hover:shadow-float"
                        }`}
                      >
                        <SlideFrame
                          html={renderSlide(preview, theme)}
                          className="aspect-video w-full"
                          onAutofit={(n) => setShrunk((map) => (map[id] === n > 0 ? map : { ...map, [id]: n > 0 }))}
                        />
                      </div>
                      <div className="mt-2.5 px-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-sm font-medium ${picked ? "text-ink" : "text-ink"}`}>{c.label}</span>
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
                        <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{c.note}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-6 rounded-xl bg-canvas-2 px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            The AI rewrites the words and can move the slide to another layout. It never edits photos or images: to change one, use Image in the bar or click the picture on the slide.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline-light px-7 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Sparkles} onClick={submit} disabled={!canSubmit} title="⌘↵">
            {instruction.trim() || layoutId === null ? "Rewrite" : "Apply layout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
