"use client";

import { ChartColumn, ChevronDown, ChevronUp, Play, Copy, History, Image as ImageIcon, LayoutTemplate, LoaderCircle, Plus, Redo2, Superscript, Trash2, Undo2, Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { BRANDS } from "@/lib/slides/brand";
import { deckReducer, initialDeckState, isDefaultName, readPath, setPath } from "@/lib/slides/state";
import { ensureId, isChartLayout, isPage, normalizeSlide, overLimits, PRIMARY_ARRAY, type LayoutId, type Slide, type SlideContent } from "@/lib/slides/schema";
import { renderSlide } from "@/lib/slides/layouts";
import { A4_PX, pageDateNow } from "@/lib/slides/pages/a4";
import { fitPage, flowOver, pullForward, type Resizer } from "@/lib/slides/pages/fit";
import { dropStatEchoes, fillStatFigures, isMastheadLine, putBackLines, checkRhythm, layoutIssues, shapeReplica, tidyBriefPieces, unwrapLines } from "@/lib/slides/pages/restore";
import { logoFor } from "@/lib/slides/pages/logos";
import { fillPagePhotos } from "@/lib/slides/library";
import BlockRail from "@/components/BlockRail";
import type { PlanRow } from "@/lib/slides/prompt";
import LanguageMenu from "@/components/LanguageMenu";
import EditChoice from "@/components/EditChoice";
import LogoMenu from "@/components/LogoMenu";
import PartnerLogoModal from "@/components/PartnerLogoModal";
import { apply, detectLang, LANG_LABELS, LANG_NAMES, plan, newEdits, remember, snapshot, textFields, uiStrings, type DeckLang, type Job, type Lang } from "@/lib/slides/i18n";
import { undash } from "@/lib/slides/pages/schema";
import { normalizePage, PAGE_BLOCK_LIMITS, RAIL_BLOCKS, panelTone, tableHeads, type PageBlock, type PageBlockType } from "@/lib/slides/pages/schema";
import { defaultContent, denseContent } from "@/lib/slides/defaults";
import { familyOf } from "@/lib/slides/families";
import { countFromBrief, languageOf, seriesFromBrief, uniformFromBrief, MIN_SLIDES_WITH_CHAPTERS, TIERS_REQUEST } from "@/lib/slides/brief";
import { makeRhythm, stripInventedYear } from "@/lib/slides/rhythm";
import { BLOCK_LABELS, presetStack } from "@/lib/slides/pages/presets";
import { clearSaved, openSession, saveDeck } from "@/lib/slides/storage";
import { buildHtmlDeck, exportHtmlDeck } from "@/lib/slides/export-html";
import Presenter from "@/components/Presenter";
import { exportPptxDeck } from "@/lib/slides/export-pptx";
import { exportPageDoc } from "@/lib/slides/export-page-html";
import { parseDeckFile } from "@/lib/slides/deck-file";
import { computeLogoTone, FULL_BLEED_TONE, RIGHT_PANEL_TONE, type ToneGeometry } from "@/lib/slides/logo-tone";
import { ICON_LIBRARY, ICON_NAMES } from "@/lib/slides/icons";
import Button, { ICON_SIZE } from "@/components/Button";
import GlassFan from "@/components/GlassFan";
import { chapterCandidates, needsChapterPlan, type ChapterPlan } from "@/lib/slides/chapters";
import Sidebar from "@/components/Sidebar";
import SlideFrame, { readImageFile } from "@/components/SlideFrame";
import ChartDataPanel from "@/components/ChartDataPanel";
import ImagePickerModal from "@/components/ImagePickerModal";
import EditWithAiModal from "@/components/EditWithAiModal";
import SheetWizard from "@/components/SheetWizard";
import { compileInsights, normalizeAnalysis, SHORT_BRIEF_WORDS, USE_QUESTION_ID, fileUseOf, fileUseQuestion, lengthAnalysisFor, lengthOf, mentionsMissingFile, missingFileAnalysis, MISSING_FILE_QUESTION_ID, ATTACH_IT, preselectFileUse, type SheetAnalysis, type SheetAnswers } from "@/lib/slides/sheet-questions";
import { denseBeforeNormalize, densityHint, planReplica, withContentDensity, type ReplicateStep } from "@/lib/slides/replicate";
import { compareSlide, fidelityScore, isFlawed, planLeftovers, repairNote, runningLines, sourceUnits, totals, type DeckFidelity, type Leftover, type SlideFidelity } from "@/lib/slides/fidelity";
import { readPdfSlides } from "@/lib/slides/pdf-source";
import { MAX_TRANSCRIBED_PAGES, slidesFromTranscript, type Transcript } from "@/lib/slides/transcribe";
/** How the file-use question counts a file: slides for a deck, pages for a PDF. */
const unitOf = (a: { name: string }) => (/\.pdf$/i.test(a.name) ? ("pages" as const) : ("slides" as const));
/** The content slides or pages the file-use question names: the plan's, or a text-less PDF's pages (transcribed on Generate). */
const replicaCountOf = (a: Attachment) =>
  canQuestion(a) && a.sourceSlides?.length ? planReplica(a.sourceSlides).contentCount : Math.min(canQuestion(a) ? (a.pageCount ?? 0) : 0, MAX_TRANSCRIBED_PAGES);
import type { WizardSubject } from "@/components/SheetWizard";
import LayoutSwitcher from "@/components/LayoutSwitcher";
import { AttachmentError, canQuestion, isDeckSource, MAX_ATTACHMENTS, MAX_REQUEST_BYTES, MAX_TEXT_TOTAL, readAttachment, readPdfAsText, totalRequestBytes, type Attachment } from "@/lib/slides/attachments";
import { mapSlotFor } from "@/lib/giga-maps/slot";
import ThumbStrip from "@/components/ThumbStrip";
import PrintRoot from "@/components/PrintRoot";
import HelpModal from "@/components/HelpModal";
import { NO_NOTES } from "@/lib/slides/layouts/dense";
import { addOptions, addPart, deleteModular, insertPoint, isModular, nests, pointAt, removePoint, type AddOption } from "@/lib/slides/modular";
import { readable, roomFor } from "@/lib/slides/fit-check";
import { continuationLabel, restoreCover, restoreSlide, type Restored } from "@/lib/slides/restore";
import type { FocusRequest, PointOps } from "@/components/SlideFrame";
import { createPortal } from "react-dom";
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


export default function Studio() {
  const [state, dispatch] = useReducer(deckReducer, initialDeckState);
  const [hydrated, setHydrated] = useState(false);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  /** Which block of a two-pager page the pill's actions apply to. */
  /**
   * Two-pagers: the block plan as it streams, shown on the stage while the
   * model works, so the wait says what is being decided (Mario, 7 Oct 2026).
   */
  const [livePlan, setLivePlan] = useState<PlanRow[] | null>(null);
  /** Two-pager: the selected block, null when none is (the page's own bar shows). */
  const [focusedBlock, setFocusedBlock] = useState<number | null>(null);
  /** Last session's deck, offered on the empty state. Never applied on its own. */
  const [previous, setPrevious] = useState<Partial<DeckState> | null>(null);
  /** The How it works dialog: the create video on an empty editor, the edit one with a deck. */
  const [help, setHelp] = useState<"create" | "edit" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The brand, with the words its renderers draw themselves in the deck's language.
  const deckLangCode = state.lang?.current ?? "en";
  const theme = useMemo(() => ({ ...BRANDS[state.brandId], ui: uiStrings(deckLangCode) }), [state.brandId, deckLangCode]);
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

  const onHowItWorks = () => setHelp(state.slides.length > 0 ? "edit" : "create");
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

/** A block as the model sees it: no photos (an upload is a data URL), no picked icons. */
function lightBlock(block: PageBlock): PageBlock {
  const { image: _i, imagePos: _p, ...rest } = block;
  void _i;
  void _p;
  return { ...rest, items: rest.items?.map(({ image: _ii, imagePos: _ip, ...it }) => (void _ii, void _ip, it)) };
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
      /** Two-pagers: the block plan the model wrote before its pages. */
      plan?: PlanRow[];
    },
  ): Promise<number> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // A new deck is written in its brief's language, which becomes its original
    // (a replica's is its document's: read off the deck at the first switch).
    const briefLang = opts.replace && !body.source && typeof body.brief === "string" ? detectLang(body.brief, languageOf(body.brief)) : undefined;
    dispatch({ type: "GENERATION_START", replace: opts.replace, source: briefLang });
    const rhythm = opts.rhythm ? makeRhythm(opts.rhythm) : null;
    // Before the first slide of a fresh deck lands, the "Generating…" pill's
    // place is measured, so the slide bar can fly in from there (FLIP in
    // SlideActions; see .gen-pill in globals.css).
    let firstLanding = !!opts.replace;
    try {
      const t0 = performance.now();
      let firstAt = 0;
      if (body.format === "two-pager" && opts.replace) setLivePlan([]);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The slide-by-slide reading of a PowerPoint is the editor's: its text already travels.
        // Added and rewritten slides are written in the language on screen; a
        // new deck in its brief's (the route reads it off the brief).
        body: JSON.stringify(state.lang && !opts.replace ? { ...body, outputLanguage: LANG_NAMES[state.lang.current] } : body, (k, v) => (k === "sourceSlides" ? undefined : v)),
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
      /** Add mode: where each collected slide goes, from its own "after". */
      const positions: (number | null)[] = [];
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
            if (!firstAt) firstAt = performance.now();
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
              const after = (event.slide as { after?: unknown }).after;
              positions.push(typeof after === "number" && Number.isFinite(after) ? Math.round(after) : null);
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
          } else if (event.type === "plan" && !firstAt) {
            firstAt = performance.now();
            if (event.row) {
              opts.plan?.push(event.row as PlanRow);
              setLivePlan((rows) => [...(rows ?? []), event.row as PlanRow]);
            }
          } else if (event.type === "plan") {
            if (event.row) setLivePlan((rows) => [...(rows ?? []), event.row as PlanRow]);
            if (event.row) opts.plan?.push(event.row as PlanRow);
          } else if (event.type === "meta") {
            meta = event;
          } else if (event.type === "done") {
            console.info(`[timing] generate: first output ${Math.round(((firstAt || performance.now()) - t0) / 1000)}s, done ${Math.round((performance.now() - t0) / 1000)}s, ${received} pieces, ${event.usage?.outputTokens ?? "?"} output tokens`);
            dispatch({ type: "GENERATION_DONE", usage: event.usage });
            opts.onDone?.(event);
            // The route says when the model hit max_tokens. The slides that
            // arrived stay; the user is told instead of handed a short deck.
            if (event.truncated && !opts.collectInsert) {
              dispatch({
                type: "GENERATION_ERROR",
                error: `The deck was cut short at ${received} slide${received === 1 ? "" : "s"}: the model ran out of room. Ask for fewer slides or a shorter brief, or generate the rest with Generate more slides.`,
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
        const keep = collected.map((s) => !titles.has((s.title ?? "").trim().toLowerCase()));
        const fresh = collected.filter((_, i) => keep[i]).slice(0, cap);
        const freshAt = positions.filter((_, i) => keep[i]).slice(0, cap);
        if (fresh.length > 0) {
          dispatch({
            type: "INSERT_SLIDES",
            at: meta?.insertAfter ?? null,
            contents: fresh,
            positions: freshAt,
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
  // The last replica's fidelity report (lib/slides/fidelity.ts): session
  // state like chaptersSkipped, cleared by the next generation, never saved.
  const [fidelity, setFidelity] = useState<DeckFidelity | null>(null);
  // PDFs whose pages the model transcribed: their report says the figures came from page images.
  const transcribedRef = useRef(new Set<string>());

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
        // A PDF is also read page by page, for "replicate it" (28 Sep 2026).
        // One with no text layer (outlined type from Figma or Illustrator, a
        // scan) keeps its page count instead: the use question is asked for
        // every PDF all the same, and a replica transcribes its pages on
        // Generate (runGenerate). Before, it had no slides, so the question
        // never showed.
        if (/\.pdf$/i.test(file.name) && canQuestion(a)) {
          try {
            const { slides, pages } = await readPdfSlides(await file.arrayBuffer());
            if (slides.length) a = { ...a, sourceSlides: slides };
            else if (a.kind === "pdf") a = { ...a, pageCount: pages };
          } catch {
            // pdf.js could not open it; the model may still read it.
            if (a.kind === "pdf") a = { ...a, pageCount: 0 };
          }
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
  /** A brief that mentions a file with none attached: asked first, keyed to the brief's text. */
  const [noFileQ, setNoFileQ] = useState<{ brief: string; answers: SheetAnswers; asked?: boolean } | null>(null);
  /** The deck's length, asked last when the brief names none; keyed to the brief's text like briefQ. */
  const [lengthQ, setLengthQ] = useState<{ brief: string; answers: SheetAnswers; asked?: boolean } | null>(null);
  /**
   * A file that can be replicated: a PowerPoint or a PDF, and for a
   * two-pager any document (a Word draft too), since it is rebuilt as one
   * piece rather than slide by slide. Spreadsheets never are.
   */
  const replicable = (a: Attachment): a is Extract<Attachment, { kind: "text" | "pdf" }> => {
    if (a.kind === "text" && twoPager && !a.spreadsheet && a.text.trim()) return true;
    return isDeckSource(a);
  };
  /** A replica keeps the source's length, so the length question has nothing to ask. */
  const replicaChosen = () => attachments.some((x) => replicable(x) && fileUseOf(x.answers) === "replicate");
  /** `app/api/analyze` reads one file next to the brief; the result sits on the attachment. */
  const analyzeAttachment = async (a: Attachment, brief: string) => {
    if (!canQuestion(a)) return;
    const spreadsheet = a.kind === "text" && !!a.spreadsheet;
    // A PowerPoint file or a PDF is always asked what to do with it, first (Mario, 28 Sep 2026).
    const withUse = (analysis: SheetAnalysis): SheetAnalysis =>
      replicable(a) ? { ...analysis, questions: [fileUseQuestion(replicaCountOf(a), unitOf(a), twoPager), ...analysis.questions] } : analysis;
    const update = (patch: { analysis?: SheetAnalysis; analysisError?: string }) =>
      setAttachments((list) => list.map((x) => (x.id === a.id && canQuestion(x) ? preselectFileUse({ ...x, ...patch }) : x)));
    // The use question does not wait on the model: it shows the moment the
    // wizard opens, and the model's own questions join it when they land. A
    // slow analysis (the Gambia pptx sat on "Reading the file…" past 90 s,
    // 28 Sep 2026) left only "Skip the questions", which skipped this one too.
    update(replicable(a) && !a.analysis ? { analysisError: undefined, analysis: withUse({ summary: "", questions: [] }) } : { analysisError: undefined });
    try {
      // The analysis reads the first 12k characters: a long deck says how long it is, or the summary counts only what it saw.
      const text =
        a.kind === "text" && a.sourceSlides?.length
          ? `${unitOf(a) === "pages" ? `A PDF of ${a.sourceSlides.length} pages` : `A PowerPoint deck of ${a.sourceSlides.length} slides`}; the text of the first ones follows.\n\n${a.text}`
          : a.kind === "text"
            ? a.text
            : "";
      const payload = a.kind === "pdf" ? { name: a.name, pdf: a.data } : { name: a.name, text };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, kind: spreadsheet ? "spreadsheet" : "document", brief }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const read = normalizeAnalysis(await res.json());
      if (!read) throw new Error("The file gave no questions");
      const analysis = withUse(read);
      update({ analysis });
      if (analysis.questions.length === 0) passOver(a.id);
    } catch (err) {
      // A document that could not be read is not worth a red box: the file still travels whole.
      if (spreadsheet) update({ analysisError: err instanceof Error ? err.message : "Analysis failed" });
      else {
        const analysis = withUse({ summary: "", questions: [] });
        update({ analysis });
        if (analysis.questions.length === 0) passOver(a.id);
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
    if (id === "nofile") setNoFileQ((q) => (q ? { ...q, answers } : q));
    else if (id === "length") setLengthQ((q) => (q ? { ...q, answers } : q));
    else if (id === "brief") setBriefQ((q) => (q ? { ...q, answers } : q));
    else
      setAttachments((list) =>
        list.map((x) => (x.id === id && canQuestion(x) && x.analysis ? { ...x, answers, insights: compileInsights(x.analysis, answers) } : x)),
      );
  };
  const markAsked = (id: string) => {
    if (id === "nofile") setNoFileQ((q) => (q ? { ...q, asked: true } : q));
    else if (id === "length") setLengthQ((q) => (q ? { ...q, asked: true } : q));
    else if (id === "brief") setBriefQ((q) => (q ? { ...q, asked: true } : q));
    else setAttachments((list) => list.map((x) => (x.id === id && canQuestion(x) ? { ...x, asked: true } : x)));
  };
  /** The current subject is done (answered, skipped or clear): the next one, or the deck. */
  const advanceFrom = (w: { queue: string[]; intent: "generate" | "edit" }) => {
    // "Attach the file": stop here and open the picker; the next Generate goes on from the file.
    if (w.queue[0] === "nofile" && noFileQ?.answers[MISSING_FILE_QUESTION_ID] === ATTACH_IT) {
      setWizard(null);
      setNoFileQ(null);
      document.querySelector<HTMLInputElement>('[data-tour="prompt"] input[type="file"]')?.click();
      return;
    }
    markAsked(w.queue[0]);
    // The length is moot once the file is to be replicated, answered just before.
    const rest = w.queue.slice(1).filter((id) => id !== "length" || !replicaChosen());
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
    if (id === "nofile") return { id, title: "No file attached", kind: "missing", analysis: missingFileAnalysis, answers: noFileQ?.answers ?? {} };
    if (id === "length") return { id, title: "Deck length", kind: "length", analysis: lengthAnalysisFor(state.chapters), answers: lengthQ?.answers ?? {} };
    const a = attachments.find((x) => x.id === id);
    if (!a || !canQuestion(a)) return null;
    return { id, title: a.name, kind: a.kind === "text" && a.spreadsheet ? "spreadsheet" : "document", analysis: a.analysis, answers: a.answers ?? {}, error: a.analysisError };
  })();
  /** The Generate press: first the questions still to ask, then the deck. */
  const onGenerate = () => {
    const brief = state.brief;
    // An attached deck is asked what to do with it on every press until the
    // choice is made (Mario, 28 Sep 2026: a file whose questions were already
    // answered went straight to the deck and the choice never showed).
    const undecidedDeck = (a: Attachment) => replicable(a) && !a.answers?.[USE_QUESTION_ID];
    const queue = attachments.filter(canQuestion).filter((a) => !a.asked || undecidedDeck(a)).map((a) => a.id);
    const words = brief.trim().split(/\s+/).filter(Boolean).length;
    const briefAlone = attachments.length === 0 && !twoPager && words > 0 && words < SHORT_BRIEF_WORDS;
    if (briefAlone && !(briefQ?.brief === brief && briefQ.asked)) queue.push("brief");
    // No length in the brief: ask for one, last. Not for a replica (it keeps
    // its source's length), nor for "one slide per objective": the brief's
    // list sets the length, and a picked 12 over 6 objectives read as 12
    // items and still came back as 8 slides (1 Oct 2026).
    const askLength =
      !twoPager && countFromBrief(brief) === undefined && !seriesFromBrief(brief) && !replicaChosen() && !(lengthQ?.brief === brief && lengthQ.asked);
    // A file already read and found clear has nothing to ask.
    const toAsk = queue.filter((id) => {
      if (id === "brief") return !(briefQ?.brief === brief && briefQ.analysis?.questions.length === 0);
      const a = attachments.find((x) => x.id === id);
      if (a && undecidedDeck(a)) return true;
      return !(a && canQuestion(a) && a.analysis && a.analysis.questions.length === 0);
    });
    if (askLength) {
      toAsk.push("length");
      if (lengthQ?.brief !== brief) setLengthQ({ brief, answers: {} });
    }
    // The brief talks about a file and none is attached: ask that first.
    if (attachments.length === 0 && mentionsMissingFile(brief) && !(noFileQ?.brief === brief && noFileQ.asked)) {
      toAsk.unshift("nofile");
      if (noFileQ?.brief !== brief) setNoFileQ({ brief, answers: {} });
    }
    if (toAsk.length === 0) return void runGenerate();
    queue.length = 0;
    queue.push(...toAsk);
    for (const id of queue) {
      if (id === "length" || id === "nofile") continue;
      if (id === "brief") {
        if (briefQ?.brief !== brief) void analyzeBrief(brief);
      } else {
        const a = attachments.find((x) => x.id === id)!;
        if (canQuestion(a) && !a.analysis) void analyzeAttachment(a, brief);
        // Read before the choice existed: the choice goes in front of its questions.
        else if (replicable(a) && a.analysis && !a.analysis.questions.some((q) => q.id === USE_QUESTION_ID)) {
          const analysis = { ...a.analysis, questions: [fileUseQuestion(replicaCountOf(a), unitOf(a), twoPager), ...a.analysis.questions] };
          setAttachments((list) => list.map((x) => (x.id === a.id && canQuestion(x) ? preselectFileUse({ ...x, analysis }) : x)));
        }
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


  /**
   * The programme logo a new two-pager opens with (Mario, 7 Oct 2026): an
   * attached image whose file name says "logo", else the logo of a programme
   * the brief or an attached file names (pages/logos.ts).
   */
  const pieceLogo = (brief: string, extra = ""): string | undefined => {
    const img = attachments.find((a) => a.kind === "image" && /logo/i.test(a.name));
    if (img && img.kind === "image") return `data:${img.mediaType};base64,${img.data}`;
    const texts = attachments.map((a) => (a.kind === "text" ? a.text : a.name)).join(" ");
    return logoFor(`${brief} ${extra} ${texts}`)?.src;
  };

  /**
   * The two-pager's fit pass (lib/slides/pages/fit.ts): each page is drawn
   * off-screen and measured, set tighter until it fits, and as a last step
   * its longest block is shortened by the model. `from` is the index of the
   * first page in the deck. The first page of a new piece is dated here, once,
   * so the masthead does not change month with every reopening.
   */
  const fitPages = async (pages: SlideContent[], from: number, opts: { dated?: boolean; keepText?: boolean } = {}): Promise<void> => {
    setFitting(true);
    try {
      await fitEach(pages, from, opts);
    } finally {
      setFitting(false);
    }
  };
  const fitEach = async (pages: SlideContent[], from: number, opts: { dated?: boolean; keepText?: boolean }): Promise<void> => {
    const total = Math.max(state.slides.length, from + pages.length);
    const call = async (payload: object): Promise<Record<string, unknown> | null> => {
      const res = await fetch("/api/page-shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
    };
    let shortens = 0;
    let shortenMs = 0;
    const tFitAll = performance.now();
    const resize: Resizer = {
      shorten: async (block, chars) => {
        const t = performance.now();
        shortens++;
        const out = normalizePage([(await call({ block: lightBlock(block), chars }))?.block])?.[0] ?? null;
        shortenMs += performance.now() - t;
        return out;
      },
    };
    // A new piece fills page one before page two (pullForward); a page
    // rewritten on its own keeps its blocks where they are.
    const filled = opts.dated && pages.length > 1 ? await pullForward(fillPagePhotos(pages) as Slide[], theme) : fillPagePhotos(pages);
    // A page emptied by pullForward goes (from the end, so indexes hold).
    const emptied: number[] = [];
    for (let i = 0; i < filled.length; i++) {
      const index = from + i;
      if (!(filled[i].stack?.length ?? 0)) {
        emptied.push(index);
        continue;
      }
      const page = { ...filled[i], id: `fit-${index}` } as Slide;
      if (opts.dated && index === 0 && !page.pageDate) page.pageDate = pageDateNow();
      // A replica keeps every word: its pages may only be set tighter.
      const { slide } = await fitPage(page, theme, index, total, opts.keepText ? { shorten: async () => null } : resize);
      const { id: _id, ...content } = slide;
      void _id;
      dispatch({ type: "REPLACE_SLIDE", index, content });
    }
    for (const index of emptied.reverse()) dispatch({ type: "DELETE", index });
    console.info(`[timing] fit ${pages.length} pages: ${Math.round((performance.now() - tFitAll) / 1000)}s, ${shortens} shorten call(s) taking ${Math.round(shortenMs / 1000)}s`);
  };

  /** `fallback`: a replica that could not run, said in the sidebar once the deck generated from the file as a source is in. */
  const runGenerate = async (fallback?: string): Promise<void> => {
    const brief = state.brief;
    setFidelity(null);
    // "Replicate it" on an attached deck: slide by slide, see runReplicate.
    // A PDF with no text layer is transcribed first (transcribeThenReplicate).
    const replica = !fallback ? attachments.find((x) => replicable(x) && fileUseOf(x.answers) === "replicate") : undefined;
    if (replica && canQuestion(replica)) {
      // A replica's chapters are the source's: an old "left out" note would not apply.
      setChaptersSkipped(null);
      if (replica.kind === "pdf" && !replica.sourceSlides?.length) return transcribeThenReplicate(replica);
      return runReplicate(replica);
    }
    // A two-pager is a fixed-length piece, so the count is the user's; a
    // slide deck takes the number the brief names, if any.
    const count = twoPager ? state.count : (countFromBrief(brief) ?? (lengthQ?.brief === brief ? lengthOf(lengthQ.answers) : undefined));
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
    // Chapters on and the model still left them out (lib/slides/chapters.ts):
    // an agenda for dividers that came without one, and for a deck with no
    // dividers at all, one small call groups the slides into chapters.
    if (received > 0 && chapters && !twoPager) {
      dispatch({ type: "ENSURE_AGENDA" });
      if (needsChapterPlan(kept)) {
        try {
          const res = await fetch("/api/chapters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titles: chapterCandidates(kept), brief }),
          });
          const plan = res.ok ? ((await res.json()) as { chapters?: ChapterPlan }).chapters : undefined;
          if (plan?.length) dispatch({ type: "APPLY_CHAPTERS", plan });
        } catch {
          // The deck stands without chapters; the toggle is still on, so the next generate tries again.
        }
      }
    }
    // A two-pager that came back as running text is laid out again once,
    // with the reasons and its own text (Mario, 7 Oct 2026: "too textual,
    // too linear"). The second answer stays only if it reads better.
    let pieces = kept;
    if (received > 0 && twoPager && !truncated) {
      const issues = layoutIssues(kept);
      if (issues.length) {
        const again: SlideContent[] = [];
        const got = await runGeneration(
          {
            mode: "generate",
            brief,
            attachments,
            brandLabel: theme.label,
            format: state.format,
            count,
            relayout: issues.join("; "),
            relayoutPages: JSON.stringify(kept.map((k) => ({ stack: (k.stack ?? []).map((b) => ({ type: b.type, rail: b.rail, heading: b.heading, body: b.body, items: b.items?.map((it) => ({ label: it.label, body: it.body })) })) }))),
          },
          { replace: true, collect: again },
        );
        if (got > 0 && layoutIssues(again).length < issues.length) pieces = again;
        else {
          // The first draft back on screen.
          dispatch({ type: "GENERATION_START", replace: true });
          for (const c of kept) dispatch({ type: "APPEND_SLIDE", content: c });
          dispatch({ type: "GENERATION_DONE" });
        }
        console.info(`[timing] relayout: ${issues.join("; ")} -> ${pieces === kept ? "kept the first draft" : `second draft (${layoutIssues(again).length} issues left)`}`);
      }
    }
    if (received > 0 && twoPager) {
      pieces = tidyBriefPieces(pieces);
      const logo = pieceLogo(brief);
      await fitPages(logo ? [{ ...pieces[0], pageLogo: logo }, ...pieces.slice(1)] : pieces, 0, { dated: true });
    }
    if (received > 0 && TIERS_REQUEST.test(brief)) dispatch({ type: "INSERT_TIERS" });
    if (received > 0) onDeckArrived();
    if (received > 0 && fallback) dispatch({ type: "GENERATION_ERROR", error: fallback });
  };

  /**
   * Replicate on a PDF pdf.js could not read (outlined type, a scan; 28 Sep
   * 2026): the model transcribes its pages first (app/api/transcribe), under
   * the generating state, and the replica then runs on that text as on any
   * PDF. The pages are kept on the attachment, so a second press does not
   * read them again. A failed transcription is not a dead end: the deck is
   * generated with the file as a source, and the sidebar says so.
   */
  const transcribeThenReplicate = async (file: Extract<Attachment, { kind: "pdf" }>): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "GENERATION_START", replace: true });
    let sourceSlides: ReturnType<typeof slidesFromTranscript> = [];
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, pdf: file.data, pages: file.pageCount || MAX_TRANSCRIBED_PAGES }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Request failed (${res.status})`);
      sourceSlides = slidesFromTranscript((await res.json()) as Transcript);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    if (!planReplica(sourceSlides).steps.length) {
      return runGenerate(`Could not read the pages of "${file.name}" to replicate them, so the deck uses it as a source.`);
    }
    setAttachments((list) => list.map((x) => (x.id === file.id && canQuestion(x) ? { ...x, sourceSlides } : x)));
    transcribedRef.current.add(file.id);
    return runReplicate({ ...file, sourceSlides });
  };

  /**
   * Replicating a deck (Mario, 28 Sep 2026): the plan (lib/slides/replicate.ts)
   * fixes every slide of the new deck before any call, the agenda and the
   * dividers built from the source's structure; the cover and each content
   * slide are one call each (mode "replicate", only that slide's text),
   * six at a time, and land in order as the prefix completes. The count and
   * the order are the source's by construction: a single call for a deck of
   * thirty returned twenty-one and a top-up that put eight slides in one
   * block. No rhythm pass and no merge: the slides are the source's, one to
   * one; only empty photo slots are filled and the closing slide added.
   */
  /**
   * The deck's language as it stands: absent until the first switch, when the
   * deck is taken to be in the language its own text is written in.
   */
  const deckLang = (): DeckLang => {
    if (state.lang) return state.lang;
    const all = state.slides.flatMap((s) => textFields(s).map((f) => f.text)).join(" ");
    const written = detectLang(all, languageOf(all));
    return { source: written, current: written, texts: {} };
  };

  /** The jobs of a switch through /api/translate, in batches, by the language they are written in. */
  const translateJobs = async (jobs: Job[], to: Lang): Promise<Map<string, string>> => {
    const done = new Map<string, string>();
    // Small batches side by side: a call's time grows with its output, so a
    // two-pager in one call of forty fields took 40 s, in batches of 15 about 5.
    const BATCH = 15;
    const batches: Job[][] = [];
    for (const from of new Set(jobs.map((j) => j.from))) {
      const group = jobs.filter((j) => j.from === from);
      for (let i = 0; i < group.length; i += BATCH) batches.push(group.slice(i, i + BATCH));
    }
    const run = async (batch: Job[]) => {
      // A page title's accent phrase is translated beside its heading, and must stay inside it.
      const idOf = (j: Job) => String(jobs.indexOf(j));
      const items = batch.map((j) => {
        const heading = j.path.endsWith(".highlight") ? batch.find((h) => h.slide === j.slide && h.path === j.path.replace(/highlight$/, "heading")) : undefined;
        return { id: idOf(j), text: j.text, ...(j.previous ? { previous: j.previous } : {}), ...(heading ? { highlightOf: idOf(heading) } : {}) };
      });
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: batch[0].from, to, items }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Translation failed (${res.status})`);
      const { items: out } = (await res.json()) as { items: { id: string; text: string }[] };
      for (const x of out) {
        const j = jobs[Number(x.id)];
        if (j && x.text.trim()) done.set(`${j.slide}\u0000${j.path}`, undash(x.text));
      }
    };
    for (let i = 0; i < batches.length; i += 6) await Promise.all(batches.slice(i, i + 6).map(run));
    return done;
  };

  /**
   * The whole deck into another language (Mario, 6 Oct 2026). What the memory
   * already has in that language comes back as it was, his fixes included;
   * only new fields and fields whose original changed are translated.
   */
  const switchLanguage = async (to: Lang, opts: { slides?: Slide[]; asked?: boolean } = {}) => {
    if (translating || state.status === "generating" || fitting || !state.slides.length) return;
    const lang0 = deckLang();
    if (to === lang0.current) return;
    // Texts changed by hand in the language being left: ask first, keep or go back.
    if (!opts.asked) {
      const edits = newEdits(state.slides, state.lang);
      if (edits.length) {
        setPendingSwitch({ to, edits });
        return;
      }
    }
    const from = opts.slides ?? state.slides;
    setTranslating(to);
    try {
      const texts = snapshot(from, lang0);
      const { ready, jobs } = plan(from, lang0, texts, to);
      const translated = jobs.length ? await translateJobs(jobs, to) : new Map<string, string>();
      // A batch that came back short leaves those texts as they were, said rather than hidden.
      const missing = jobs.length - jobs.filter((j) => translated.has(`${j.slide}\u0000${j.path}`)).length;
      const slides = apply(from, ready, translated);
      const lang: DeckLang = { ...lang0, current: to, texts: remember(slides, texts, lang0, to, jobs, translated) };
      dispatch({ type: "SET_LANGUAGE", slides, lang });
      if (twoPager) await fitPages(slides, 0, { keepText: true });
      if (missing) dispatch({ type: "GENERATION_ERROR", error: `${missing} text${missing === 1 ? " was" : "s were"} not translated and stayed as they were. Switch again to retry.` });
    } catch (err) {
      dispatch({ type: "GENERATION_ERROR", error: `Could not translate the deck: ${(err as Error).message}` });
    } finally {
      setTranslating(null);
    }
  };

  /**
   * Replicate on a two-pager (Mario, 6 Oct 2026: the source fidelity always
   * shows after a replica, two-pagers included). The document is rebuilt in
   * one call, every text kept (REPLICATE_PAGES in prompt.ts), as many pages
   * as its words need, two at least; the fit pass may only tighten the type,
   * never cut; and the piece is measured against the whole document with the
   * same measures as a slide replica (lib/slides/fidelity.ts).
   */
  const runReplicatePages = async (file: Extract<Attachment, { kind: "text" | "pdf" }>) => {
    const sources = file.sourceSlides ?? [];
    // The reader's notes ("Figures written on the slide (…): 02, 54") are for
    // slide charts: the piece gets the figures, not the note (a "54" a PDF
    // reader filed as a chart label is the "Countries engaged" figure).
    const rawText = (sources.length ? sources.map((s) => s.text).join("\n\n") : file.kind === "text" ? file.text : "")
      .split("\n")
      .map((l) => l.replace(/^\s*(Chart labels|Figures) written on the slide[^:]*:\s*/, ""))
      // The source's masthead is not content: its lockup, a page number on
      // its own, the date line ("OCTOBER 2026"). A replica made a section of
      // them above the stats (Mario, 6 Oct 2026).
      .filter((l) => !isMastheadLine(l))
      .join("\n");
    // The PDF's line ends inside sentences go: a paragraph is one line again.
    const text = unwrapLines(rawText);
    if (!text.trim()) return runGenerate(`Could not read the text of "${file.name}" to replicate it, so the two-pager uses it as a source.`);
    const words = text.split(/\s+/).filter(Boolean).length;
    // About 600 words fill an A4 page of this grid with a banner or a stat row.
    const count = Math.max(2, Math.min(6, Math.ceil(words / 600)));
    const brief = state.brief.trim() || `Replicate "${file.name}" as a two-pager.`;
    const briefNotes = file.analysis ? compileInsights(file.analysis, file.answers ?? {}) : undefined;
    const ignore = sources.length >= 3 ? runningLines(sources) : new Set<string>();
    const title = sources[0]?.title || file.name;
    const units = sourceUnits({ text }, ignore);
    const pass = async (repair?: string) => {
      const kept: SlideContent[] = [];
      const plan: PlanRow[] = [];
      const received = await runGeneration(
        // The PDF goes with its text: the model reads the layout (what sits
        // side by side, a card, a photo) from the pages, the words from the text.
        { mode: "generate", brief, briefNotes, brandLabel: theme.label, format: "two-pager", count, source: text, attachments: file.kind === "pdf" ? [file] : [], repair },
        { replace: true, collect: kept, plan },
      );
      return received ? { kept, plan, r: compareSlide(1, title, units, kept) } : null;
    };
    const tRep = performance.now();
    let best = await pass();
    if (!best) return;
    const firstPass = totals([best.r]);
    // Below 95%, one second pass told exactly what the first one changed
    // (repairNote), as a slide replica does; the closer of the two stays.
    let repairs = 0;
    let repaired = 0;
    // Up to two second passes, each told what the best answer so far changed.
    while (repairs < 2 && fidelityScore(best.r) < 95) {
      repairs++;
      const next = await pass(repairNote(best.r));
      if (next && fidelityScore(next.r) > fidelityScore(best.r)) {
        best = next;
        repaired++;
      }
    }
    // The pages on screen are the last pass's: put the closest one back.
    if (repairs > 0) {
      dispatch({ type: "GENERATION_START", replace: true });
      for (const c of best.kept) dispatch({ type: "APPEND_SLIDE", content: c });
      dispatch({ type: "GENERATION_DONE" });
    }
    // What the model still left out, the app puts back (lib/slides/pages/restore.ts).
    const modelPass = totals([best.r]);
    // Source figures that landed nowhere, in source order: a card without a figure takes them.
    // As written in the source ("2.3M"), not the check's normalised key ("2.3").
    const asWritten = (w: { figure: string; source: string }) =>
      w.source.split(/[\s,;]+/).find((t) => t.replace(/[,\s]/g, "").toLowerCase().includes(w.figure)) ?? w.figure;
    const check = compareSlide(1, title, units, best.kept);
    const unplaced = [...new Set(check.figures.wrong.filter((w) => !/^0\d$/.test(w.figure)).map(asWritten))];
    const cleaned = fillStatFigures(dropStatEchoes(best.kept), unplaced, check.lines.missing, text);
    const { pages: restored, putBack } = putBackLines(cleaned, units.lines, compareSlide(1, title, units, cleaned).lines.missing);
    // The shape rules (restore.ts shapeReplica): no invented heads, one
    // comparison table, no page number as a figure, a banner opens a page.
    const kept = shapeReplica(restored, text);
    const r = compareSlide(1, title, units, kept);
    const logo = pieceLogo(state.brief, text);
    if (logo && kept[0]) kept[0] = { ...kept[0], pageLogo: logo };
    const tFit = performance.now();
    await fitPages(kept, 0, { dated: true, keepText: true });
    console.info(`[timing] replica: ${repairs} repair pass(es), model ${Math.round((tFit - tRep) / 1000)}s, fit ${Math.round((performance.now() - tFit) / 1000)}s`);
    setFidelity({
      slides: [{ ...r, at: 0, layoutId: "a4-page", deckTitle: kept[0]?.stack?.[0]?.heading ?? title, parts: kept.length, putBack }],
      leftovers: [],
      firstPass,
      modelPass,
      repairs,
      repaired,
      restored: { putBack, rebuilt: 0, continued: 0, trimmed: 0 },
      piece: { pages: kept.length, sourcePages: Math.max(1, sources.length) },
      layout: { plan: best.plan, notes: checkRhythm(kept, best.plan) },
    });
    onDeckArrived();
  };

  const runReplicate = async (file: Extract<Attachment, { kind: "text" | "pdf" }>) => {
    if (twoPager) return runReplicatePages(file);
    const sources = file.sourceSlides ?? [];
    const { steps } = planReplica(sources);
    if (!steps.length) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "GENERATION_START", replace: true });
    const brief = state.brief;
    const briefNotes = [
      briefQ?.brief === brief && briefQ.analysis ? compileInsights(briefQ.analysis, briefQ.answers) : "",
      file.analysis ? compileInsights(file.analysis, file.answers ?? {}) : "",
    ]
      .filter(Boolean)
      .join(" ");
    const total = steps.length + 1;
    const first = steps[0];
    const deckTitle = first.kind === "cover" ? first.source.title : file.name;
    let chapter = "";
    const contexts = steps.map((st, i) => {
      if (st.kind === "fixed" && st.content.layoutId === "section-divider") chapter = st.content.title ?? "";
      return (
        `This is slide ${i + 1} of ${total} of the deck "${deckTitle}"${chapter ? `, in the chapter "${chapter}"` : ""}.` +
        (st.kind === "cover" ? " It is the COVER: use the cover layout, the deck's title as written and, as subtitle, the document type and date the source slide gives." : "") +
        (st.kind === "content" ? densityHint(st.source) : "")
      );
    });
    // Each step lands as one slide, or as a slide and its continuations
    // when the app had to split what the source slide carries (restore.ts).
    const results: (SlideContent[] | null | undefined)[] = steps.map((st) => {
      if (st.kind !== "fixed") return undefined;
      const fixed = normalizeSlide(st.content, { brandId: state.brandId });
      return fixed ? [fixed] : null;
    });
    // The fidelity check (lib/slides/fidelity.ts): each source slide against
    // the slide made from it, a running header left out.
    const ignore = runningLines(sources);
    const units = steps.map((st) => (st.kind === "fixed" ? null : sourceUnits(st.source, ignore)));
    const reports: (SlideFidelity | null)[] = steps.map(() => null);
    const firsts: (SlideFidelity | null)[] = steps.map(() => null);
    const models: (SlideFidelity | null)[] = steps.map(() => null);
    const restored: (Restored | null)[] = steps.map(() => null);
    let repairs = 0;
    let repaired = 0;
    // The app's guarantee after the model (lib/slides/restore.ts): every
    // line and figure of the source on the slide, text at 18px or more,
    // measured here with the real autofit.
    const fits = (s: SlideContent) => readable(ensureId(s), theme);
    const cont = continuationLabel(sources.map((x) => x.title));
    const usage = { inputTokens: 0, outputTokens: 0 };
    let next = 0;
    let firstLanding = true;
    const flush = () => {
      while (next < steps.length && results[next] !== undefined) {
        const landed = results[next++];
        if (!landed) continue;
        if (firstLanding) {
          firstLanding = false;
          flightRef.current = genPillRef.current?.getBoundingClientRect() ?? null;
        }
        for (const content of landed) dispatch({ type: "APPEND_SLIDE", content });
      }
    };
    /** One call for step i: the slide as the model wrote it, before normalizeSlide. */
    const call = async (i: number, source: string, extra: { repair?: string; previous?: SlideContent } = {}): Promise<unknown> => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "replicate", brief, briefNotes, brandLabel: theme.label, format: "slides", source, sourceContext: contexts[i], ...extra }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `Request failed (${res.status})`);
      let raw: unknown = null;
      for (const line of (await res.text()).split("\n")) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "slide" && raw === null) raw = event.slide;
        else if (event.type === "done" && event.usage) {
          usage.inputTokens += event.usage.inputTokens ?? 0;
          usage.outputTokens += event.usage.outputTokens ?? 0;
        } else if (event.type === "error") throw new Error(event.message ?? "Generation failed");
      }
      return raw;
    };
    /** The model's slide as this step takes it, or null. A chart's explanation is made dense before normalizeSlide could drop it. */
    const accept = (st: Exclude<ReplicateStep, { kind: "fixed" }>, raw: unknown): SlideContent | null => {
      const slide = normalizeSlide(denseBeforeNormalize(raw), { brandId: state.brandId });
      if (!slide) return null;
      if (st.kind === "cover") return { layoutId: "cover", title: slide.title || st.source.title, subtitle: slide.subtitle ?? "" };
      if (CHAPTER_LAYOUTS.has(slide.layoutId) || slide.layoutId === "thank-you" || slide.layoutId === "cover") return null;
      return withContentDensity(slide);
    };
    const one = async (i: number) => {
      const st = steps[i];
      if (st.kind === "fixed") return;
      let slide: SlideContent | null = null;
      // More items than the layout draws would be cut by normalizeSlide:
      // the first answer is asked again with the count, the second is kept
      // as it is and the cut shows in the report.
      let hint: string | undefined;
      let overflowing: unknown = null;
      for (let attempt = 0; attempt < 2 && !slide; attempt++) {
        try {
          const raw = await call(i, st.source.text, hint ? { repair: hint } : {});
          const over = st.kind === "content" && attempt === 0 ? overLimits(raw) : null;
          if (over) {
            overflowing = raw;
            hint = `Your first answer put ${over.count} ${over.field} on a layout that holds ${over.max}. Pick a layout that holds all ${over.count}, or spread them over more blocks or columns; never cut or merge them.`;
            continue;
          }
          slide = accept(st, raw);
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
        }
      }
      if (!slide && overflowing) slide = accept(st, overflowing);
      // The check, and one repair call when the slide changed the source:
      // the precise list of what changed, the better of the two is kept.
      let report = compareSlide(st.source.n, st.source.title, units[i]!, slide);
      firsts[i] = report;
      if (slide && st.kind === "content" && isFlawed(report)) {
        repairs++;
        try {
          const { image: _im, ...previous } = slide;
          void _im;
          const second = accept(st, await call(i, st.source.text, { repair: repairNote(report), previous }));
          const again = second ? compareSlide(st.source.n, st.source.title, units[i]!, second) : null;
          if (second && again && fidelityScore(again) > fidelityScore(report)) {
            slide = second;
            report = again;
            repaired++;
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
        }
      }
      models[i] = report;
      // What the model still changed, the app restores without another call:
      // put back, rebuilt from the source, continued (restore.ts). A slide
      // the model could not write at all is rebuilt from the source.
      try {
        const done =
          st.kind === "cover"
            ? restoreCover(st.source.n, st.source.title, units[i]!, slide ?? { layoutId: "cover", title: st.source.title, subtitle: "" }, fits)
            : restoreSlide(st.source.n, st.source.title, units[i]!, slide, fits, { cont, boxes: st.source.boxes });
        restored[i] = done;
        reports[i] = done.report;
        results[i] = done.slides.map((x) => normalizeSlide(x, { brandId: state.brandId }) ?? x);
      } catch (err) {
        console.error(err);
        reports[i] = report;
        results[i] = slide ? [slide] : null;
      }
    };
    try {
      flush();
      let cursor = 0;
      const worker = async () => {
        while (cursor < steps.length) {
          const i = cursor++;
          await one(i);
          flush();
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      flush();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      dispatch({ type: "GENERATION_ERROR", error: (err as Error).message });
      return;
    }
    dispatch({ type: "ENSURE_CLOSING" });
    dispatch({ type: "FILL_PHOTOS" });
    dispatch({ type: "GENERATION_DONE", usage });
    // The report replaces the red error: a slide that could not be rebuilt
    // is one line in it, with its text. Only a replica with nothing rebuilt
    // is still an error.
    const leftovers: Leftover[] = [
      ...steps.flatMap((st, i) => (st.kind !== "fixed" && !results[i]?.length ? [{ n: st.source.n, title: st.source.title, lines: units[i]?.lines ?? [], reason: "failed" as const }] : [])),
      ...planLeftovers(sources, steps, ignore),
    ].sort((x, y) => x.n - y.n);
    let at = 0;
    const slides: DeckFidelity["slides"] = [];
    steps.forEach((_, i) => {
      const r = reports[i];
      const landed = results[i];
      const how = restored[i];
      if (r && landed?.length)
        slides.push({ ...r, at, layoutId: landed[0].layoutId, deckTitle: landed[0].title ?? "", putBack: how?.putBack ?? 0, putBackLines: how?.lines, rebuilt: !!how?.rebuilt, parts: landed.length });
      at += landed?.length ?? 0;
    });
    const valid = <T,>(list: (T | null)[]) => list.filter((r): r is T => !!r);
    const done = valid(restored);
    setFidelity({
      slides,
      leftovers,
      transcribed: transcribedRef.current.has(file.id),
      firstPass: totals(valid(firsts), leftovers),
      modelPass: totals(valid(models), leftovers),
      repairs,
      repaired,
      restored: {
        putBack: done.reduce((n, r) => n + r.putBack, 0),
        rebuilt: done.filter((r) => r.rebuilt).length,
        continued: done.reduce((n, r) => n + r.slides.length - 1, 0),
        trimmed: done.reduce((n, r) => n + r.trimmed, 0),
      },
    });
    onDeckArrived();
  };

  /**
   * Strip fields the model must never see: uploaded images and logos are
   * base64 data URLs (a single photo once blew a request past 350K tokens),
   * and tier grids are meaningless to it.
   */
  const lightSlide = ({ id: _id, image: _im, imagePos: _ip, logoTone: _lt, logos: _lg, grid: _gr, map: _mp, chartSource: _cs, ...content }: (typeof state.slides)[number]) =>
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

  const onRegenerateSlide = async (instruction: string, target: Slide = active!) => {
    if (!active) return;
    const index = state.activeIndex;
    const page = isPage(active) ? active : null;
    const rewritten: SlideContent[] = [];
    await runGeneration(
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
          ? { footerLabel: active.footerLabel, pageDate: active.pageDate }
          : {
              // A photo already on the slide stays; an empty slot lets the rewrite pick one from the library.
              ...(active.image ? { image: active.image, imagePos: active.imagePos } : {}),
              logos: active.logos,
              grid: active.grid,
              map: active.map,
              // A chart linked to a sheet stays linked: Update brings the sheet's numbers back.
              chartSource: active.chartSource,
              // Icons the user picked stay; otherwise the rewrite brings icons for its own words.
              ...(active.iconsPinned ? { icons: active.icons, iconsPinned: true } : {}),
              // A dense slide stays dense through a rewrite.
              ...(active.density ? { density: active.density } : {}),
            },
        mergeImages: isPage(active) ? active.stack : undefined,
        keepColors: active.bars,
        collect: rewritten,
      },
    );
    // A rewritten page is fitted to its sheet like a generated one.
    if (page && rewritten[0]) {
      await fitPages(
        [{ ...reattachImages(rewritten[0], page.stack), footerLabel: page.footerLabel, pageDate: page.pageDate }],
        index,
      );
    }
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
        { ...content, image: active.image, imagePos: active.imagePos, logos: active.logos, grid: active.grid, icons: active.icons, map: active.map, chartSource: isChartLayout(content.layoutId) ? active.chartSource : undefined },
        active.bars,
      ),
    });
    setLayoutSwitcher(false);
  };

  const onInsertLayout = (layoutId: LayoutId, dense = false) => {
    dispatch({ type: "INSERT", content: dense ? denseContent(layoutId) : defaultContent(layoutId) });
    onDeckArrived();
  };

  // On a page the editable array belongs to the block you are working in, so
  // "Add element" needs to know which one that is.
  const activePage = active && isPage(active) ? active : null;
  const stack = activePage?.stack ?? [];
  const block = stack[Math.min(focusedBlock ?? 0, stack.length - 1)];
  const blockLimits = block ? PAGE_BLOCK_LIMITS[block.type] : null;
  const canAddItem = activePage
    ? !!blockLimits && (block?.items?.length ?? 0) < blockLimits[1]
    : !!active &&
      !!PRIMARY_ARRAY[active.layoutId] &&
      ((active[PRIMARY_ARRAY[active.layoutId]!.field] as unknown[] | undefined)?.length ?? 0) <
        PRIMARY_ARRAY[active.layoutId]!.max;
  /**
   * Links a text to the footnote (Mario, 28 Sep 2026: "how do I connect a
   * footnote to a text?"): the next superscript number goes where the caret
   * is in the slide's text, the edit is committed, and the footnote gets the
   * matching "N. " when it does not have it yet. Typing "^1" does the same
   * without the button (SlideFrame).
   */
  const onReference = () => {
    if (!active || isPage(active)) return;
    const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    const focused = document.activeElement as HTMLElement | null;
    const target = focused?.closest<HTMLElement>('[data-tour="canvas"] [data-edit]');
    if (!target || target.getAttribute("data-edit") === "notes") {
      dispatch({ type: "GENERATION_ERROR", error: "Click in the text where the reference goes, then press Reference (or type ^1 there)." });
      return;
    }
    const { notes = "", ...rest } = active;
    const used = [...JSON.stringify(rest)].map((c) => SUP.indexOf(c)).filter((d) => d > 0);
    const n = Math.min(9, Math.max(0, ...used) + 1);
    document.execCommand("insertText", false, SUP[n]);
    target.blur();
    if (!new RegExp(`(^|[\\s;])${n}\\.`).test(notes)) {
      dispatch({ type: "EDIT_FIELD", index: state.activeIndex, path: "notes", value: notes.trim() ? `${notes.trimEnd()}\n${n}. ` : `${n}. ` });
    }
  };
  const onAddItem = () => {
    // A partner is picked from the logo library or uploaded, not typed in.
    if (active?.layoutId === "partner") return setPartnerModal({ at: null });
    dispatch(
      activePage
        ? { type: "ADD_ITEM", index: state.activeIndex, path: `stack.${focusedBlock ?? 0}` }
        : { type: "ADD_ITEM", index: state.activeIndex },
    );
  };

  // High density (lib/slides/modular.ts): Element is a menu of what can be
  // added where the caret is, points are split and joined from the keyboard,
  // and an add that would push text under 18px is refused.
  const modular = !!active && !isPage(active) && isModular(active);
  const [addFocus, setAddFocus] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  /** The slide text that has the caret, if any. */
  const editingPath = () =>
    (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-tour="canvas"] [data-edit]')?.getAttribute("data-edit") ?? null;
  const noRoom = (what: string) =>
    dispatch({ type: "GENERATION_ERROR", error: `No room for another ${what} on this slide: the text would drop below 18px. Shorten the text or move some of it to a new slide.` });
  const addMenu: AddOption[] | null = modular ? addOptions(active, addFocus) : null;
  const onAddPart = (id: string) => {
    if (!active || !modular) return;
    const r = addPart(active, id, addFocus);
    if (!r) return;
    if (!roomFor(active, r.slide, theme)) return noRoom(addMenu?.find((o) => o.id === id)?.label.toLowerCase() ?? "element");
    // Commit the text being typed first (its own undo step), then the add.
    (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-tour="canvas"] [data-edit]')?.blur();
    dispatch({ type: "ADD_PART", index: state.activeIndex, part: id, focus: addFocus });
    if (r.focus) setFocusRequest({ path: r.focus });
  };
  const pointOps: PointOps | null =
    modular && active
      ? {
          isPoint: (path) => !!pointAt(active, path),
          split: (path, before, after) => {
            const r = insertPoint(active, path, after, before);
            if (!r) {
              dispatch({ type: "GENERATION_ERROR", error: "This list is full: ten points at most. Start a new block or a new slide." });
              return null;
            }
            if (!roomFor(active, r.slide, theme)) {
              noRoom("point");
              return null;
            }
            dispatch({ type: "INSERT_POINT", index: state.activeIndex, path, text: after, before });
            return r.path;
          },
          remove: (path) => {
            const r = removePoint(active, path);
            if (!r) return null;
            dispatch({ type: "DELETE_ITEM", index: state.activeIndex, path: pointAt(active, path)?.list.kind === "notes" ? path.replace(/\.body$/, "") : path });
            return r.focus;
          },
          nests: (path) => nests(active, path),
        }
      : null;

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
    // A two-pager prints on A4. The named `@page a4` rule alone is not enough:
    // Chrome does not apply a named page inside the absolutely positioned
    // print root, so every page went out on the 16:9 sheet, cut in two
    // (6 Oct 2026). For the length of the print the default sheet is A4.
    const sheet = twoPager ? document.createElement("style") : null;
    if (sheet) {
      sheet.textContent = "@page { size: 595pt 842pt; margin: 0; }";
      document.head.appendChild(sheet);
    }
    try {
      window.print();
    } finally {
      document.title = tabTitle;
      sheet?.remove();
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
    setFidelity(null);
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
    setFidelity(null);
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
  /** Two-pager: the fit pass is measuring and resizing the pages (lib/slides/pages/fit.ts). */
  const [fitting, setFitting] = useState(false);
  /**
   * A switch waiting on the question about the texts changed by hand in the
   * language being left (components/EditChoice.tsx).
   */
  const [pendingSwitch, setPendingSwitch] = useState<{ to: Lang; edits: ReturnType<typeof newEdits> } | null>(null);
  /** The partner slide's logo dialog: adding (`at` null) or replacing the partner at `at`. */
  const [partnerModal, setPartnerModal] = useState<{ at: number | null } | null>(null);
  /** Two-pager: the programme-logo menu, open at this point (components/LogoMenu.tsx). */
  const [logoMenu, setLogoMenu] = useState<{ x: number; y: number } | null>(null);
  /** The deck is being translated into this language (switchLanguage). */
  const [translating, setTranslating] = useState<Lang | null>(null);
  // Another page, or Esc outside a text: no block selected.
  const [selectedOn, setSelectedOn] = useState(state.activeIndex);
  if (selectedOn !== state.activeIndex) {
    setSelectedOn(state.activeIndex);
    setFocusedBlock(null);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (document.activeElement as HTMLElement | null)?.isContentEditable) return;
      setFocusedBlock(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // A page that runs past its sheet carries on to the next one (flowOver),
  // a moment after the edit that made it long, never while text is typed.
  const latestSlides = useRef(state.slides);
  useEffect(() => {
    latestSlides.current = state.slides;
  }, [state.slides]);
  useEffect(() => {
    if (!twoPager || state.status === "generating" || fitting || translating) return;
    const slides = state.slides;
    const timer = setTimeout(async () => {
      if ((document.activeElement as HTMLElement | null)?.isContentEditable) return;
      const flowed = await flowOver(slides, theme);
      // Measured on pages that have changed since: the next run has them.
      if (flowed && latestSlides.current === slides) dispatch({ type: "FLOW_PAGES", slides: flowed });
    }, 500);
    return () => clearTimeout(timer);
  }, [twoPager, state.slides, state.status, fitting, translating, theme]);
  /** Two-pager: where the block menu inserts, while it is open. */
  const [addBlockAt, setAddBlockAt] = useState<number | null>(null);
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
        fidelity={fidelity}
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
            finalLabel={
              wizardSubject.id === "nofile" && noFileQ?.answers[MISSING_FILE_QUESTION_ID] === ATTACH_IT
                ? "Choose file"
                : wizard.intent === "generate" && wizard.queue.length === 1
                  ? "Generate"
                  : wizard.queue.length > 1
                    ? ["length", "brief", "nofile"].includes(wizard.queue[1]) ? "Next" : "Next file"
                    : "Done"
            }
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
            {twoPager && livePlan && livePlan.length > 0 && (
              // The plan as it arrives: which block tells which part, page by page.
              <ol className="absolute left-1/2 top-[calc(50%+44px)] flex w-[min(560px,calc(100%-48px))] -translate-x-1/2 flex-col gap-1 text-[13px] leading-snug">
                {livePlan.slice(-8).map((r, i) => (
                  <li key={`${livePlan.length - Math.min(8, livePlan.length) + i}`} className="float-in grid grid-cols-[52px_120px_minmax(0,1fr)] gap-3 text-ink-muted">
                    <span className="tabular-nums text-ink-faint">Page {r.page}</span>
                    <span className="font-medium text-ink">{BLOCK_LABELS[r.block as keyof typeof BLOCK_LABELS] ?? r.block}</span>
                    <span className="truncate">{r.part.replace(/\s*[—–]\s*/g, ", ")}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : state.slides.length === 0 ? (
          <>
            <EmptyToolbar onOpenDeckFile={openDeckFilePicker} />
            <EmptyState
            twoPager={twoPager}
            previous={previous}
            onRestorePrevious={onRestorePrevious}
            onDismissPrevious={onDismissPrevious}
          />
          </>
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
              languageMenu={
                <LanguageMenu
                  current={deckLang().current}
                  source={deckLang().source}
                  busy={!!translating || state.status === "generating" || fitting}
                  onSwitch={(to) => void switchLanguage(to)}
                />
              }
            />
            {dataPanelOpen && active && isChart && (
              <ChartDataPanel
                // A new slide starts the panel afresh: no import or error carried over.
                key={active.id}
                slide={active}
                theme={theme}
                onChange={(bars, series) => dispatch({ type: "SET_BARS", index: state.activeIndex, bars, series })}
                // Imported numbers keep the colours picked by position (recolor's rule).
                onImport={(result, source) =>
                  dispatch({
                    type: "SET_BARS",
                    index: state.activeIndex,
                    bars: result.bars.map((b, i) => ({ ...b, color: active.bars?.[i]?.color })),
                    series: result.series,
                    source,
                  })
                }
                onUnlink={() => dispatch({ type: "SET_BARS", index: state.activeIndex, bars: active.bars ?? [], series: active.series, source: null })}
                onClose={() => setDataPanelOpen(false)}
              />
            )}
            <div className="flex min-h-0 flex-1">
            <div
              className="relative min-h-0 min-w-0 flex-1 p-6 pb-10"
              data-tour="canvas"
              // A click off the blocks drops the selection: the page's own bar comes back.
              onClick={(e) => {
                if (!twoPager) return;
                const t = e.target as HTMLElement;
                if (!t.closest("[data-block], .side-bar, button, [role=dialog], [role=menu]")) setFocusedBlock(null);
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
                    pointOps={pointOps}
                    canDeleteItem={modular ? (path) => deleteModular(active, path) !== null : null}
                    focusRequest={focusRequest}
                    onFocusDone={() => setFocusRequest(null)}
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
                      twoPager && state.status !== "generating" && !fitting
                        ? (from, to) => dispatch({ type: "MOVE_BLOCK", index: state.activeIndex, from, to })
                        : null
                    }
                    onAddBlock={twoPager ? (at) => setAddBlockAt((open) => (open == null ? at : null)) : null}
                    addingBlocks={addBlockAt != null}
                    onDuplicatePage={twoPager ? () => dispatch({ type: "DUPLICATE", index: state.activeIndex }) : null}
                    onDeletePage={twoPager ? (state.slides.length > 1 ? () => dispatch({ type: "DELETE", index: state.activeIndex }) : null) : undefined}
                    onDropNewBlock={
                      twoPager && state.status !== "generating" && !fitting
                        ? (type, at) => {
                            if (!(type in BLOCK_LABELS)) return;
                            dispatch({ type: "ADD_BLOCK", index: state.activeIndex, at, blockType: type as PageBlockType });
                            setFocusedBlock(at);
                          }
                        : null
                    }
                    onEditWithAi={twoPager ? () => setAiModal(true) : null}
                    onPickLogo={twoPager && state.activeIndex === 0 ? (at) => setLogoMenu(at) : null}
                    canAddBlockItem={
                      twoPager
                        ? (b) => {
                            const target = activePage?.stack?.[b];
                            // A text section grows by writing in it, not by rows (Mario, 7 Oct 2026).
                            const limits = target && target.type !== "section" ? PAGE_BLOCK_LIMITS[target.type] : null;
                            return !!limits && (target?.items?.length ?? 0) < limits[1];
                          }
                        : null
                    }
                    canRemoveBlockItem={
                      twoPager
                        ? (b) => {
                            const target = activePage?.stack?.[b];
                            const limits = target && target.type !== "section" ? PAGE_BLOCK_LIMITS[target.type] : null;
                            return !!limits && (target?.items?.length ?? 0) > Math.max(1, limits[0]);
                          }
                        : null
                    }
                    onAddBlockItem={
                      twoPager
                        ? (b) => {
                            setFocusedBlock(b);
                            dispatch({ type: "ADD_ITEM", index: state.activeIndex, path: `stack.${b}` });
                          }
                        : null
                    }
                    canDeleteBlock={
                      twoPager
                        ? (b) => !(state.activeIndex === 0 && b === 0 && ["banner", "title"].includes(activePage?.stack?.[0]?.type ?? ""))
                        : null
                    }
                    toneOf={
                      twoPager
                        ? (b) => {
                            const t = activePage?.stack?.[b];
                            if (t?.type === "callout") return [t.tone ?? "orange"];
                            if (t?.type === "panels") return [panelTone(t, 0), panelTone(t, 1)];
                            return null;
                          }
                        : null
                    }
                    onTone={twoPager ? (b, tone, slot) => dispatch({ type: "SET_TONE", index: state.activeIndex, block: b, slot, tone }) : null}
                    sideTitleOf={
                      twoPager ? (b) => (activePage?.stack?.[b] && RAIL_BLOCKS.has(activePage.stack[b].type) ? !activePage.stack[b].wide : null) : null
                    }
                    onSideTitle={
                      twoPager
                        ? (b) => dispatch({ type: "TOGGLE_WIDE", index: state.activeIndex, block: b })
                        : null
                    }
                    columnsOf={twoPager ? (b) => (activePage?.stack?.[b]?.type === "table" ? tableHeads(activePage.stack[b]).length : null) : null}
                    onColumns={twoPager ? (b, add) => dispatch({ type: "TABLE_COLUMN", index: state.activeIndex, block: b, add }) : null}
                    onDeleteBlock={
                      twoPager
                        ? (b) => dispatch({ type: "DELETE_BLOCK", index: state.activeIndex, block: b })
                        : null
                    }
                    onUploadLogo={(slug, dataUrl) =>
                      dispatch({ type: "SET_LOGO", index: state.activeIndex, slug, dataUrl })
                    }
                    onReplacePartner={active.layoutId === "partner" ? (at) => setPartnerModal({ at }) : null}
                    onImagePos={
                      hasImage
                        ? (pos, path) =>
                            dispatch({ type: "SET_IMAGE_POS", index: state.activeIndex, pos, path })
                        : null
                    }
                    className="h-full w-full"
                    frameClassName="rounded-xl shadow-stripe-lg"
                  />
                  {pendingSwitch && state.lang && (
                    <EditChoice
                      language={LANG_LABELS[state.lang.current]}
                      target={LANG_LABELS[pendingSwitch.to]}
                      edits={pendingSwitch.edits}
                      onCancel={() => setPendingSwitch(null)}
                      onKeep={() => {
                        const { to } = pendingSwitch;
                        setPendingSwitch(null);
                        void switchLanguage(to, { asked: true });
                      }}
                      onRevert={() => {
                        const { to, edits } = pendingSwitch;
                        setPendingSwitch(null);
                        // The translation back in every changed text, then the switch.
                        const back = state.slides.map((sl) =>
                          edits.filter((e) => e.slide === sl.id).reduce((acc, e) => setPath(acc, e.path, e.translation), sl),
                        );
                        void switchLanguage(to, { asked: true, slides: back });
                      }}
                    />
                  )}
                  {partnerModal && active.layoutId === "partner" && (
                    <PartnerLogoModal
                      accent={theme.accent}
                      replacing={partnerModal.at !== null ? (active.bullets?.[partnerModal.at] ?? null) : null}
                      onSlide={active.bullets ?? []}
                      onClose={() => setPartnerModal(null)}
                      onPick={(name, logo) => {
                        dispatch({ type: "SET_PARTNER", index: state.activeIndex, at: partnerModal.at, name, logo });
                        setPartnerModal(null);
                      }}
                    />
                  )}
                  {logoMenu && (
                    <LogoMenu
                      {...logoMenu}
                      current={state.slides[0]?.pageLogo}
                      onClose={() => setLogoMenu(null)}
                      onPick={(src) => {
                        dispatch({ type: "EDIT_FIELD", index: 0, path: "pageLogo", value: src });
                        setLogoMenu(null);
                      }}
                      onRemove={() => {
                        dispatch({ type: "EDIT_FIELD", index: 0, path: "pageLogo", value: "" });
                        setLogoMenu(null);
                      }}
                      onUpload={async (file) => {
                        setLogoMenu(null);
                        try {
                          // An SVG stays as it is; a photo is downscaled like any upload.
                          const value = /svg/i.test(file.type)
                            ? await new Promise<string>((res, rej) => {
                                const r = new FileReader();
                                r.onload = () => res(String(r.result));
                                r.onerror = () => rej(r.error);
                                r.readAsDataURL(file);
                              })
                            : await readAttachment(file).then((a) => (a.kind === "image" ? `data:${a.mediaType};base64,${a.data}` : ""));
                          if (value) dispatch({ type: "EDIT_FIELD", index: 0, path: "pageLogo", value });
                        } catch {
                          dispatch({ type: "GENERATION_ERROR", error: "That image could not be read." });
                        }
                      }}
                    />
                  )}
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
                  {/* A two-pager's actions live in the side bar beside the page
                      (SlideFrame): the bottom pill only says it is busy. */}
                  {(!twoPager || state.status === "generating" || fitting || translating) && (
                  <SlideActions
                    key={state.status === "generating" ? "generating" : active.id}
                    busy={state.status === "generating" || fitting || !!translating}
                    busyLabel={translating ? `Translating to ${LANG_LABELS[translating]}…` : fitting ? "Fitting the pages…" : undefined}
                    flightRef={flightRef}
                    onEditWithAi={() => setAiModal(true)}
                    canAddItem={canAddItem}
                    addMenu={addMenu}
                    onOpenAddMenu={() => setAddFocus(editingPath())}
                    onAddPart={onAddPart}
                    canAddNote={!modular && !isPage(active) && !NO_NOTES.has(active.layoutId) && !active.notes?.trim()}
                    onAddNote={() => dispatch({ type: "EDIT_FIELD", index: state.activeIndex, path: "notes", value: "1. " })}
                    canReference={!isPage(active) && !!active.notes?.trim()}
                    onReference={onReference}
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
                  )}
                </>
              )}
            </div>
            {/* The block rail opens from the side bar's + and closes with it
                (Mario, 7 Oct 2026): blocks are dragged onto the page, or
                clicked to land where the + was pressed. */}
            {twoPager && active && isPage(active) && (
              // Opens by width, so the page beside it rescales smoothly
              // instead of jumping (Mario, 7 Oct 2026: "scattosa"); the list
              // inside slides and fades in a step behind. Mounted throughout,
              // inert while closed.
              <div className="block-rail-wrap shrink-0 overflow-hidden" data-open={addBlockAt != null} inert={addBlockAt == null}>
                <div className="block-rail-panel h-full w-[168px] border-l border-r border-l-hairline-light border-r-hairline bg-canvas">
                  <BlockRail
                    onAdd={(blockType) => {
                      if (addBlockAt == null) return;
                      const at = Math.min(addBlockAt, active.stack?.length ?? 0);
                      dispatch({ type: "ADD_BLOCK", index: state.activeIndex, at, blockType });
                      setFocusedBlock(at);
                      setAddBlockAt(at + 1);
                    }}
                    onClose={() => setAddBlockAt(null)}
                  />
                </div>
              </div>
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
          onInsertPage={() => {
            dispatch({
              type: "INSERT",
              content: { layoutId: "a4-page", stack: presetStack(), footerLabel: state.slides.find(isPage)?.footerLabel ?? "" },
            });
            setFocusedBlock(null);
            onDeckArrived();
          }}
        />
      </div>

      {help && <HelpModal initial={help} onClose={() => setHelp(null)} />}

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

/**
 * The editor's top bar before there is a deck: same chrome as the Toolbar,
 * with only Upload HTML. The stage stays a message, not a set of buttons, so
 * people write the brief in the prompt box instead of looking for a start
 * button (Mario, 1 Oct 2026, from Hotjar recordings).
 */
function EmptyToolbar({ onOpenDeckFile }: { onOpenDeckFile: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2.5">
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          icon={Upload}
          onClick={onOpenDeckFile}
          title="Open an HTML deck downloaded from here. Dropping the file anywhere on this page works too."
        >
          Upload HTML
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  twoPager,
  previous,
  onRestorePrevious,
  onDismissPrevious,
}: {
  twoPager: boolean;
  previous: Partial<DeckState> | null;
  onRestorePrevious: () => void;
  onDismissPrevious: () => void;
}) {
  const count = previous?.slides?.length ?? 0;
  // On a cover the title is usually the brand lockup and the subtitle carries
  // the subject, which is what makes one parked deck tell itself from another.
  const first = previous?.slides?.[0];
  const named = previous?.name && !isDefaultName(previous.name) ? previous.name : undefined;
  const title = named ?? (first?.layoutId === "cover" ? first.subtitle : first?.title)?.trim();
  return (
    // pb lifts the block above the true middle, where it reads as centred.
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4 pb-[10vh]">
      {
        <>
          <div className="empty-in mb-6">
            <GlassFan />
          </div>
          <h1 className="empty-in text-[26px] font-medium tracking-tight text-ink" style={{ "--i": 1 } as React.CSSProperties}>
            {twoPager ? "What goes on the two pages?" : "What are we presenting today?"}
          </h1>
          <p className="empty-in -mt-1.5 max-w-md text-balance text-center text-sm leading-relaxed text-ink-muted" style={{ "--i": 2 } as React.CSSProperties}>
            {twoPager
              ? "Tell us on the left, or attach a document. Your A4 pages land here, ready to edit and print."
              : "Tell us on the left, or attach a document. Your slides land here, ready to edit."}
          </p>
          {/* The editor no longer restores the last deck on its own, so the
              deck is offered here instead of appearing under the user: a toast
              rising from the bottom of the stage, 60px up, so the headline
              block stays where it is (Mario, 1 Oct 2026). */}
          {count > 0 && (
            <div
              className="float-in absolute bottom-[60px] left-1/2 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-full border border-hairline-light bg-surface py-2 pl-5 pr-2 shadow-float"
              style={{ animationDelay: "500ms" }}
            >
              <History size={16} className="shrink-0 text-ink-faint" aria-hidden />
              {/* The icon says "last session"; the row says which deck. */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink" data-hj-suppress>
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
  languageMenu,
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
  /** The deck's language (components/LanguageMenu.tsx), first of the controls. */
  languageMenu?: React.ReactNode;
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
        {languageMenu}
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
              {/* A two-pager exports A4 portrait pages, editable like the slides. */}
              <button
                disabled={pptxProgress !== null}
                onClick={() => {
                  setExportOpen(false);
                  onExportPptx();
                }}
                className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist disabled:pointer-events-none disabled:text-ink-faint"
              >
                PowerPoint
                {/* No description in the resting state; only why it is busy or off. */}
                {pptxProgress && (
                  <span className="block text-xs text-ink-muted">
                    {`Exporting ${pptxProgress.done} of ${pptxProgress.total}…`}
                  </span>
                )}
              </button>
            </div>
          </>
        )}
        </div>
        {/* Present, icon only after Download so the bar stays compact (Mario, 26 Sep 2026). */}
        {onPresent && (
          <Button
            variant="secondary"
            iconOnly
            icon={Play}
            onClick={onPresent}
            aria-label="Present full screen"
            title="Present full screen from this slide (Esc to leave)"
          />
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
/** "Generating…" in Ink with the spinner, the button's measurements and no tint (Mario, 25 Sep 2026): a status, not a control. */
function GeneratingLabel({ label = "Generating…" }: { label?: string }) {
  return (
    <span className="flex h-9 items-center gap-1.5 px-3 text-sm font-medium text-ink" aria-busy>
      <LoaderCircle size={ICON_SIZE} className="animate-spin" aria-hidden />
      {label}
    </span>
  );
}

function SlideActions({
  busy,
  busyLabel,
  flightRef,
  onEditWithAi,
  canAddItem,
  addMenu,
  onOpenAddMenu,
  onAddPart,
  canAddNote,
  onAddNote,
  canReference,
  onReference,
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
  /** What the busy pill says, when it is not generating (a two-pager's fit pass). */
  busyLabel?: string;
  /** Where the centred "Generating…" pill was when the first slide landed: the bar flies in from there. */
  flightRef?: React.MutableRefObject<DOMRect | null>;
  /** Opens the Edit with AI dialog, which lives at page level. */
  onEditWithAi: () => void;
  canAddItem: boolean;
  /** High density: Element opens this menu (points, blocks, the optional parts that are missing) instead of adding a block. */
  addMenu: AddOption[] | null;
  /** The menu opens: the caller notes which text had the caret. */
  onOpenAddMenu: () => void;
  onAddPart: (id: string) => void;
  /** A content slide with no footnote yet: "Footnote" adds one in the footer row. */
  canAddNote: boolean;
  onAddNote: () => void;
  /** The slide has a footnote: "Reference" puts its next number, in superscript, where the caret is. */
  canReference: boolean;
  onReference: () => void;
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
  // The Element menu, above its button. It lives in a portal: the bar clips
  // its content. Mousedown is prevented on the button and the entries, so
  // the caret stays in the slide's text (as on Reference) and "Point" goes
  // where it is.
  const [addAt, setAddAt] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!addAt) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAddAt(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addAt]);
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
          <GeneratingLabel label={busyLabel} />
        ) : (
          <>
            <Button variant="primary" onClick={onEditWithAi} disabled={busy} style={{ "--i": 0 } as CSSProperties}>
              Edit with AI
            </Button>
            {addMenu ? (
              <Button
                variant="secondary"
                icon={Plus}
                iconRight={ChevronUp}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (addAt) return setAddAt(null);
                  onOpenAddMenu();
                  setAddAt(e.currentTarget.getBoundingClientRect());
                }}
                aria-haspopup="menu"
                aria-expanded={!!addAt}
                title="Add a point, a block or a part this slide is missing"
              >
                Element
              </Button>
            ) : (
              canAddItem && (
                <Button variant="secondary" icon={Plus} onClick={onAddItem} title="Add an element to this slide">
                  Element
                </Button>
              )
            )}
            {canReference && (
              <Button
                variant="secondary"
                icon={Superscript}
                // Keeps the caret in the slide's text while the button is pressed.
                onMouseDown={(e) => e.preventDefault()}
                onClick={onReference}
                title="Click in a text where the reference goes, then press: adds the next footnote number (or type ^1)"
              >
                Reference
              </Button>
            )}
            {canAddNote && (
              <Button variant="secondary" icon={Superscript} onClick={onAddNote} title="Add a footnote in the footer row">
                Footnote
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
      {addAt &&
        addMenu &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setAddAt(null)} />
            <div
              role="menu"
              aria-label="Add to this slide"
              className="pop-in fixed z-50 w-64 rounded-2xl bg-surface p-1.5 shadow-menu"
              style={{ left: addAt.left, bottom: window.innerHeight - addAt.top + 8 }}
            >
              {addMenu.map((o) => (
                <button
                  key={o.id}
                  role="menuitem"
                  disabled={o.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setAddAt(null);
                    onAddPart(o.id);
                  }}
                  className="block w-full rounded-[10px] px-2.5 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-mist disabled:pointer-events-none disabled:text-ink-faint"
                >
                  {o.label}
                  {o.hint && <span className="block text-xs text-ink-muted">{o.hint}</span>}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
