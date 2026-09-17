"use client";

import { ChartColumn, ChevronDown, Copy, History, Image as ImageIcon, LoaderCircle, Plus, Redo2, Trash2, Undo2, Upload, X } from "lucide-react";
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { BRANDS } from "@/lib/slides/brand";
import { DEFAULT_DECK_NAME, deckReducer, initialDeckState, readPath } from "@/lib/slides/state";
import { isPage, normalizeSlide, PRIMARY_ARRAY, type LayoutId, type SlideContent } from "@/lib/slides/schema";
import { renderSlide } from "@/lib/slides/layouts";
import { A4_PX } from "@/lib/slides/pages/a4";
import { PAGE_BLOCK_LIMITS, type PageBlock } from "@/lib/slides/pages/schema";
import { defaultContent } from "@/lib/slides/defaults";
import { presetStack } from "@/lib/slides/pages/presets";
import { clearSaved, openSession, saveDeck } from "@/lib/slides/storage";
import { exportHtmlDeck } from "@/lib/slides/export-html";
import { exportPptxDeck } from "@/lib/slides/export-pptx";
import { exportPageDoc } from "@/lib/slides/export-page-html";
import { parseDeckFile } from "@/lib/slides/deck-file";
import { computeLogoTone, FULL_BLEED_TONE, RIGHT_PANEL_TONE, type ToneGeometry } from "@/lib/slides/logo-tone";
import { ICON_LIBRARY, ICON_NAMES } from "@/lib/slides/icons";
import Button from "@/components/Button";
import Sidebar from "@/components/Sidebar";
import SlideFrame, { readImageFile } from "@/components/SlideFrame";
import ChartDataPanel from "@/components/ChartDataPanel";
import ImagePickerModal from "@/components/ImagePickerModal";
import {
  AttachmentError,
  MAX_ATTACHMENTS,
  MAX_REQUEST_BYTES,
  MAX_TEXT_TOTAL,
  readAttachment,
  totalAttachmentBytes,
  type Attachment,
} from "@/lib/slides/attachments";
import { mapSlotFor } from "@/lib/giga-maps/slot";
import ThumbStrip from "@/components/ThumbStrip";
import PrintRoot from "@/components/PrintRoot";
import Tour, { type TourStep } from "@/components/Tour";
import DeckName from "@/components/DeckName";
import type { DeckState } from "@/lib/slides/state";

/**
 * Layouts whose photo runs underneath the footer, mapped to the geometry that
 * decides the logo tone: the right-side panel for most, the whole frame for the
 * full-bleed image.
 */
const LOGO_TONE_LAYOUTS = new Map<string, ToneGeometry>([
  ["callout", RIGHT_PANEL_TONE],
  ["example-image-right", RIGHT_PANEL_TONE],
  ["section-image-deep", RIGHT_PANEL_TONE],
  ["section-image-light", RIGHT_PANEL_TONE],
  ["section-image-dark", RIGHT_PANEL_TONE],
  ["photo-full", FULL_BLEED_TONE],
]);

/** The two layouts the "Chapters" toggle governs. */
const CHAPTER_LAYOUTS = new Set<string>(["agenda", "section-divider"]);

/**
 * The worked example under the tour's brief step. One card, not a good/bad
 * pair: the step is anchored to the prompt box, and two cards do not fit in
 * the space below it without putting the tour's own buttons out of reach.
 */
function BriefExample() {
  return (
    <div className="mt-3 rounded-xl bg-canvas-2 p-3">
      <span className="mb-0.5 block text-[13px] font-normal text-ink-faint">
        A brief that works
      </span>
      <p className="text-xs leading-relaxed text-ink">
        A partnership pitch to a Kenyan telecom operator, in 10 slides: what Giga is, the gap in
        real numbers, our ask, and what they get back.
      </p>
    </div>
  );
}

/**
 * Phase one, on an empty editor: what the tool does, then the two controls
 * that decide what comes out of it. It stops at Generate because everything
 * past that point is chrome that has not rendered yet.
 */
const INTRO_STEPS: TourStep[] = [
  {
    title: "You describe the deck. The template does the design.",
    body: "Every slide comes from the approved Giga Slides template. The AI only picks which slides your story needs and writes the words, so a deck cannot come out off brand.",
  },
  {
    target: "prompt",
    title: "Write the brief here",
    body: "Dense, not long. Give the story, the audience and the real numbers, and cut the filler: more context makes a better deck, more words don't.",
  },
  {
    target: "prompt",
    title: "And say how many slides",
    body: "Ask for a count in the brief itself, like “in 10 slides”. Without one the AI decides.",
    extra: <BriefExample />,
  },
  {
    target: "chapters",
    title: "Chapters, only if the deck needs them",
    body: "On, the deck opens with an agenda and splits into sections. Off, it runs straight through. It applies to the next deck you generate, never to the one already on screen.",
  },
  {
    target: "generate",
    title: "Then generate",
    body: "Slides appear one by one as they are written. Nothing is final: every word on every slide can be edited afterwards.",
  },
];

/**
 * Phase two, once a deck is on screen, in the order the work happens: edit
 * what the AI wrote, redo a slide, add one, take the deck with you. Every
 * target below is chrome that only renders with slides.
 */
const EDITOR_STEPS: TourStep[] = [
  {
    target: "canvas",
    title: "Edit straight on the slide",
    body: "Click any text to rewrite it. It resizes itself to fit. Drag a photo to reframe it, scroll to zoom.",
  },
  {
    target: "slide-bar",
    title: "The bar follows the slide",
    body: "Redo the whole slide with a one-line instruction, add an element, swap the image, duplicate or delete. It always acts on the slide on screen.",
  },
  {
    target: "add-slides",
    title: "Add slides as you go",
    body: "Describe what is missing and the AI writes it, picks where it belongs and updates the agenda. Nothing already on screen is touched.",
  },
  {
    target: "download",
    title: "Download is the save",
    body: "Nothing is stored on a server. Download the HTML deck before you close the tab, then use Upload next to it to reopen the file here and keep editing.",
  },
];

export default function Studio() {
  const [state, dispatch] = useReducer(deckReducer, initialDeckState);
  const [hydrated, setHydrated] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  /** Which block of a two-pager page the pill's actions apply to. */
  const [focusedBlock, setFocusedBlock] = useState(0);
  /** Last session's deck, offered on the empty state. Never applied on its own. */
  const [previous, setPrevious] = useState<Partial<DeckState> | null>(null);
  /** The running tour, only ever started from "How it works". */
  const [tour, setTour] = useState<TourStep[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const theme = BRANDS[state.brandId];
  const twoPager = state.format === "two-pager";
  const pageSize = twoPager ? A4_PX : { w: 1920, h: 1080 };
  const active = state.slides[state.activeIndex];

  // Open empty. The editor used to restore the last deck silently, which meant
  // every visit after the first started on somebody else's finished work with
  // no obvious way back to a blank page. Only the generation settings carry
  // over; the deck itself waits behind a card on the empty state.
  useEffect(() => {
    const { settings, previous: prev } = openSession();
    if (Object.keys(settings).length > 0) dispatch({ type: "HYDRATE", state: settings });
    setPrevious(prev);
    setHydrated(true);
  }, []);

  /**
   * A deck just landed on screen. The previous session stops being "where
   * you left off" the moment the user has a deck of their own: the offer goes
   * away rather than resurfacing behind a deck they have since deleted.
   */
  const onDeckArrived = () => setPrevious(null);

  /**
   * The tour never starts on its own (Mario, 17 Sep 2026): it runs from "How
   * it works" in the sidebar, and covers the editor chrome only when there is
   * a deck for it to point at.
   */
  const onHowItWorks = () =>
    setTour(state.slides.length > 0 ? [...INTRO_STEPS, ...EDITOR_STEPS] : INTRO_STEPS);

  const onTourDone = () => setTour(null);
  // Autosave, debounced. Held off while last session's deck is still on offer:
  // that deck IS the saved session, and there is nothing worth saving over it
  // until the user takes it, drops it, or starts a deck of their own.
  useEffect(() => {
    if (!hydrated || previous) return;
    const timer = setTimeout(() => saveDeck(state), 800);
    return () => clearTimeout(timer);
  }, [state, hydrated, previous]);

  // On layouts where the photo panel sits under the footer logo, pick the
  // white or dark logo from the pixels beneath it (no AI: pure luminance).
  // computeLogoTone caches per image+reframe, so re-runs are cheap; dispatch
  // is by slide id and the reducer no-ops when the tone is unchanged.
  useEffect(() => {
    for (const s of state.slides) {
      const geom = LOGO_TONE_LAYOUTS.get(s.layoutId);
      if (!geom) continue;
      computeLogoTone(s.image, s.imagePos, geom).then((tone) => {
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
   * `dropChapters` is the safety net behind the no-chapters prompt rule: the
   * model occasionally emits an agenda or a divider anyway, and one stray
   * chapter slide is exactly what the user turned the toggle off to avoid.
   */
  /**
   * Give a rewritten page back the photos the old one carried. Matching is by
   * block type and order, which is imperfect by nature — a rewrite that drops
   * a photo block loses that photo — but it beats losing all of them.
   */
  function reattachImages(content: SlideContent, old?: PageBlock[]): SlideContent {
    if (!old?.length || !content.stack?.length) return content;
    const pool = old.filter((b) => b.image || b.items?.some((i) => i.image));
    const used = new Set<number>();
    const stack = content.stack.map((block) => {
      const j = pool.findIndex((b, k) => !used.has(k) && b.type === block.type);
      if (j < 0) return block;
      used.add(j);
      const from = pool[j];
      return {
        ...block,
        ...(from.image ? { image: from.image, imagePos: from.imagePos } : {}),
        items: block.items?.map((it, i) => {
          const src = from.items?.[i];
          return src?.image ? { ...it, image: src.image, imagePos: src.imagePos } : it;
        }),
      };
    });
    return { ...content, stack };
  }

  async function runGeneration(
    body: Record<string, unknown>,
    opts: {
      replace: boolean;
      targetIndex?: number;
      collectInsert?: boolean;
      preserve?: Partial<SlideContent>;
      dropChapters?: boolean;
      /**
       * The stack of the page being rewritten. Its photos cannot travel in
       * `preserve` (they live inside blocks the model just replaced), so they
       * are re-attached by position and block type: block i of the new stack
       * takes the image of the first unused old block of the same type.
       */
      mergeImages?: PageBlock[];
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
            // A two-pager streams pages, not slides: the model writes a block
            // stack and the page shell is ours.
            const raw = twoPager
              ? {
                  layoutId: "a4-page",
                  stack: (event.slide as { blocks?: unknown[] }).blocks,
                  footerLabel: (event.slide as { footerLabel?: string }).footerLabel ?? "",
                }
              : event.slide;
            const content = normalizeSlide(raw);
            if (!content) continue;
            if (opts.dropChapters && CHAPTER_LAYOUTS.has(content.layoutId)) continue;
            if (opts.collectInsert) {
              collected.push(content);
            } else if (opts.targetIndex != null) {
              dispatch({
                type: "REPLACE_SLIDE",
                index: opts.targetIndex,
                content: { ...reattachImages(content, opts.mergeImages), ...opts.preserve },
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

  // Reference files for the brief. Session state on purpose: they ride along
  // with generate and add requests and are never written to the deck, the
  // deck file or localStorage (a single PDF would blow the quota).
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const onAttach = async (files: File[]) => {
    setAttachError(null);
    const next = [...attachments];
    const problems: string[] = [];
    for (const file of files) {
      if (next.length >= MAX_ATTACHMENTS) {
        problems.push(`At most ${MAX_ATTACHMENTS} files per brief.`);
        break;
      }
      try {
        const a = await readAttachment(file);
        const textTotal = next
          .concat(a)
          .filter((x) => x.kind === "text")
          .reduce((n, x) => n + x.bytes, 0);
        if (totalAttachmentBytes(next.concat(a)) > MAX_REQUEST_BYTES) {
          problems.push(`"${file.name}" does not fit: attachments can total 4 MB per brief.`);
          continue;
        }
        if (textTotal > MAX_TEXT_TOTAL) {
          problems.push(`"${file.name}" does not fit: too much text across the attached files.`);
          continue;
        }
        next.push(a);
      } catch (err) {
        problems.push(err instanceof AttachmentError ? err.message : `Could not read "${file.name}".`);
      }
    }
    setAttachments(next);
    if (problems.length) setAttachError(problems.join(" "));
  };
  const onRemoveAttachment = (id: string) => {
    setAttachments((list) => list.filter((a) => a.id !== id));
    setAttachError(null);
  };

  const onGenerate = async () => {
    const brief = state.brief;
    const received = await runGeneration(
      {
        mode: "generate",
        brief,
        attachments,
        brandLabel: theme.label,
        chapters: state.chapters,
        format: state.format,
        // A two-pager is a fixed-length piece, so the count is the user's.
        ...(twoPager ? { count: state.count } : {}),
      },
      { replace: true, dropChapters: !state.chapters },
    );
    // The two fixed partnership-tier slides are added only when the brief
    // asks for them explicitly ("tiers", "tier table", "livelli"); a generic
    // partnership deck must not ship them uninvited.
    if (received > 0 && /\btiers?\b|\blivell[oi]\b/i.test(brief)) dispatch({ type: "INSERT_TIERS" });
    if (received > 0) onDeckArrived();
  };

  /**
   * Strip fields the model must never see: uploaded images and logos are
   * base64 data URLs (a single photo once blew a request past 350K tokens),
   * and tier grids are meaningless to it.
   */
  const lightSlide = ({ id: _id, image: _im, imagePos: _ip, logoTone: _lt, logos: _lg, grid: _gr, map: _mp, ...content }: (typeof state.slides)[number]) =>
    content;

  /**
   * The same job for a page, one level down: its images live inside the block
   * stack, so a shallow strip would still put every photo's data URL into the
   * prompt.
   */
  const lightPage = (slide: (typeof state.slides)[number]): SlideContent => {
    const content = structuredClone(lightSlide(slide));
    for (const block of content.stack ?? []) {
      delete block.image;
      delete block.imagePos;
      for (const it of block.items ?? []) {
        delete it.image;
        delete it.imagePos;
        delete it.icon;
      }
    }
    return content;
  };
  const light = (slide: (typeof state.slides)[number]) =>
    isPage(slide) ? lightPage(slide) : lightSlide(slide);

  const onAddMore = (instruction: string, count: number) =>
    runGeneration(
      {
        mode: "add",
        brief: state.brief,
        attachments,
        instruction,
        count,
        brandLabel: theme.label,
        chapters: state.chapters,
        format: state.format,
        existingSlides: state.slides.map(light),
      },
      { replace: false, collectInsert: true, dropChapters: !state.chapters },
    );

  const onRegenerateSlide = (instruction: string) => {
    if (!active) return;
    runGeneration(
      {
        mode: "regenerate",
        brief: state.brief,
        brandLabel: theme.label,
        targetSlide: light(active),
        instruction,
        format: state.format,
      },
      {
        replace: false,
        targetIndex: state.activeIndex,
        // uploaded assets survive the AI rewrite
        preserve: isPage(active)
          ? { footerLabel: active.footerLabel }
          : { image: active.image, imagePos: active.imagePos, logos: active.logos, grid: active.grid, icons: active.icons, map: active.map },
        mergeImages: isPage(active) ? active.stack : undefined,
      },
    );
  };

  const onInsertLayout = (layoutId: LayoutId) => {
    dispatch({ type: "INSERT", content: defaultContent(layoutId) });
    onDeckArrived();
  };

  // On a page the editable array belongs to the block you are working in, so
  // "Add element" needs to know which one that is.
  const activePage = active && isPage(active) ? active : null;
  const stack = activePage?.stack ?? [];
  const block = stack[Math.min(focusedBlock, stack.length - 1)];
  const blockLimits = block ? PAGE_BLOCK_LIMITS[block.type] : null;
  const canAddItem = activePage
    ? !!blockLimits && (block?.items?.length ?? 0) < blockLimits[1]
    : !!active &&
      !!PRIMARY_ARRAY[active.layoutId] &&
      ((active[PRIMARY_ARRAY[active.layoutId]!.field] as unknown[] | undefined)?.length ?? 0) <
        PRIMARY_ARRAY[active.layoutId]!.max;
  const onAddItem = () =>
    dispatch(
      activePage
        ? { type: "ADD_ITEM", index: state.activeIndex, path: `stack.${focusedBlock}` }
        : { type: "ADD_ITEM", index: state.activeIndex },
    );

  const isChart = active?.layoutId === "chart-bars" || active?.layoutId === "donut-chart";
  const activeHtml = active
    ? renderSlide(active, theme, { index: state.activeIndex, total: state.slides.length })
    : "";
  const hasImage = activeHtml.includes("data-image");

  const onExportHtml = () => {
    // A two-pager is a printed piece: its HTML file is the pages stacked down
    // the screen, not the fullscreen deck runner. Both carry the same state
    // payload, which is what makes the file the save file.
    const run = twoPager ? exportPageDoc : exportHtmlDeck;
    run(state, theme, state.name).catch((err) =>
      dispatch({ type: "GENERATION_ERROR", error: `Export failed: ${err.message}` }),
    );
  };

  // The print dialog proposes the page title as the PDF's file name, so the
  // deck's name takes the tab for the duration of the dialog.
  const onExportPdf = () => {
    const tabTitle = document.title;
    document.title = state.name;
    try {
      window.print();
    } finally {
      document.title = tabTitle;
    }
  };

  // PowerPoint: the same renderers, captured, with every editable field laid
  // back as a text box. No model call; it is deterministic client code.
  const [pptxProgress, setPptxProgress] = useState<{ done: number; total: number } | null>(null);
  const onExportPptx = () => {
    if (pptxProgress) return;
    dispatch({ type: "CLEAR_ERROR" });
    setPptxProgress({ done: 0, total: state.slides.length });
    exportPptxDeck(state.slides, theme, state.name, (done, total) =>
      setPptxProgress({ done, total }),
    )
      .catch((err) => dispatch({ type: "GENERATION_ERROR", error: `Export failed: ${err.message}` }))
      .finally(() => setPptxProgress(null));
  };

  // Reopen an exported HTML deck. Read and validate first, ask second: nobody
  // should have to answer "this replaces your deck?" for an unreadable file.
  const openDeckFile = async (file: File) => {
    let html: string;
    try {
      html = await file.text();
    } catch {
      dispatch({ type: "GENERATION_ERROR", error: "That file could not be read." });
      return;
    }
    const result = parseDeckFile(html);
    if (!result.ok) {
      dispatch({ type: "GENERATION_ERROR", error: result.message });
      return;
    }
    if (
      state.slides.length > 0 &&
      !confirm("Replace the deck on screen with the one in this file? The current deck will be lost.")
    ) {
      return;
    }
    dispatch({ type: "HYDRATE", state: result.state });
    onDeckArrived();
    if (result.dropped > 0) {
      dispatch({
        type: "GENERATION_ERROR",
        error:
          result.dropped === 1
            ? "Opened the deck, but one slide could not be read and was left out."
            : `Opened the deck, but ${result.dropped} slides could not be read and were left out.`,
      });
    }
  };

  const deckFileInputRef = useRef<HTMLInputElement>(null);
  const openDeckFilePicker = () => deckFileInputRef.current?.click();

  const isDeckFile = (f: File) => f.type === "text/html" || /\.html?$/i.test(f.name);

  const onDropFiles = async (files: File[]) => {
    const deckFile = files.find(isDeckFile);
    if (deckFile) {
      await openDeckFile(deckFile);
      return;
    }
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (files.length > 0) {
        dispatch({
          type: "GENERATION_ERROR",
          error:
            "Drop an image to add it as a slide, or an HTML deck exported from here to reopen it. To use a PDF, Word or PowerPoint file as reference, drop it on the prompt box.",
        });
      }
      return;
    }
    for (const f of images) {
      try {
        const dataUrl = await readImageFile(f);
        dispatch({ type: "INSERT", content: { ...defaultContent("photo"), image: dataUrl } });
        onDeckArrived();
      } catch {
        // unreadable file — skip
      }
    }
  };

  const onRestorePrevious = () => {
    if (!previous) return;
    dispatch({ type: "HYDRATE", state: previous });
    onDeckArrived();
  };

  const onDismissPrevious = () => {
    clearSaved();
    setPrevious(null);
  };

  // Icon picker: block index of the active slide's icon being changed
  // The icon picker is keyed by whatever [data-icon-pick] carried: a block
  // index on a slide, a state path on a two-pager page.
  const [iconPicker, setIconPicker] = useState<string | null>(null);
  // The image picker knows which slot it was opened for: a page has several.
  const [imagePicker, setImagePicker] = useState<string | null>(null);
  const pendingImagePath = useRef<string>("image");
  const slideImageInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-ink">
      <Sidebar
        state={state}
        dispatch={dispatch}
        onGenerate={onGenerate}
        onAddMore={onAddMore}
        onHowItWorks={onHowItWorks}
        attachments={attachments}
        onAttach={onAttach}
        onRemoveAttachment={onRemoveAttachment}
        attachError={attachError}
      />

      {/* Drop handling lives on <main> so it also works with an empty deck —
          reopening a saved file is exactly what you do when there is nothing
          on screen yet. */}
      <main
        className="relative flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          void onDropFiles([...e.dataTransfer.files]);
        }}
      >
        <input
          ref={deckFileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void openDeckFile(file);
          }}
        />
        {/* The image picker renders here, not inside SlideActions: that pill is
            animated with a transform, and a transformed ancestor becomes the
            containing block for position:fixed, which pinned the modal to the
            pill instead of the viewport. */}
        {imagePicker != null && active && (
          <ImagePickerModal
            slot={mapSlotFor(active.layoutId, imagePicker)}
            onUpload={() => {
              pendingImagePath.current = imagePicker;
              setImagePicker(null);
              slideImageInputRef.current?.click();
            }}
            onPickGenerated={(dataUrl) => {
              // A generated map is an image, not a map slug: it was rendered at
              // the slot's own size, so cover-fit shows it whole and the user
              // can still reframe it like a photo.
              dispatch({ type: "SET_IMAGE", index: state.activeIndex, dataUrl, path: imagePicker });
              setImagePicker(null);
            }}
            onClose={() => setImagePicker(null)}
          />
        )}
        <input
          ref={slideImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              dispatch({
                type: "SET_IMAGE",
                index: state.activeIndex,
                dataUrl: await readImageFile(file),
                path: pendingImagePath.current,
              });
            } catch {
              // unreadable file — ignore
            }
          }}
        />
        {state.slides.length === 0 ? (
          <EmptyState
            generating={state.status === "generating"}
            onOpenDeckFile={openDeckFilePicker}
            onWriteBrief={() =>
              document.querySelector<HTMLTextAreaElement>('[data-tour="prompt"] textarea')?.focus()
            }
            previous={previous}
            onRestorePrevious={onRestorePrevious}
            onDismissPrevious={onDismissPrevious}
          />
        ) : (
          <>
            <Toolbar
              name={state.name}
              onRename={(name) => dispatch({ type: "RENAME", name })}
              canUndo={state.past.length > 0}
              canRedo={state.future.length > 0}
              onUndo={() => dispatch({ type: "UNDO" })}
              onRedo={() => dispatch({ type: "REDO" })}
              onExportPdf={onExportPdf}
              onExportHtml={onExportHtml}
              onExportPptx={onExportPptx}
              pptxProgress={pptxProgress}
              onOpenDeckFile={openDeckFilePicker}
              twoPager={twoPager}
            />
            {dataPanelOpen && active && isChart && (
              <ChartDataPanel
                slide={active}
                onChange={(bars) => dispatch({ type: "SET_BARS", index: state.activeIndex, bars })}
                onClose={() => setDataPanelOpen(false)}
              />
            )}
            <div className="relative min-h-0 flex-1 p-6 pb-10" data-tour="canvas">
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
                    onPickIcon={(target) => setIconPicker(target)}
                    size={pageSize}
                    variant={twoPager ? "page" : "slide"}
                    onPickImage={twoPager ? (path) => setImagePicker(path) : null}
                    onFocusBlock={twoPager ? setFocusedBlock : null}
                    focusedBlock={twoPager ? focusedBlock : null}
                    onMoveBlock={
                      twoPager
                        ? (from, to) => dispatch({ type: "MOVE_BLOCK", index: state.activeIndex, from, to })
                        : null
                    }
                    onDeleteBlock={
                      twoPager
                        ? (b) => dispatch({ type: "DELETE_BLOCK", index: state.activeIndex, block: b })
                        : null
                    }
                    onUploadLogo={(slug, dataUrl) =>
                      dispatch({ type: "SET_LOGO", index: state.activeIndex, slug, dataUrl })
                    }
                    onImagePos={
                      hasImage
                        ? (pos, path) =>
                            dispatch({ type: "SET_IMAGE_POS", index: state.activeIndex, pos, path })
                        : null
                    }
                    className="h-full w-full"
                    frameClassName="rounded-xl shadow-stripe-lg"
                  />
                  {iconPicker != null && (
                    <IconPickerModal
                      current={
                        /^\d+$/.test(iconPicker)
                          ? active.icons?.[Number(iconPicker)]
                          : (readPath(active, iconPicker) as string | undefined)
                      }
                      onPick={(icon) => {
                        dispatch(
                          /^\d+$/.test(iconPicker)
                            ? { type: "SET_ICON", index: state.activeIndex, block: Number(iconPicker), icon }
                            : { type: "SET_ICON", index: state.activeIndex, block: 0, icon, path: iconPicker },
                        );
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
                    onChangeImage={() => setImagePicker("image")}
                    onDuplicate={() => dispatch({ type: "DUPLICATE", index: state.activeIndex })}
                    onDelete={() => dispatch({ type: "DELETE", index: state.activeIndex })}
                  />
                </>
              )}
            </div>
          </>
        )}
      </main>

      <div className="w-[200px] shrink-0 border-l border-hairline-light bg-canvas">
        <ThumbStrip
          slides={state.slides}
          theme={theme}
          activeIndex={state.activeIndex}
          dispatch={dispatch}
          onInsertLayout={onInsertLayout}
          twoPager={twoPager}
          onInsertPage={(presetId) => {
            dispatch({
              type: "INSERT",
              content: { layoutId: "a4-page", stack: presetStack(presetId), footerLabel: "" },
            });
            setFocusedBlock(0);
            onDeckArrived();
          }}
        />
      </div>

      {tour && <Tour steps={tour} onDone={onTourDone} />}

      <PrintRoot slides={state.slides} theme={theme} />
    </div>
  );
}

/** Lucide icon chooser for icon-card slides: the full set, searchable. */
function IconPickerModal({
  current,
  onPick,
  onClose,
}: {
  current?: string;
  onPick: (icon: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const q = query.trim().toLowerCase();
  const names = q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
      onClick={onClose}
    >
      <div
        className="pop-in flex w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-stripe-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[13px] font-normal text-ink-faint">
            Choose an icon
          </p>
          <span className="text-[11px] text-ink-muted">
            {names.length.toLocaleString()} icons
          </span>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons… (e.g. satellite, school, rocket)"
          className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
        />
        <div className="grid max-h-[52vh] grid-cols-9 gap-1 overflow-y-auto pr-1">
          {names.map((name) => (
            <button
              key={name}
              title={name}
              onClick={() => onPick(name)}
              className={`group flex h-11 cursor-pointer items-center justify-center rounded-lg border transition-all duration-100 ${
                current === name
                  ? "border-ink/20 bg-mist"
                  : "border-transparent hover:bg-mist"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#277AFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-100 group-hover:scale-125"
                dangerouslySetInnerHTML={{ __html: ICON_LIBRARY[name] }}
              />
            </button>
          ))}
          {names.length === 0 && (
            <p className="col-span-9 py-6 text-center text-sm text-ink-muted">
              No icon matches “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  generating,
  onOpenDeckFile,
  onWriteBrief,
  previous,
  onRestorePrevious,
  onDismissPrevious,
}: {
  generating: boolean;
  onOpenDeckFile: () => void;
  /** Puts the caret in the prompt box: the primary action lives in the sidebar. */
  onWriteBrief: () => void;
  previous: Partial<DeckState> | null;
  onRestorePrevious: () => void;
  onDismissPrevious: () => void;
}) {
  const count = previous?.slides?.length ?? 0;
  // On a cover the title is usually the brand lockup and the subtitle carries
  // the subject, which is what makes one parked deck tell itself from another.
  const first = previous?.slides?.[0];
  const named = previous?.name && previous.name !== DEFAULT_DECK_NAME ? previous.name : undefined;
  const title = named ?? (first?.layoutId === "cover" ? first.subtitle : first?.title)?.trim();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      {generating ? (
        <>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
          <p className="text-sm text-ink-muted">Generating your deck…</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-medium text-ink">What deck are we making?</h1>
          <p className="max-w-sm text-center text-sm leading-relaxed text-ink-muted">
            Describe it on the left. Slides land here, ready to edit.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="primary" onClick={onWriteBrief}>
              Write the brief
            </Button>
            <Button
              variant="secondary"
              icon={Upload}
              onClick={onOpenDeckFile}
              title="An HTML deck you downloaded from here. Dropping it anywhere on this page works too."
            >
              Open a deck
            </Button>
          </div>
          {/* The editor no longer restores the last deck on its own, so the
              deck is offered here instead of appearing under the user. */}
          {count > 0 && (
            <div className="pop-in mt-4 flex w-full max-w-md items-center gap-3 rounded-full border border-hairline-light bg-white py-2 pl-5 pr-2 shadow-float">
              <History size={16} className="shrink-0 text-ink-faint" aria-hidden />
              {/* The icon says "last session"; the row says which deck. */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {title ? `“${title}”` : "Untitled deck"}
                  <span className="font-normal text-ink-muted">
                    {" "}
                    · {count} slide{count === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
              <Button variant="ghost" onClick={onDismissPrevious}>
                Discard
              </Button>
              <Button variant="primary" onClick={onRestorePrevious}>
                Pick it up
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Toolbar({
  name,
  onRename,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportPdf,
  onExportHtml,
  onExportPptx,
  pptxProgress,
  onOpenDeckFile,
  twoPager = false,
}: {
  name: string;
  onRename: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onExportPptx: () => void;
  pptxProgress: { done: number; total: number } | null;
  onOpenDeckFile: () => void;
  twoPager?: boolean;
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
  // The name on the left, every control on the right. Undo and redo are one
  // pair: same pill, same stroke. Disabled only changes the ink, not the
  // shape, so the two never look like different controls.
  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-white px-4 py-2.5">
      <DeckName name={name} onRename={onRename} />
      <div className="ml-auto flex shrink-0 items-center gap-2" data-tour="download">
        <Button variant="secondary" icon={Undo2} onClick={onUndo} disabled={!canUndo} title="Undo (Cmd+Z)">
          Undo
        </Button>
        <Button variant="secondary" icon={Redo2} onClick={onRedo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)">
          Redo
        </Button>
        <Button
          variant="secondary"
          icon={Upload}
          onClick={onOpenDeckFile}
          title="Open a deck you downloaded earlier"
        >
          Upload
        </Button>
        <div className="relative">
        <Button variant="primary" iconRight={ChevronDown} onClick={() => setExportOpen((v) => !v)}>
          Download
        </Button>
        {exportOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
            <div className="pop-in absolute right-0 z-20 mt-1.5 w-56 rounded-2xl bg-white p-1.5 shadow-menu">
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf();
                }}
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-black/[0.04]"
              >
                PDF
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportHtml();
                }}
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-black/[0.04]"
              >
                <span className="flex items-center justify-between gap-2">
                  {twoPager ? "HTML file" : "HTML deck"}
                  {/* The one file that comes back: Upload reopens it for editing. */}
                  <span className="shrink-0 rounded-full bg-giga-tint px-1.5 py-0.5 text-[11px] font-medium leading-4 text-giga">
                    Re-upload to edit
                  </span>
                </span>
              </button>
              {/* Slides only: a two-pager is a printed piece, its file is the PDF. */}
              <button
                disabled={twoPager || pptxProgress !== null}
                onClick={() => {
                  setExportOpen(false);
                  onExportPptx();
                }}
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-black/[0.04] disabled:pointer-events-none disabled:text-ink-faint"
              >
                PowerPoint
                {/* No description in the resting state; only why it is busy or off. */}
                {(twoPager || pptxProgress) && (
                  <span className="block text-xs text-ink-muted">
                    {twoPager ? "Slides only" : `Exporting ${pptxProgress!.done} of ${pptxProgress!.total}…`}
                  </span>
                )}
              </button>
            </div>
          </>
        )}
        </div>
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
  /** Opens the picker, which lives at page level: see the comment on its render. */
  onChangeImage: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  // The bar is one object changing mode, so it morphs rather than swaps: the
  // pill's width is measured from the content it is about to show and
  // transitioned (see .bar-morph), and the new content fades in behind it
  // with a short stagger. The first paint keeps `auto` so nothing animates
  // twice on top of float-in.
  const mode = busy ? "busy" : aiOpen ? "ai" : "actions";
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const settled = useRef(false);
  useLayoutEffect(() => {
    if (contentRef.current) setWidth(contentRef.current.offsetWidth);
  }, [mode, canAddItem, canEditData, canChangeImage]);
  useEffect(() => {
    settled.current = true;
  }, []);
  const submit = () => {
    if (busy) return;
    onRegenerate(instruction);
    setInstruction("");
    setAiOpen(false);
  };
  // One Button spec for every action, no dividers: the gap separates, a
  // slightly wider one sets the slide-level pair (duplicate, delete) apart.
  // Edit with AI is the bar's one accent, as DESIGN.md says. Actions that do
  // not apply to this slide are absent, not disabled: Data and Image already
  // worked that way, Element now matches.
  const canSend = instruction.trim().length > 0;
  return (
    <div className="float-in pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center">
      <div className="pointer-events-auto relative rounded-full shadow-float">
        <div
          data-tour="slide-bar"
          className="bar-morph relative overflow-hidden rounded-full border border-hairline-light bg-white p-2.5"
          style={{ width, boxSizing: "content-box" }}
        >
        <div
          key={mode}
          ref={contentRef}
          className={`flex w-max items-center gap-2 ${settled.current ? "bar-mode" : ""}`}
        >
        {busy ? (
          <Button variant="accent" icon={LoaderCircle} iconClassName="animate-spin" aria-busy tabIndex={-1}>
            Generating…
          </Button>
        ) : aiOpen ? (
          <>
            <input
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSend) submit();
                if (e.key === "Escape") setAiOpen(false);
              }}
              placeholder="Describe how to redo this slide…"
              aria-label="How to redo this slide"
              className="h-9 w-80 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <Button variant="primary" onClick={submit} disabled={busy || !canSend}>
              Regenerate
            </Button>
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              onClick={() => setAiOpen(false)}
              title="Close"
              aria-label="Close"
            />
          </>
        ) : (
          <>
            <Button
              variant="accent"
              onClick={() => setAiOpen(true)}
              disabled={busy}
              className="gradient-ring"
              style={{ "--i": 0 } as CSSProperties}
            >
              Edit with AI
            </Button>
            {canAddItem && (
              <Button variant="secondary" icon={Plus} onClick={onAddItem} title="Add an element to this slide">
                Element
              </Button>
            )}
            {canEditData && (
              <Button
                variant="secondary"
                icon={ChartColumn}
                onClick={onEditData}
                title="Edit the chart data in a table"
              >
                Data
              </Button>
            )}
            {canChangeImage && (
              <Button
                variant="secondary"
                icon={ImageIcon}
                onClick={onChangeImage}
                title="Change the image on this slide"
              >
                Image
              </Button>
            )}
            <Button
              variant="secondary"
              iconOnly
              icon={Copy}
              onClick={onDuplicate}
              title="Duplicate slide"
              aria-label="Duplicate slide"
              className="ml-1"
            />
            <Button
              variant="danger"
              iconOnly
              icon={Trash2}
              onClick={onDelete}
              title="Delete slide"
              aria-label="Delete slide"
            />
          </>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
