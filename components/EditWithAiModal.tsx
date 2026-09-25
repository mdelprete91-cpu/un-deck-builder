"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import { LAYOUTS } from "@/lib/slides/layouts";
import { switchTargets } from "@/lib/slides/families";
import type { LayoutId, Slide } from "@/lib/slides/schema";

const INPUT =
  "block w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15";

/**
 * "Edit with AI" (Mario, 25 Sep 2026): a dialog instead of the input that
 * used to open inside the slide bar. It asks two things: what should change
 * in the words, and whether the slide should move to another layout of its
 * family (the model-free switch, listed as rows: label, note, and how many of
 * the slide's items the layout shows). Either alone is enough. It also says
 * the one thing people kept trying: the AI never touches a photo; images
 * change from the bar's Image button.
 *
 * Same box as the other dialogs: 576px, the scrim, the chrome's tokens.
 */
export default function EditWithAiModal({
  slide,
  onSubmit,
  onClose,
}: {
  slide: Slide;
  /** The instruction (may be empty) and the layout to move to (null = keep). */
  onSubmit: (instruction: string, layoutId: LayoutId | null) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [layoutId, setLayoutId] = useState<LayoutId | null>(null);
  const { id: _id, ...content } = slide;
  void _id;
  const targets = useMemo(() => switchTargets(content), [slide]); // eslint-disable-line react-hooks/exhaustive-deps
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="edit-ai-title"
        className="pop-in flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <h2 id="edit-ai-title" className="flex items-center gap-2 text-xl font-medium text-ink">
            <Sparkles size={18} className="shrink-0 text-giga" aria-hidden />
            Edit with AI
          </h2>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        <div className="min-h-0 overflow-y-auto px-6 pb-2 pt-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">What should change?</span>
            <textarea
              autoFocus
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="E.g. make it about the northern counties, three points instead of four, shorter title"
              className={`${INPUT} mt-2 resize-y`}
            />
          </label>

          {targets.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-ink">Layout</p>
              <p className="mt-0.5 text-[13px] text-ink-muted">The same words in another layout of this family. No AI call for this part.</p>
              <div role="radiogroup" aria-label="Layout" className="mt-3 flex flex-col gap-1">
                {[
                  { layoutId: null as LayoutId | null, label: `Keep ${LAYOUTS[slide.layoutId]?.label ?? "the current layout"}`, note: "As it is now", keeps: 0, total: 0 },
                  ...targets,
                ].map((t) => {
                  const picked = layoutId === t.layoutId;
                  const partial = t.total > 0 && t.keeps < t.total;
                  return (
                    <button
                      key={t.layoutId ?? "keep"}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      onClick={() => setLayoutId(t.layoutId)}
                      className={`flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                        picked ? "bg-giga-tint text-giga" : "text-ink hover:bg-mist"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-100 ${
                          picked ? "border-giga bg-giga text-white" : "border-mist-deep bg-surface"
                        }`}
                      >
                        {picked && <Check size={11} strokeWidth={3} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{t.label}</span>
                        <span className={`block text-xs ${picked ? "text-giga/80" : "text-ink-muted"}`}>{t.note}</span>
                      </span>
                      {partial && (
                        <span className="shrink-0 rounded-full bg-status-red/10 px-2 py-0.5 text-[11px] font-medium text-status-red">
                          {t.keeps} of {t.total} items
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-5 rounded-xl bg-canvas-2 px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            The AI rewrites the words and can move the slide to another layout. It never edits photos or images: to change one, use Image in the bar or click the picture on the slide.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">
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
