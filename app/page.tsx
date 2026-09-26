"use client";

import { ChartColumn, ChevronDown, Play, Copy, History, Image as ImageIcon, LayoutTemplate, LoaderCircle, Plus, Redo2, Trash2, Undo2, Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { BRANDS } from "@/lib/slides/brand";
import { DEFAULT_DECK_NAME, deckReducer, initialDeckState, readPath } from "@/lib/slides/state";
import { isChartLayout, isPage, normalizeSlide, PRIMARY_ARRAY, type LayoutId, type Slide, type SlideContent } from "@/lib/slides/schema";
import { renderSlide } from "@/lib/slides/layouts";
import { A4_PX } from "@/lib/slides/pages/a4";
import { PAGE_BLOCK_LIMITS, type PageBlock } from "@/lib/slides/pages/schema";
import { defaultContent } from "@/lib/slides/defaults";
import { familyOf } from "@/lib/slides/families";
import { countFromBrief, seriesFromBrief, uniformFromBrief, MIN_SLIDES_WITH_CHAPTERS, TIERS_REQUEST } from "@/lib/slides/brief";
import { makeRhythm, stripInventedYear } from "@/lib/slides/rhythm";
import { presetStack } from "@/lib/slides/pages/presets";
import { clearSaved, openSession, saveDeck } from "@/lib/slides/storage";
import { buildHtmlDeck, exportHtmlDeck } from "@/lib/slides/export-html";
import Presenter from "@/components/Presenter";
import { exportPptxDeck } from "@/lib/slides/export-pptx";
import { exportPageDoc } from "@/lib/slides/export-page-html";
import { parseDeckFile } from "@/lib/slides/deck-file";
import { computeLogoTone, FULL_BLEED_TONE, RIGHT_PANEL_TONE, type ToneGeometry } from "@/lib/slides/logo-tone";
import { ICON_LIBRARY, ICON_NAMES } from "@/lib/slides/icons";
import Button, { ICON_SIZE } from "@/components/Button";
import Sidebar from "@/components/Sidebar";
import SlideFrame, { readImageFile } from "@/components/SlideFrame";
import ChartDataPanel from "@/components/ChartDataPanel";
import ImagePickerModal from "@/components/ImagePickerModal";
import EditWithAiModal from "@/components/EditWithAiModal";
import SheetWizard from "@/components/SheetWizard";
import { compileInsights, normalizeAnalysis, SHORT_BRIEF_WORDS, type SheetAnalysis, type SheetAnswers } from "@/lib/slides/sheet-questions";
import type { WizardSubject } from "@/components/SheetWizard";
import LayoutSwitcher from "@/components/LayoutSwitcher";
import { AttachmentError, canQuestion, MAX_ATTACHMENTS, MAX_REQUEST_BYTES, MAX_TEXT_TOTAL, readAttachment, readPdfAsText, totalRequestBytes, type Attachment } from "@/lib/slides/attachments";
import { mapSlotFor } from "@/lib/giga-maps/slot";
import ThumbStrip from "@/components/ThumbStrip";
import PrintRoot from "@/components/PrintRoot";
import Tour, { type TourStep } from "@/components/Tour";
import DeckName from "@/components/DeckName";
import MobileGate from "@/components/MobileGate";
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
 * The Layout button in the slide bar is hidden (Mario, 23 Sep 2026). The
 * switcher, its families and the rhythm pass stay: only the entry point is
 * off, so flipping this brings it back whole.
 */
const SHOW_LAYOUT_SWITCH = false;


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
    target: "attach",
    title: "Attach the material",
    body: "PDF, Word, PowerPoint, Excel, images, up to six. The deck is written from them; the brief decides the angle. An Excel file opens a few questions written for it, and any document that could become two different decks asks too. A clear file asks nothing.",
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
    target: "insert",
    title: "Or pick a layout yourself",
    body: "Every template slide with placeholder text, including seven charts: columns, up to thirty of them, a ranking, a line over time, grouped and stacked columns, a donut. Click a chart to edit its numbers and series.",
  },
  {
    target: "download",
    title: "Download is the save",
    body: "Nothing is stored on a server. Download the HTML deck before you close the tab, then use Upload next to it to reopen the file here and keep editing. PowerPoint and PDF are there too, for sending on.",
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
  /** Bar i of a rewritten chart keeps the colour bar i had before. */
function recolor(content: SlideContent, old?: { color?: string }[]): SlideContent {
  if (!old?.length || !content.bars?.length) return content;
  return {
    ...content,
    bars: content.bars.map((b, i) => (old[i]?.color ? { ...b, color: old[i].color } : b)),
  };
}

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
       * Layouts alternate deterministically as the slides arrive, a year
       * the brief never gave leaves the cover's subtitle, and nothing lands
       * after the closing slide (lib/slides/rhythm.ts). `series` is a deck
       * the brief prescribes slide by slide: no two identical layouts in a
       * row there, at most two elsewhere.
       */
      rhythm?: { series: boolean };
      /**
       * The stack of the page being rewritten. Its photos cannot travel in
       * `preserve` (they live inside blocks the model just replaced), so they
       * are re-attached by position and block type: block i of the new stack
       * takes the image of the first unused old block of the same type.
       */
      mergeImages?: PageBlock[];
      /**
       * The bars of the chart being rewritten: a hand-picked colour is the
       * user's, not the model's, so bar i of the new chart keeps the colour
       * bar i had (the model never sees or sets `color`).
       */
      keepColors?: { color?: string }[];
      /** Every slide kept from this run, for a caller that has to follow up on them. */
      collect?: SlideContent[];
      /** The stream's closing event, for a caller that must know about truncation. */
      onDone?: (done: { truncated?: boolean }) => void;
    },
  ): Promise<number> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "GENERATION_START", replace: opts.replace });
    const rhythm = opts.rhythm ? makeRhythm(opts.rhythm) : null;
    // Before the first slide of a fresh deck lands, the "Generating…" pill's
    // place is measured, so the slide bar can fly in from there (FLIP in
    // SlideActions; see .gen-pill in globals.css).
    let firstLanding = !!opts.replace;
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
            let content = normalizeSlide(raw, { brandId: state.brandId });
            if (!content) continue;
            if (opts.dropChapters && CHAPTER_LAYOUTS.has(content.layoutId)) continue;
            if (rhythm) content = rhythm(stripInventedYear(content, String(body.brief ?? "")));
            if (!content) continue;
            if (opts.collectInsert) {
              collected.push(content);
            } else if (opts.targetIndex != null) {
              dispatch({
                type: "REPLACE_SLIDE",
                index: opts.targetIndex,
                content: recolor(
                  { ...reattachImages(content, opts.mergeImages), ...opts.preserve },
                  opts.keepColors,
                ),
              });
            } else {
              if (firstLanding) {
                firstLanding = false;
                flightRef.current = genPillRef.current?.getBoundingClientRect() ?? null;
              }
              dispatch({ type: "APPEND_SLIDE", content });
            }
            opts.collect?.push(content);
            received++;
          } else if (event.type === "meta") {
            meta = event;
          } else if (event.type === "done") {
            dispatch({ type: "GENERATION_DONE", usage: event.usage });
            opts.onDone?.(event);
            // The route says when the model hit max_tokens. The slides that
            // arrived stay; the user is told instead of handed a short deck.
            if (event.truncated && !opts.collectInsert) {
              dispatch({
                type: "GENERATION_ERROR",
                error: `The deck was cut short at ${received} slide${received === 1 ? "" : "s"}: the model ran out of room. Ask for fewer slides or a shorter brief, or add the rest with Add slides.`,
              });
            }
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Generation failed");
          }
        }
      }
      if (received === 0) throw new Error("The model returned no usable slides. Try rephrasing the prompt.");
      if (opts.collectInsert && collected.length > 0) {
        // Hard cap at the requested count — the model must never inflate the deck
        const cap = typeof body.count === "number" ? body.count : collected.length;
        // An added slide with a title the deck already has is a repeat,
        // whatever the instruction said ("Key risks" twice, 26 Sep 2026).
        const existing = (body.existingSlides as SlideContent[] | undefined) ?? [];
        const titles = new Set(existing.map((s) => (s.title ?? "").trim().toLowerCase()).filter(Boolean));
        const fresh = collected.filter((s) => !titles.has((s.title ?? "").trim().toLowerCase()));
        if (fresh.length > 0) {
          dispatch({
            type: "INSERT_SLIDES",
            at: meta?.insertAfter ?? null,
            contents: fresh.slice(0, cap),
            agenda: meta?.agenda,
          });
        }
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
  /** The count that made the last generation skip chapters, for the sidebar. */
  const [chaptersSkipped, setChaptersSkipped] = useState<number | null>(null);

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
        let a = await readAttachment(file);
        // A PDF that would push the request past the body ceiling goes as
        // its text instead of being dropped: the deck it feeds is the point.
        if (a.kind === "pdf" && totalRequestBytes(next.concat(a)) > MAX_REQUEST_BYTES) {
          a = await readPdfAsText(file);
        }
        const textTotal = next
          .concat(a)
          .filter((x) => x.kind === "text")
          .reduce((n, x) => n + x.bytes, 0);
        if (totalRequestBytes(next.concat(a)) > MAX_REQUEST_BYTES) {
          problems.push(`"${file.name}" does not fit: files can total 3 MB per brief.`);
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
    // Appended functionally: a sheet analysis may land while the next file
    // is still being read, and a plain set would overwrite its result.
    const added = next.slice(attachments.length);
    setAttachments((list) => [...list, ...added]);
    if (problems.length) setAttachError(problems.join(" "));
  };

  /*
   * The questions the material raises are asked when Generate is pressed,
   * not when a file lands (Mario, 25 Sep 2026): the model then reads each
   * file next to the whole brief, and a short brief on its own is read too.
   * `wizard.queue` is what is still to ask, attachment ids and "brief";
   * a subject is asked once (`asked`), so a second press goes straight to
   * the deck, and X stops without generating.
   */
  const [wizard, setWizard] = useState<{ queue: string[]; intent: "generate" | "edit" } | null>(null);
  /** The centred "Generating…" pill, measured right before the first slide lands. */
  const genPillRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<DOMRect | null>(null);
  /** "Edit with AI" on the active slide: the dialog with the instruction and the layout choice. */
  const [aiModal, setAiModal] = useState(false);
  // The analyses finish after their await, so they read the wizard through a ref.
  const wizardRef = useRef(wizard);
  useEffect(() => {
    wizardRef.current = wizard;
  }, [wizard]);
  const [briefQ, setBriefQ] = useState<{ brief: string; analysis?: SheetAnalysis; answers: SheetAnswers; error?: string; asked?: boolean } | null>(null);
  /** `app/api/analyze` reads one file next to the brief; the result sits on the attachment. */
  const analyzeAttachment = async (a: Attachment, brief: string) => {
    if (!canQuestion(a)) return;
    const spreadsheet = a.kind === "text" && !!a.spreadsheet;
    const update = (patch: { analysis?: SheetAnalysis; analysisError?: string }) =>
      setAttachments((list) => list.map((x) => (x.id === a.id && canQuestion(x) ? { ...x, ...patch } : x)));
    update({ analysisError: undefined });
    try {
      const payload = a.kind === "pdf" ? { name: a.name, pdf: a.data } : { name: a.name, text: a.text };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, kind: spreadsheet ? "spreadsheet" : "document", brief }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const analysis = normalizeAnalysis(await res.json());
      if (!analysis) throw new Error("The file gave no questions");
      update({ analysis });
      if (analysis.questions.length === 0) passOver(a.id);
    } catch (err) {
      // A document that could not be read is not worth a red box: the file still travels whole.
      if (spreadsheet) update({ analysisError: err instanceof Error ? err.message : "Analysis failed" });
      else {
        update({ analysis: { summary: "", questions: [] } });
        passOver(a.id);
      }
    }
  };
  /** A subject that turned out clear while the wizard was waiting on it moves the wizard on. */
  const passOver = (id: string) => {
    const w = wizardRef.current;
    if (w && w.queue[0] === id) advanceFrom(w);
  };
  /** The brief alone, keyed to its text: a changed brief is read again. */
  const analyzeBrief = async (brief: string) => {
    setBriefQ({ brief, answers: {} });
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "brief", text: brief, kind: "brief" }) });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const analysis = normalizeAnalysis(await res.json()) ?? { summary: "", questions: [] };
      setBriefQ((q) => (q?.brief === brief ? { ...q, analysis } : q));
      if (analysis.questions.length === 0) passOver("brief");
    } catch {
      // A brief that could not be read is generated as written.
      setBriefQ((q) => (q?.brief === brief ? { ...q, analysis: { summary: "", questions: [] } } : q));
      passOver("brief");
    }
  };
  /** Every answer is kept as it is given and compiled into `insights`, the field the prompt reads. */
  const onWizardAnswers = (id: string, answers: SheetAnswers) => {
    if (id === "brief") setBriefQ((q) => (q ? { ...q, answers } : q));
    else
      setAttachments((list) =>
        list.map((x) => (x.id === id && canQuestion(x) && x.analysis ? { ...x, answers, insights: compileInsights(x.analysis, answers) } : x)),
      );
  };
  const markAsked = (id: string) => {
    if (id === "brief") setBriefQ((q) => (q ? { ...q, asked: true } : q));
    else setAttachments((list) => list.map((x) => (x.id === id && canQuestion(x) ? { ...x, asked: true } : x)));
  };
  /** The current subject is done (answered, skipped or clear): the next one, or the deck. */
  const advanceFrom = (w: { queue: string[]; intent: "generate" | "edit" }) => {
    markAsked(w.queue[0]);
    const rest = w.queue.slice(1);
    if (rest.length) setWizard({ ...w, queue: rest });
    else {
      setWizard(null);
      if (w.intent === "generate") void runGenerate();
    }
  };
  const advanceWizard = () => {
    if (wizard) advanceFrom(wizard);
  };
  const closeWizard = () => {
    if (wizard) markAsked(wizard.queue[0]);
    setWizard(null);
  };
  const wizardSubject: (WizardSubject & { id: string }) | null = (() => {
    const id = wizard?.queue[0];
    if (!id) return null;
    if (id === "brief") return { id, title: "Your brief", kind: "brief", analysis: briefQ?.analysis, answers: briefQ?.answers ?? {}, error: briefQ?.error };
    const a = attachments.find((x) => x.id === id);
    if (!a || !canQuestion(a)) return null;
    return { id, title: a.name, kind: a.kind === "text" && a.spreadsheet ? "spreadsheet" : "document", analysis: a.analysis, answers: a.answers ?? {}, error: a.analysisError };
  })();
  /** The Generate press: first the questions still to ask, then the deck. */
  const onGenerate = () => {
    const brief = state.brief;
    const queue = attachments.filter(canQuestion).filter((a) => !a.asked).map((a) => a.id);
    const words = brief.trim().split(/\s+/).filter(Boolean).length;
    const briefAlone = attachments.length === 0 && !twoPager && words > 0 && words < SHORT_BRIEF_WORDS;
    if (briefAlone && !(briefQ?.brief === brief && briefQ.asked)) queue.push("brief");
    // A file already read and found clear has nothing to ask.
    const toAsk = queue.filter((id) => {
      if (id === "brief") return !(briefQ?.brief === brief && briefQ.analysis?.questions.length === 0);
      const a = attachments.find((x) => x.id === id);
      return !(a && canQuestion(a) && a.analysis && a.analysis.questions.length === 0);
    });
    if (toAsk.length === 0) return void runGenerate();
    queue.length = 0;
    queue.push(...toAsk);
    for (const id of queue) {
      if (id === "brief") {
        if (briefQ?.brief !== brief) void analyzeBrief(brief);
      } else {
        const a = attachments.find((x) => x.id === id)!;
        if (canQuestion(a) && !a.analysis) void analyzeAttachment(a, brief);
      }
    }
    setWizard({ queue, intent: "generate" });
  };
  const onRemoveAttachment = (id: string) => {
    setAttachments((list) => list.filter((a) => a.id !== id));
    setAttachError(null);
    // The wizard never waits on a file that is gone.
    if (wizard?.queue[0] === id) advanceFrom(wizard);
  };


  const runGenerate = async () => {
    const brief = state.brief;
    // A two-pager is a fixed-length piece, so the count is the user's; a
    // slide deck takes the number the brief names, if any.
    const count = twoPager ? state.count : countFromBrief(brief);
    // "Six slides" and chapters on cannot both hold: the agenda and the
    // dividers would leave one or two slides for the story. The count wins,
    // the deck goes out without chapters, and the sidebar says why.
    const chapters = state.chapters && !(!twoPager && count !== undefined && count < MIN_SLIDES_WITH_CHAPTERS);
    setChaptersSkipped(chapters !== state.chapters ? (count as number) : null);
    const perItem = !twoPager && seriesFromBrief(brief);
    const wanted = count === undefined ? undefined : perItem ? count + 2 : count;
    const rhythm = { series: perItem, uniform: uniformFromBrief(brief), cap: twoPager ? undefined : wanted };
    const kept: SlideContent[] = [];
    let truncated = false;
    let received = await runGeneration(
      {
        mode: "generate",
        brief,
        attachments,
        briefNotes: briefQ?.brief === brief && briefQ.analysis ? compileInsights(briefQ.analysis, briefQ.answers) : undefined,
        brandLabel: theme.label,
        chapters,
        format: state.format,
        count,
        perItem,
      },
      {
        replace: true,
        dropChapters: !chapters,
        rhythm,
        collect: kept,
        onDone: (d) => {
          truncated = !!d.truncated;
        },
      },
    );
    // Haiku lands a slide or two short of a named count under a heavy PDF,
    // and the output schema cannot pin the length (the API takes minItems of
    // 0 or 1 only). So a short deck is completed with one add request for the
    // missing slides; a truncated one is not, the error already says why.
    // Two tries: the one add for a single missing slide came back with
    // nothing usable once in twenty decks (23 Sep 2026).
    for (let attempt = 0; attempt < 2 && !twoPager && wanted && received > 0 && received < wanted && !truncated; attempt++) {
      // The closing slide counts: when the model left it out, ENSURE_CLOSING
      // adds it after the top-up, so the top-up asks for one fewer (a six-slide
      // brief came back as seven, 26 Sep 2026).
      const closed = kept.some((k) => k.layoutId === "thank-you");
      const missing = wanted - received - (closed ? 0 : 1);
      if (missing <= 0) break;
      received += await runGeneration(
        {
          mode: "add",
          brief,
          attachments,
          instruction: `The deck must have ${wanted} slides and has ${received}. Add the ${missing} still missing: ${perItem ? "the items of the brief that have no slide yet, one slide each" : "beats of the brief and the material not yet covered"}, never a repeat of an existing slide.`,
          count: missing,
          brandLabel: theme.label,
          chapters,
          format: state.format,
          existingSlides: kept.map((k) => light(k as (typeof state.slides)[number])),
        },
        { replace: false, collectInsert: true, dropChapters: !chapters, rhythm },
      );
    }
    // The two fixed partnership-tier slides are added only when the brief
    // asks for them by name. A bare "tier" is not enough: "API keys by tier"
    // in an OKR brief shipped the partnership table uninvited (22 Sep 2026).
    // Once the deck is complete, top-up included: a "continued" slide folds
    // into its first half, under "same layout" the one layout that holds the
    // whole series (the streaming pass could only impose what it had seen),
    // and the closing slide the model may have left out.
    if (received > 0) {
      dispatch({ type: "MERGE_CONTINUATIONS" });
      if (rhythm.uniform) dispatch({ type: "UNIFY_LAYOUTS" });
      dispatch({ type: "ENSURE_CLOSING" });
    }
    if (received > 0 && TIERS_REQUEST.test(brief)) dispatch({ type: "INSERT_TIERS" });
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
        briefNotes: briefQ?.brief === state.brief && briefQ.analysis ? compileInsights(briefQ.analysis, briefQ.answers) : undefined,
        instruction,
        count,
        brandLabel: theme.label,
        chapters: state.chapters,
        format: state.format,
        existingSlides: state.slides.map(light),
      },
      { replace: false, collectInsert: true, dropChapters: !state.chapters },
    );

  const onRegenerateSlide = (instruction: string, target: Slide = active!) => {
    if (!active) return;
    runGeneration(
      {
        mode: "regenerate",
        brief: state.brief,
        brandLabel: theme.label,
        targetSlide: light(target),
        instruction,
        format: state.format,
      },
      {
        replace: false,
        targetIndex: state.activeIndex,
        // uploaded assets survive the AI rewrite
        preserve: isPage(active)
          ? { footerLabel: active.footerLabel }
          : {
              image: active.image,
              imagePos: active.imagePos,
              logos: active.logos,
              grid: active.grid,
              map: active.map,
              // Icons the user picked stay; otherwise the rewrite brings icons for its own words.
              ...(active.iconsPinned ? { icons: active.icons, iconsPinned: true } : {}),
            },
        mergeImages: isPage(active) ? active.stack : undefined,
        keepColors: active.bars,
      },
    );
  };

  /**
   * The Edit with AI dialog: a layout change is applied on the spot (no
   * model call, one undo step, uploads and chart colours kept), and an
   * instruction rewrites the slide, in that layout when both were given.
   */
  const onEditWithAi = (instruction: string, layoutId: LayoutId | null) => {
    if (!active) return;
    setAiModal(false);
    let target: Slide = active;
    if (layoutId && layoutId !== active.layoutId && !isPage(active)) {
      const content = recolor(
        { ...active, layoutId, image: active.image, imagePos: active.imagePos, logos: active.logos, grid: active.grid, icons: active.icons, map: active.map },
        active.bars,
      );
      dispatch({ type: "REPLACE_SLIDE", index: state.activeIndex, content });
      target = { ...active, ...content };
    }
    if (instruction) onRegenerateSlide(instruction, target);
  };

  /**
   * A layout the switcher already wrote out: applied like a regenerated
   * slide (uploads and hand-picked chart colours survive), with no model
   * call and one undo step.
   */
  const onApplyLayout = (content: SlideContent) => {
    if (!active || isPage(active)) return;
    dispatch({
      type: "REPLACE_SLIDE",
      index: state.activeIndex,
      content: recolor(
        { ...content, image: active.image, imagePos: active.imagePos, logos: active.logos, grid: active.grid, icons: active.icons, map: active.map },
        active.bars,
      ),
    });
    setLayoutSwitcher(false);
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

  const isChart = !!active && isChartLayout(active.layoutId);
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

  // Presentation mode: full screen is requested inside the click (browsers
  // allow it nowhere else), then the deck file is built and shown from the
  // slide on screen. Leaving full screen ends it and frees the blob.
  const [presenting, setPresenting] = useState<{ src: string | null } | null>(null);
  const onPresent = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setPresenting({ src: null });
    const start = state.activeIndex + 1;
    buildHtmlDeck(state, theme, state.name)
      .then((html) => {
        const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
        setPresenting((p) => (p ? { src: `${url}#${start}` } : (URL.revokeObjectURL(url), null)));
      })
      .catch((err) => {
        setPresenting(null);
        dispatch({ type: "GENERATION_ERROR", error: `Presentation failed: ${err.message}` });
      });
  };
  const onEndPresent = () => {
    setPresenting((p) => {
      if (p?.src) URL.revokeObjectURL(p.src.split("#")[0]);
      return null;
    });
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
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
  /** The "Change layout" modal, opened from the slide bar. */
  const [layoutSwitcher, setLayoutSwitcher] = useState(false);
  const pendingImagePath = useRef<string>("image");
  const slideImageInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-ink">
      <MobileGate />
      <Sidebar
        state={state}
        dispatch={dispatch}
        onGenerate={onGenerate}
        onAddMore={onAddMore}
        onHowItWorks={onHowItWorks}
        attachments={attachments}
        onAttach={onAttach}
        onRemoveAttachment={onRemoveAttachment}
        onOpenSheet={(id) => setWizard({ queue: [id], intent: "edit" })}
        attachError={attachError}
        chaptersSkipped={chaptersSkipped}
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
        {layoutSwitcher && active && !isPage(active) && (
          <LayoutSwitcher
            slide={active}
            theme={theme}
            onApply={onApplyLayout}
            onClose={() => setLayoutSwitcher(false)}
          />
        )}
        {wizard && wizardSubject && (
          <SheetWizard
            key={wizardSubject.id}
            subject={wizardSubject}
            finalLabel={wizard.intent === "generate" && wizard.queue.length === 1 ? "Generate" : wizard.queue.length > 1 ? "Next file" : "Done"}
            onAnswers={(answers) => onWizardAnswers(wizardSubject.id, answers)}
            onRetry={() => {
              if (wizardSubject.id === "brief") void analyzeBrief(state.brief);
              else {
                const a = attachments.find((x) => x.id === wizardSubject.id);
                if (a) void analyzeAttachment(a, state.brief);
              }
            }}
            onSkip={advanceWizard}
            onDone={advanceWizard}
            onClose={closeWizard}
          />
        )}
        {presenting && <Presenter src={presenting.src} onClose={onEndPresent} />}
        {aiModal && active && <EditWithAiModal slide={active} theme={theme} onSubmit={onEditWithAi} onClose={() => setAiModal(false)} />}
        {imagePicker != null && active && (
          <ImagePickerModal
            slot={mapSlotFor(active.layoutId, imagePicker)}
            current={
              (imagePicker === "image" ? active.image : (readPath(active, imagePicker) as string | undefined)) ?? null
            }
            onRemove={() => {
              dispatch({ type: "CLEAR_IMAGE", index: state.activeIndex, path: imagePicker });
              setImagePicker(null);
            }}
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
        {state.slides.length === 0 && state.status === "generating" ? (
          // The slide bar's pill, centred on the empty stage with the aurora
          // behind it; when the first slide lands it travels to the bar's
          // place and becomes it (`.gen-pill` and the smart-bar view
          // transition in globals.css).
          <div className="relative min-h-0 flex-1" aria-busy aria-live="polite">
            <div className="absolute inset-0 flex items-center justify-center">
              <div ref={genPillRef} className="gen-pill rounded-full shadow-float">
                <div className="rounded-full border border-hairline-light bg-surface p-2.5">
                  <GeneratingLabel />
                </div>
              </div>
            </div>
          </div>
        ) : state.slides.length === 0 ? (
          <EmptyState
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
              onPresent={twoPager ? undefined : onPresent}
              onExportPptx={onExportPptx}
              pptxProgress={pptxProgress}
              onOpenDeckFile={openDeckFilePicker}
              twoPager={twoPager}
            />
            {dataPanelOpen && active && isChart && (
              <ChartDataPanel
                slide={active}
                theme={theme}
                onChange={(bars, series) => dispatch({ type: "SET_BARS", index: state.activeIndex, bars, series })}
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
                    onPickImage={(path) => setImagePicker(path)}
                    onChartClick={isChart ? () => setDataPanelOpen(true) : null}
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
                  {/* Keyed by slide so the bar resets with it, except while the
                      deck is written: then it stays mounted through every
                      landing slide and the aurora never restarts. */}
                  <SlideActions
                    key={state.status === "generating" ? "generating" : active.id}
                    busy={state.status === "generating"}
                    flightRef={flightRef}
                    onEditWithAi={() => setAiModal(true)}
                    canAddItem={canAddItem}
                    canEditData={isChart}
                    onRegenerate={onRegenerateSlide}
                    onAddItem={onAddItem}
                    onEditData={() => setDataPanelOpen((v) => !v)}
                    canChangeImage={hasImage}
                    onChangeImage={() => setImagePicker("image")}
                    canChangeLayout={SHOW_LAYOUT_SWITCH && !isPage(active) && familyOf(active.layoutId) !== null}
                    onChangeLayout={() => setLayoutSwitcher(true)}
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
        className="pop-in flex w-full max-w-xl flex-col rounded-2xl bg-surface p-5 shadow-stripe-lg"
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
          className="mb-3 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-ink-faint focus:border-giga focus:ring-[3px] focus:ring-giga/15"
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
  onOpenDeckFile,
  onWriteBrief,
  previous,
  onRestorePrevious,
  onDismissPrevious,
}: {
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
      {
        <>
          <h1 className="text-2xl font-medium text-ink">What deck are we making?</h1>
          <p className="max-w-sm text-center text-sm leading-relaxed text-ink-muted">
            Describe it on the left. Slides land here, ready to edit.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="primary" onClick={onWriteBrief}>
              Create new
            </Button>
            <Button
              variant="secondary"
              icon={Upload}
              onClick={onOpenDeckFile}
              title="Dropping the file anywhere on this page works too."
            >
              Open HTML deck
            </Button>
          </div>
          {/* The one file that comes back is the HTML deck downloaded from here. */}
          <p className="text-xs text-ink-faint">Only HTML decks downloaded from here can be reopened.</p>
          {/* The editor no longer restores the last deck on its own, so the
              deck is offered here instead of appearing under the user. */}
          {count > 0 && (
            <div className="pop-in mt-4 flex w-full max-w-md items-center gap-3 rounded-full border border-hairline-light bg-surface py-2 pl-5 pr-2 shadow-float">
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
                Open
              </Button>
            </div>
          )}
        </>
      }
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
  onPresent,
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
  /** Slides only: a two-pager is a printed piece, it has no presentation. */
  onPresent?: () => void;
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
    <div className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2.5">
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
          title="Open an HTML deck you downloaded earlier"
        >
          Upload HTML
        </Button>
        {onPresent && (
          <Button variant="secondary" icon={Play} onClick={onPresent} title="Present full screen from this slide (Esc to leave)">
            Present
          </Button>
        )}
        <div className="relative">
        <Button variant="primary" iconRight={ChevronDown} onClick={() => setExportOpen((v) => !v)}>
          Download
        </Button>
        {exportOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
            <div className="pop-in absolute right-0 z-20 mt-1.5 w-56 rounded-2xl bg-surface p-1.5 shadow-menu">
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf();
                }}
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist"
              >
                PDF
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportHtml();
                }}
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist"
              >
                <span className="flex items-center justify-between gap-2">
                  {twoPager ? "HTML file" : "HTML deck"}
                  {/* The one file that comes back: Upload reopens it for editing. */}
                  <span className="shrink-0 rounded-full bg-giga-tint px-1.5 py-0.5 text-[11px] font-medium leading-4 text-giga">
                    To save locally
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
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist disabled:pointer-events-none disabled:text-ink-faint"
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
/** "Generating…" in Ink with the spinner, the button's measurements and no tint (Mario, 25 Sep 2026): a status, not a control. */
function GeneratingLabel() {
  return (
    <span className="flex h-9 items-center gap-1.5 px-3 text-sm font-medium text-ink" aria-busy>
      <LoaderCircle size={ICON_SIZE} className="animate-spin" aria-hidden />
      Generating…
    </span>
  );
}

function SlideActions({
  busy,
  flightRef,
  onEditWithAi,
  canAddItem,
  canEditData,
  canChangeImage,
  onRegenerate,
  onAddItem,
  onEditData,
  onChangeImage,
  canChangeLayout,
  onChangeLayout,
  onDuplicate,
  onDelete,
}: {
  busy: boolean;
  /** Where the centred "Generating…" pill was when the first slide landed: the bar flies in from there. */
  flightRef?: React.MutableRefObject<DOMRect | null>;
  /** Opens the Edit with AI dialog, which lives at page level. */
  onEditWithAi: () => void;
  canAddItem: boolean;
  canEditData: boolean;
  canChangeImage: boolean;
  onRegenerate: (instruction: string) => void;
  onAddItem: () => void;
  onEditData: () => void;
  /** Opens the picker, which lives at page level: see the comment on its render. */
  onChangeImage: () => void;
  /** Slides only: a two-pager page is a stack of blocks, not a layout. */
  canChangeLayout: boolean;
  onChangeLayout: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  // The bar is one object changing mode, so it morphs rather than swaps: the
  // pill's width is measured from the content it is about to show and
  // transitioned (see .bar-morph), and the new content fades in behind it
  // with a short stagger. The first paint keeps `auto` so nothing animates
  // twice on top of float-in.
  const mode = busy ? "busy" : "actions";
  const contentRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  // The journey from the centre of the stage: the bar mounts in its place and
  // starts translated to where the pill was (FLIP), 640ms ease-out-expo on
  // transform alone, so it stays smooth while the first slide is drawn.
  useLayoutEffect(() => {
    const from = flightRef?.current;
    const el = pillRef.current;
    if (!from || !el || !busy) return;
    flightRef!.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
      duration: 640,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "both",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const settled = useRef(false);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    // Content can change without a mode change (an action appearing, a label
    // edited); the observer keeps the pill exactly as wide as what it holds.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  useEffect(() => {
    settled.current = true;
  }, []);
  void onRegenerate;
  // One Button spec for every action, no dividers: the gap separates, a
  // slightly wider one sets the slide-level pair (duplicate, delete) apart.
  // Edit with AI is the bar's one accent, as DESIGN.md says. Actions that do
  // not apply to this slide are absent, not disabled: Data and Image already
  // worked that way, Element now matches.
  return (
    <div className={`${busy ? "" : "float-in"} pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center`}>
      {/* While the deck is written the bar is the pill that came down from the
          centre: same aurora, no entrance of its own. */}
      <div ref={pillRef} className={`pointer-events-auto relative rounded-full shadow-float ${busy ? "gen-pill" : ""}`}>
        <div
          data-tour="slide-bar"
          className="bar-morph relative overflow-hidden rounded-full border border-hairline-light bg-surface p-2.5"
          style={{ width, boxSizing: "content-box" }}
        >
        <div
          key={mode}
          ref={contentRef}
          className={`flex w-max items-center gap-2 ${settled.current ? "bar-mode" : ""}`}
        >
        {busy ? (
          <GeneratingLabel />
        ) : (
          <>
            <Button variant="primary" onClick={onEditWithAi} disabled={busy} style={{ "--i": 0 } as CSSProperties}>
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
            {canChangeLayout && (
              <Button
                variant="secondary"
                icon={LayoutTemplate}
                onClick={onChangeLayout}
                title="Change the layout of this slide, text kept"
              >
                Layout
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
