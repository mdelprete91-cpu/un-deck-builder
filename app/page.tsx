"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { BRANDS } from "@/lib/slides/brand";
import { deckReducer, initialDeckState } from "@/lib/slides/state";
import { normalizeSlide, PRIMARY_ARRAY, type LayoutId, type SlideContent } from "@/lib/slides/schema";
import { renderSlide, LAYOUTS } from "@/lib/slides/layouts";
import { defaultContent } from "@/lib/slides/defaults";
import { loadDeck, saveDeck } from "@/lib/slides/storage";
import { exportHtmlDeck } from "@/lib/slides/export-html";
import { exportPptxDeck } from "@/lib/slides/export-pptx";
import { computeLogoTone } from "@/lib/slides/logo-tone";
import { ICON_LIBRARY, ICON_NAMES } from "@/lib/slides/icons";
import Sidebar from "@/components/Sidebar";
import SlideFrame, { readImageFile } from "@/components/SlideFrame";
import ChartDataPanel from "@/components/ChartDataPanel";
import ThumbStrip from "@/components/ThumbStrip";
import PrintRoot from "@/components/PrintRoot";

/** Layouts whose right-side photo panel runs underneath the footer logo. */
const LOGO_TONE_LAYOUTS = new Set<string>([
  "callout",
  "example-image-right",
  "section-image-deep",
  "section-image-light",
  "section-image-dark",
]);

export default function Studio() {
  const [state, dispatch] = useReducer(deckReducer, initialDeckState);
  const [hydrated, setHydrated] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const theme = BRANDS[state.brandId];
  const active = state.slides[state.activeIndex];

  // Hydrate from localStorage once, then autosave (debounced)
  useEffect(() => {
    const saved = loadDeck();
    if (saved) dispatch({ type: "HYDRATE", state: saved });
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => saveDeck(state), 800);
    return () => clearTimeout(timer);
  }, [state, hydrated]);

  // On layouts where the photo panel sits under the footer logo, pick the
  // white or dark logo from the pixels beneath it (no AI: pure luminance).
  // computeLogoTone caches per image+reframe, so re-runs are cheap; dispatch
  // is by slide id and the reducer no-ops when the tone is unchanged.
  useEffect(() => {
    for (const s of state.slides) {
      if (!LOGO_TONE_LAYOUTS.has(s.layoutId)) continue;
      computeLogoTone(s.image, s.imagePos).then((tone) => {
        if (tone && tone !== s.logoTone) dispatch({ type: "SET_LOGO_TONE", id: s.id, tone });
      });
    }
  }, [state.slides]);

  // Keyboard: Cmd+Z / Cmd+Shift+Z for undo/redo, arrows to move between
  // slides — both skipped while typing in a field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        dispatch({ type: "STEP", delta: 1 });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        dispatch({ type: "STEP", delta: -1 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Streams a generation into the deck; resolves with the number of slides
   * received (0 on error/abort). With `collectInsert`, slides are gathered and
   * inserted in one shot at the model-chosen position (add mode). `preserve`
   * fields are merged back into replaced slides (uploaded images etc.).
   */
  async function runGeneration(
    body: Record<string, unknown>,
    opts: {
      replace: boolean;
      targetIndex?: number;
      collectInsert?: boolean;
      preserve?: Partial<SlideContent>;
    },
  ): Promise<number> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "GENERATION_START", replace: opts.replace });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = 0;
      const collected: SlideContent[] = [];
      let meta: { insertAfter?: number; agenda?: string[] } | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "slide") {
            const content = normalizeSlide(event.slide);
            if (!content) continue;
            if (opts.collectInsert) {
              collected.push(content);
            } else if (opts.targetIndex != null) {
              dispatch({
                type: "REPLACE_SLIDE",
                index: opts.targetIndex,
                content: { ...content, ...opts.preserve },
              });
            } else {
              dispatch({ type: "APPEND_SLIDE", content });
            }
            received++;
          } else if (event.type === "meta") {
            meta = event;
          } else if (event.type === "done") {
            dispatch({ type: "GENERATION_DONE", usage: event.usage });
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Generation failed");
          }
        }
      }
      if (received === 0) throw new Error("The model returned no usable slides. Try rephrasing the prompt.");
      if (opts.collectInsert && collected.length > 0) {
        // Hard cap at the requested count — the model must never inflate the deck
        const cap = typeof body.count === "number" ? body.count : collected.length;
        dispatch({
          type: "INSERT_SLIDES",
          at: meta?.insertAfter ?? null,
          contents: collected.slice(0, cap),
          agenda: meta?.agenda,
        });
      }
      dispatch({ type: "GENERATION_DONE" });
      return received;
    } catch (err) {
      if ((err as Error).name === "AbortError") return 0;
      dispatch({ type: "GENERATION_ERROR", error: (err as Error).message });
      return 0;
    }
  }

  const onGenerate = async () => {
    const brief = state.brief;
    const received = await runGeneration(
      { mode: "generate", brief, count: state.count, brandLabel: theme.label },
      { replace: true },
    );
    // A partnership brief always ships with the two fixed partnership-tier slides.
    if (received > 0 && /partnership/i.test(brief)) dispatch({ type: "INSERT_TIERS" });
  };

  /**
   * Strip fields the model must never see: uploaded images and logos are
   * base64 data URLs (a single photo once blew a request past 350K tokens),
   * and tier grids are meaningless to it.
   */
  const lightSlide = ({ id: _id, image: _im, imagePos: _ip, logoTone: _lt, logos: _lg, grid: _gr, ...content }: (typeof state.slides)[number]) =>
    content;

  const onAddMore = (instruction: string, count: number) =>
    runGeneration(
      {
        mode: "add",
        brief: state.brief,
        instruction,
        count,
        brandLabel: theme.label,
        existingSlides: state.slides.map(lightSlide),
      },
      { replace: false, collectInsert: true },
    );

  const onRegenerateSlide = (instruction: string) => {
    if (!active) return;
    runGeneration(
      {
        mode: "regenerate",
        brief: state.brief,
        brandLabel: theme.label,
        targetSlide: lightSlide(active),
        instruction,
      },
      {
        replace: false,
        targetIndex: state.activeIndex,
        // uploaded assets survive the AI rewrite
        preserve: { image: active.image, imagePos: active.imagePos, logos: active.logos, grid: active.grid, icons: active.icons },
      },
    );
  };

  const onInsertLayout = (layoutId: LayoutId) =>
    dispatch({ type: "INSERT", content: defaultContent(layoutId) });

  const canAddItem =
    !!active &&
    !!PRIMARY_ARRAY[active.layoutId] &&
    ((active[PRIMARY_ARRAY[active.layoutId]!.field] as unknown[] | undefined)?.length ?? 0) <
      PRIMARY_ARRAY[active.layoutId]!.max;
  const onAddItem = () => dispatch({ type: "ADD_ITEM", index: state.activeIndex });

  const isChart = active?.layoutId === "chart-bars" || active?.layoutId === "donut-chart";
  const activeHtml = active ? renderSlide(active, theme) : "";
  const hasImage = activeHtml.includes("data-image");

  const onExportHtml = () => {
    exportHtmlDeck(state.slides, theme, state.slides[0]?.title ?? "giga-deck").catch((err) =>
      dispatch({ type: "GENERATION_ERROR", error: `Export failed: ${err.message}` }),
    );
  };

  const [pptxProgress, setPptxProgress] = useState<string | null>(null);
  // Icon picker: block index of the active slide's icon being changed
  const [iconPicker, setIconPicker] = useState<number | null>(null);
  const onExportPptx = async () => {
    if (pptxProgress) return;
    setPptxProgress("Preparing…");
    try {
      await exportPptxDeck(state.slides, theme, state.slides[0]?.title ?? "giga-deck", (done, total) =>
        setPptxProgress(`Slide ${done} / ${total}`),
      );
    } catch (err) {
      console.error("PPTX export failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "GENERATION_ERROR", error: `PPTX export failed: ${message}` });
    } finally {
      setPptxProgress(null);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
      <Sidebar state={state} dispatch={dispatch} onGenerate={onGenerate} onAddMore={onAddMore} />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {state.slides.length === 0 ? (
          <EmptyState generating={state.status === "generating"} />
        ) : (
          <>
            <Toolbar
              index={state.activeIndex}
              total={state.slides.length}
              layoutLabel={active ? LAYOUTS[active.layoutId]?.label : ""}
              canUndo={state.past.length > 0}
              canRedo={state.future.length > 0}
              onUndo={() => dispatch({ type: "UNDO" })}
              onRedo={() => dispatch({ type: "REDO" })}
              onExportPdf={() => window.print()}
              onExportHtml={onExportHtml}
              onExportPptx={onExportPptx}
              pptxProgress={pptxProgress}
            />
            {dataPanelOpen && active && isChart && (
              <ChartDataPanel
                slide={active}
                onChange={(bars) => dispatch({ type: "SET_BARS", index: state.activeIndex, bars })}
                onClose={() => setDataPanelOpen(false)}
              />
            )}
            <div
              className="relative min-h-0 flex-1 p-6 pb-10"
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) e.preventDefault();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const files = [...e.dataTransfer.files];
                const images = files.filter((f) => f.type.startsWith("image/"));
                if (images.length === 0 && files.length > 0) {
                  dispatch({
                    type: "GENERATION_ERROR",
                    error: "Only images (JPEG/PNG) can be dropped for now. PDF and PPTX import is on the roadmap.",
                  });
                  return;
                }
                for (const f of images) {
                  try {
                    const dataUrl = await readImageFile(f);
                    dispatch({ type: "INSERT", content: { ...defaultContent("photo"), image: dataUrl } });
                  } catch {
                    // unreadable file — skip
                  }
                }
              }}
            >
              {active && (
                <>
                  <SlideFrame
                    html={activeHtml}
                    editable
                    onEdit={(path, value) =>
                      dispatch({ type: "EDIT_FIELD", index: state.activeIndex, path, value })
                    }
                    onDeleteItem={(path) =>
                      dispatch({ type: "DELETE_ITEM", index: state.activeIndex, path })
                    }
                    onAddItem={null}
                    onToggleCell={(row, col) =>
                      dispatch({ type: "TOGGLE_CELL", index: state.activeIndex, row, col })
                    }
                    onPickIcon={(block) => setIconPicker(block)}
                    onUploadLogo={(slug, dataUrl) =>
                      dispatch({ type: "SET_LOGO", index: state.activeIndex, slug, dataUrl })
                    }
                    onImagePos={
                      hasImage
                        ? (pos) => dispatch({ type: "SET_IMAGE_POS", index: state.activeIndex, pos })
                        : null
                    }
                    className="h-full w-full rounded-xl shadow-stripe-lg"
                  />
                  {iconPicker != null && (
                    <IconPickerModal
                      current={active.icons?.[iconPicker]}
                      onPick={(icon) => {
                        dispatch({ type: "SET_ICON", index: state.activeIndex, block: iconPicker, icon });
                        setIconPicker(null);
                      }}
                      onClose={() => setIconPicker(null)}
                    />
                  )}
                  <SlideActions
                    key={active.id}
                    busy={state.status === "generating"}
                    canAddItem={canAddItem}
                    canEditData={isChart}
                    onRegenerate={onRegenerateSlide}
                    onAddItem={onAddItem}
                    onEditData={() => setDataPanelOpen((v) => !v)}
                    canChangeImage={hasImage}
                    onChangeImage={(dataUrl) =>
                      dispatch({ type: "EDIT_FIELD", index: state.activeIndex, path: "image", value: dataUrl })
                    }
                    onDuplicate={() => dispatch({ type: "DUPLICATE", index: state.activeIndex })}
                    onDelete={() => dispatch({ type: "DELETE", index: state.activeIndex })}
                  />
                </>
              )}
            </div>
          </>
        )}
      </main>

      <div className="w-[200px] shrink-0 border-l border-hairline bg-white">
        <ThumbStrip
          slides={state.slides}
          theme={theme}
          activeIndex={state.activeIndex}
          dispatch={dispatch}
          onInsertLayout={onInsertLayout}
        />
      </div>

      <PrintRoot slides={state.slides} theme={theme} />
    </div>
  );
}

/** Lucide icon chooser for icon-card slides, opened by clicking a card's icon. */
function IconPickerModal({
  current,
  onPick,
  onClose,
}: {
  current?: string;
  onPick: (icon: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6"
      onClick={onClose}
    >
      <div
        className="pop-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-stripe-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-manrope mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-giga">
          Choose an icon
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {ICON_NAMES.map((name) => (
            <button
              key={name}
              title={name}
              onClick={() => onPick(name)}
              className={`flex h-12 items-center justify-center rounded-lg border transition-colors duration-150 ${
                current === name
                  ? "border-giga bg-giga-tint"
                  : "border-transparent hover:border-giga-100 hover:bg-canvas"
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#277AFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: ICON_LIBRARY[name] }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ generating }: { generating: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {generating ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-giga border-t-transparent" />
          <p className="text-sm text-ink-muted">Generating your deck…</p>
        </>
      ) : (
        <>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-giga-tint text-giga">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M12 17v3M8 20h8" />
            </svg>
          </div>
          <p className="max-w-xs text-center text-sm leading-relaxed text-ink-muted">
            Describe your story in the prompt box and hit Generate. Slides appear here as they are
            created.
          </p>
        </>
      )}
    </div>
  );
}

function Toolbar({
  index,
  total,
  layoutLabel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportPdf,
  onExportHtml,
  onExportPptx,
  pptxProgress,
}: {
  index: number;
  total: number;
  layoutLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onExportPptx: () => void;
  pptxProgress: string | null;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  useEffect(() => {
    if (!exportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen]);
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-giga-tint disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-white px-6 py-2.5">
      <span className="font-manrope text-sm font-semibold tracking-[-0.01em] text-ink">
        Slide {index + 1} / {total}
      </span>
      <span className="rounded-full bg-giga-tint px-2.5 py-0.5 text-xs font-semibold text-giga">
        {layoutLabel}
      </span>
      <div className="flex items-center">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Cmd+Z)" className={iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)" className={iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </button>
      </div>
      <span className="text-xs text-ink-muted">Click text to edit · drag a photo to reframe, scroll to zoom</span>
      <div className="relative ml-auto">
        <button
          onClick={() => setExportOpen((v) => !v)}
          className="font-manrope flex h-9 items-center gap-1.5 rounded-full bg-giga px-4 text-xs font-semibold text-white shadow-stripe-md transition-all duration-150 hover:bg-giga-deep active:scale-[0.98]"
        >
          {pptxProgress ? `Exporting ${pptxProgress}` : "Export"}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${exportOpen ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {exportOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
            <div className="pop-in absolute right-0 z-20 mt-1.5 w-48 rounded-xl border border-hairline bg-white p-1 shadow-float">
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink transition-colors duration-100 hover:bg-giga-tint"
              >
                PDF
                <span className="mt-0.5 block font-normal text-ink-muted">Print-ready, one page per slide</span>
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportHtml();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink transition-colors duration-100 hover:bg-giga-tint"
              >
                HTML deck
                <span className="mt-0.5 block font-normal text-ink-muted">Standalone file with animations</span>
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportPptx();
                }}
                disabled={pptxProgress != null}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink transition-colors duration-100 hover:bg-giga-tint disabled:pointer-events-none disabled:opacity-50"
              >
                PowerPoint
                <span className="mt-0.5 block font-normal text-ink-muted">
                  {pptxProgress ? `Exporting… ${pptxProgress}` : ".pptx, slides as full-quality images"}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Floating contextual actions for the active slide: a pill bar hovering over
 * the canvas with the AI edit (expanding input), element/data actions, and
 * slide management. Keyed by slide id so state resets on slide change.
 */
function SlideActions({
  busy,
  canAddItem,
  canEditData,
  canChangeImage,
  onRegenerate,
  onAddItem,
  onEditData,
  onChangeImage,
  onDuplicate,
  onDelete,
}: {
  busy: boolean;
  canAddItem: boolean;
  canEditData: boolean;
  canChangeImage: boolean;
  onRegenerate: (instruction: string) => void;
  onAddItem: () => void;
  onEditData: () => void;
  onChangeImage: (dataUrl: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    if (busy) return;
    onRegenerate(instruction);
    setInstruction("");
    setAiOpen(false);
  };
  const action =
    "flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-ink transition-colors duration-150 hover:bg-giga-tint disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="float-in pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center">
      {/* Glow and pill bob together; the glow sits behind the white pill */}
      <div className={`${aiOpen || busy ? "" : "float-idle "}pointer-events-auto relative`}>
        <div aria-hidden className="rainbow-glow" />
        <div className="relative flex items-center gap-0.5 rounded-full border border-giga-100 bg-white p-1.5 shadow-float">
        {busy ? (
          <div className="flex h-10 items-center gap-2.5 px-4 text-[13px] font-semibold text-giga">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.56" />
            </svg>
            Generating…
          </div>
        ) : aiOpen ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#277AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-2.5 shrink-0">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
              <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
            </svg>
            <input
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setAiOpen(false);
              }}
              placeholder="Describe how to redo this slide…"
              className="w-80 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-muted/70"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="font-manrope h-10 rounded-full bg-giga px-4 text-xs font-semibold text-white transition-all duration-150 hover:bg-giga-deep active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {busy ? "Working…" : "Regenerate"}
            </button>
            <button onClick={() => setAiOpen(false)} title="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-giga-tint hover:text-ink">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setAiOpen(true)} disabled={busy} className={`${action} text-giga hover:bg-giga-tint`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
              </svg>
              Edit with AI
            </button>
            <span className="h-5 w-px bg-hairline" />
            <button onClick={onAddItem} disabled={!canAddItem} title="Add an element to this slide" className={action}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Element
            </button>
            {canEditData && (
              <button onClick={onEditData} title="Edit the chart data in a table" className={action}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8" />
                </svg>
                Data
              </button>
            )}
            {canChangeImage && (
              <button onClick={() => imageInputRef.current?.click()} title="Upload a different image for this slide" className={action}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </svg>
                Image
              </button>
            )}
            <span className="h-5 w-px bg-hairline" />
            <button onClick={onDuplicate} title="Duplicate slide" className={`${action} w-10 justify-center px-0`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="8" width="13" height="13" rx="2" />
                <path d="M16 4H6a2 2 0 0 0-2 2v10" />
              </svg>
            </button>
            <button onClick={onDelete} title="Delete slide" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-status-red/10 hover:text-status-red">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          </>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              onChangeImage(await readImageFile(file));
            } catch {
              // unreadable file — ignore
            }
          }}
        />
        </div>
      </div>
    </div>
  );
}
