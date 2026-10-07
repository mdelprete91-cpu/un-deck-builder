"use client";

import { mountAura } from "@/lib/slides/aura-live";
import { lucideSvg } from "@/lib/slides/icons";
import { measureFlow } from "@/lib/slides/pages/fit";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BetweenVerticalEnd, Columns2, GripVertical, ListMinus, ListPlus, PanelLeftClose, PanelLeftOpen, Palette, Plus, Sparkles, Trash2 } from "lucide-react";
import { CALLOUT_TONES, type CalloutTone } from "@/lib/slides/pages/schema";
import Button from "@/components/Button";
import { BLOCK_MIME } from "@/components/BlockRail";
import { autofitAll, refitNode } from "@/lib/slides/autofit";
import type { ImagePos } from "@/lib/slides/schema";

/**
 * Point editing on a high-density slide (lib/slides/modular.ts): Enter
 * splits, Backspace on an empty point removes it, Tab / Shift+Tab nest.
 */
export interface PointOps {
  /** Is `path` a point? */
  isPoint: (path: string) => boolean;
  /** The point keeps `before`, a new point with `after` follows; its path, or null when there is no room. */
  split: (path: string, before: string, after: string) => string | null;
  /** Remove the (empty) point; the path the caret goes to, or null when it cannot go. */
  remove: (path: string) => string | null;
  /** Whether the point can be a sub-point. */
  nests: (path: string) => boolean;
}

/** A text to focus once the next slide is drawn, its placeholder selected. */
export interface FocusRequest {
  path: string;
}

type Caret = number | "end" | "all";

/** Where the selection starts and ends in a node's text. */
function caretIn(node: HTMLElement): [number, number] {
  const len = (node.textContent ?? "").length;
  const sel = window.getSelection();
  if (!sel?.rangeCount) return [len, len];
  const r = sel.getRangeAt(0);
  if (!node.contains(r.startContainer) || !node.contains(r.endContainer)) return [len, len];
  const pre = document.createRange();
  pre.selectNodeContents(node);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  pre.setEnd(r.endContainer, r.endOffset);
  return [start, pre.toString().length];
}

/** Focus a text and put the caret at an offset, at the end, or around all of it. */
function placeCaret(node: HTMLElement, at: Caret): void {
  node.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  if (at === "end") range.collapse(false);
  else if (typeof at === "number") {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let left = at;
    let placed = false;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const n = (t.textContent ?? "").length;
      if (left <= n) {
        range.setStart(t, left);
        range.collapse(true);
        placed = true;
        break;
      }
      left -= n;
    }
    if (!placed) range.collapse(at <= 0);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

interface SlideFrameProps {
  html: string;
  editable?: boolean;
  onEdit?: (path: string, value: string) => void;
  onDeleteItem?: (path: string) => void;
  /** When set, an in-slide "+ Add element" button appears on hover. */
  onAddItem?: (() => void) | null;
  /**
   * When set, photos can be reframed: drag to pan, wheel to zoom, double-click
   * to reset. `path` is the image's state path ("image" on a slide,
   * "stack.2.items.0.image" on a two-pager page).
   */
  onImagePos?: ((pos: ImagePos, path: string) => void) | null;
  /**
   * When set, a click on a photo (without dragging it) opens the image picker
   * for that slot; on a page every slot also gets its own upload button.
   */
  onPickImage?: ((path: string) => void) | null;
  /** The partner slide: open the logo dialog to replace the partner at this position. */
  onReplacePartner?: ((at: number) => void) | null;
  /** Two-pager, first page: open the programme-logo menu at this point on screen. */
  onPickLogo?: ((at: { x: number; y: number }) => void) | null;
  /** High density: Enter / Backspace / Tab on points. */
  pointOps?: PointOps | null;
  /** High density: an item whose delete would be refused gets no ✕. */
  canDeleteItem?: ((path: string) => boolean) | null;
  /** A text to focus once the slide is drawn (after an Element menu add). */
  focusRequest?: FocusRequest | null;
  onFocusDone?: () => void;
  /** When set, a click on a chart ([data-chart]) opens the data panel. */
  onChartClick?: (() => void) | null;
  /** Called after each autofit pass with how many text nodes ended up smaller than drawn. */
  onAutofit?: ((shrunk: number) => void) | null;
  /** When set, tier-table [data-cell] nodes cycle check → dimmed → empty on click. */
  onToggleCell?: ((row: number, col: number) => void) | null;
  /**
   * When set, [data-icon-pick] icons open the icon picker. The attribute is a
   * block index on a slide and an icon path on a page; the caller tells them
   * apart.
   */
  onPickIcon?: ((target: string) => void) | null;
  /** When set, partner [data-logo] cells get an SVG logo upload action. */
  onUploadLogo?: ((slug: string, dataUrl: string) => void) | null;
  /** The stage in CSS px. Slides are 1920x1080; an A4 page is 793x1123. */
  size?: { w: number; h: number };
  /** Two-pager pages only: block selection and reordering, drawn on hover. */
  onFocusBlock?: ((index: number) => void) | null;
  focusedBlock?: number | null;
  onMoveBlock?: ((from: number, to: number) => void) | null;
  onDeleteBlock?: ((index: number) => void) | null;
  /** Two-pager: open the block menu to insert a block at this index. */
  onAddBlock?: ((at: number) => void) | null;
  /** Two-pager: the block rail is open, so + shows pressed. */
  addingBlocks?: boolean;
  /** Two-pager: a block dragged in from the block rail (BlockRail), dropped at this index. */
  onDropNewBlock?: ((type: string, at: number) => void) | null;
  /** Two-pager: the side bar's Edit with AI (the page has no bottom bar). */
  onEditWithAi?: (() => void) | null;
  /** Two-pager: whether a block can take one more item, and adding it. */
  canAddBlockItem?: ((block: number) => boolean) | null;
  onAddBlockItem?: ((block: number) => void) | null;
  /** Two-pager: whether a block can lose an item (above its minimum). */
  canRemoveBlockItem?: ((block: number) => boolean) | null;
  /** Two-pager: whether a block may be removed (page 1's title may not). */
  canDeleteBlock?: ((block: number) => boolean) | null;
  /** Two-pager: a status banner's colour, and changing it (null: the block has none). */
  toneOf?: ((block: number) => CalloutTone | null) | null;
  onTone?: ((block: number, tone: CalloutTone) => void) | null;
  /** Two-pager: whether a block shows its side title (null: it has no side column), and toggling it. */
  sideTitleOf?: ((block: number) => boolean | null) | null;
  onSideTitle?: ((block: number) => void) | null;
  /** Two-pager table: its column count (null: not a table), and adding or removing the last one. */
  columnsOf?: ((block: number) => number | null) | null;
  onColumns?: ((block: number, add: boolean) => void) | null;
  /** Editor chrome is sized for the 1920 stage; a page needs the small set. */
  variant?: "slide" | "page";
  className?: string;
  /**
   * Classes for the frame that hugs the scaled slide (rounded corners, shadow).
   * The outer container can be any size; the frame is always exactly the
   * slide, so nothing decorative ever shows outside the slide's edges.
   */
  frameClassName?: string;
}

/** Downscale an uploaded image to ≤1920px and return a JPEG data URL (keeps localStorage small). */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1920 / img.width, 1920 / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image file"));
    };
    img.src = url;
  });
}

/**
 * Renders a 1920×1080 slide scaled to fit (and centered in) its container.
 * When `editable`: [data-edit] nodes become contenteditable (committing on
 * blur, autofitting live while typing), [data-item] elements get a hover ✕,
 * [data-image] nodes get a "Change image" upload action.
 */
export default function SlideFrame({
  html,
  editable = false,
  onEdit,
  onDeleteItem,
  onAddItem,
  onImagePos,
  onToggleCell,
  onPickIcon,
  onUploadLogo,
  onPickImage,
  onPickLogo,
  onReplacePartner,
  onChartClick,
  onAutofit,
  pointOps,
  canDeleteItem,
  focusRequest,
  onFocusDone,
  onFocusBlock,
  focusedBlock,
  onMoveBlock,
  onDeleteBlock,
  onAddBlock,
  addingBlocks = false,
  onDropNewBlock,
  onEditWithAi,
  canAddBlockItem,
  onAddBlockItem,
  canRemoveBlockItem,
  canDeleteBlock,
  toneOf,
  onTone,
  sideTitleOf,
  onSideTitle,
  columnsOf,
  onColumns,
  size = { w: 1920, h: 1080 },
  variant = "slide",
  className,
  frameClassName,
}: SlideFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pendingLogoSlug = useRef<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  /**
   * Two-pager: the side bar beside the page. It sits by the block under the
   * mouse, and by the selected block otherwise, so Edit with AI is always in
   * reach (Mario, 6 Oct 2026: the side bar is the page's only bar).
   */
  const [, setHoverBlock] = useState<number | null>(null);
  /** Each block's top and height in the frame's coordinates (screen px). */
  const [blockRects, setBlockRects] = useState<{ top: number; height: number }[]>([]);
  /** A move in flight: where the blocks were, so the new order can slide in from there. */
  const pendingMove = useRef<{ from: number; to: number; rects: { top: number; height: number }[] } | null>(null);
  /** Dragging a block by the grip: which one, and the gap it would drop into. */
  const [drag, setDrag] = useState<{ from: number; gap: number } | null>(null);
  /** A block dragged in from the rail: the gap it would drop into. */
  const [incoming, setIncoming] = useState<number | null>(null);
  /** The status banner's colour swatches, open beside the side bar. */
  const [tones, setTones] = useState(false);
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A short grace period, so the mouse can travel from the block to the bar.
  const leaveBlock = () => {
    if (barTimer.current) clearTimeout(barTimer.current);
    barTimer.current = setTimeout(() => setHoverBlock(null), 300);
  };
  // Move a block: the side bar goes with it, and it stays the selected one.
  const moveBlock = (from: number, to: number) => {
    if (!onMoveBlock || to < 0 || to >= blockRects.length || to === from) return;
    pendingMove.current = { from, to, rects: blockRects };
    setHoverBlock(to);
    onFocusBlock?.(to);
    onMoveBlock(from, to);
  };
  const grabBlock = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    stageRef.current?.querySelector(`[data-block="${index}"]`)?.classList.add("block-dragging");
    setDrag({ from: index, gap: index });
  };
  const releaseDrag = () => {
    stageRef.current?.querySelectorAll(".block-dragging").forEach((n) => n.classList.remove("block-dragging"));
    setDrag(null);
  };
  const dropBlock = () => {
    if (!drag) return;
    releaseDrag();
    moveBlock(drag.from, drag.gap > drag.from ? drag.gap - 1 : drag.gap);
  };
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const onDeleteItemRef = useRef(onDeleteItem);
  onDeleteItemRef.current = onDeleteItem;
  const onAddItemRef = useRef(onAddItem);
  onAddItemRef.current = onAddItem;
  const onImagePosRef = useRef(onImagePos);
  onImagePosRef.current = onImagePos;
  const onToggleCellRef = useRef(onToggleCell);
  onToggleCellRef.current = onToggleCell;
  const onPickIconRef = useRef(onPickIcon);
  onPickIconRef.current = onPickIcon;
  const onUploadLogoRef = useRef(onUploadLogo);
  onUploadLogoRef.current = onUploadLogo;
  // Kept current in a layout effect, which runs before the wiring effect
  // below and before any key reaches the slide.
  const pointOpsRef = useRef(pointOps);
  const canDeleteRef = useRef(canDeleteItem);
  const onFocusDoneRef = useRef(onFocusDone);
  useLayoutEffect(() => {
    pointOpsRef.current = pointOps;
    canDeleteRef.current = canDeleteItem;
    onFocusDoneRef.current = onFocusDone;
  });
  // Where the caret goes once the slide a point key changed is drawn.
  const pendingCaret = useRef<{ path: string; at: Caret } | null>(null);
  // The two-pager callbacks travel together in one ref: the wiring effect
  // must not re-run when a parent re-renders, and one ref is one lint waiver
  // rather than four.
  const pageRef = useRef({ onPickImage, onPickLogo, onReplacePartner, onFocusBlock, onMoveBlock, onDeleteBlock, onAddBlock, onChartClick });
  pageRef.current = { onPickImage, onPickLogo, onReplacePartner, onFocusBlock, onMoveBlock, onDeleteBlock, onAddBlock, onChartClick };

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Layout size, not getBoundingClientRect: an ancestor mid-transform (the
    // picker's pop-in starts at scale 0.98) shrinks the rect but not the
    // layout, and ResizeObserver never fires for a transform, so the slide
    // stayed at 98% with a white strip on two sides.
    const update = () => setBox({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Always re-inject from state: edited values can drive geometry (bar
    // heights, donut segments, partner logos), so the DOM is never kept stale.
    stage.innerHTML = html;
    // Fit first, report second. `onAutofit?.(autofitAll(stage))` would skip
    // the fit whenever nobody listens: an optional call never evaluates its
    // arguments, and the main stage and the thumbnails pass no listener.
    const shrunk = autofitAll(stage);
    onAutofit?.(shrunk);
    // Web fonts may land after the first measurement and reflow the text;
    // refit once they are ready (no-op when already loaded).
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive && stageRef.current === stage) {
        const refitted = autofitAll(stage);
        onAutofit?.(refitted);
      }
    });
    if (!editable) return () => { alive = false; };

    const cleanups: (() => void)[] = [];

    // The live aura on the cover and the closing slide, on the editing stage only.
    cleanups.push(mountAura(stage));

    // Inline text editing (with live autofit while typing)
    stage.querySelectorAll<HTMLElement>("[data-edit]").forEach((node) => {
      node.contentEditable = "plaintext-only";
      const original = node.innerText;
      const path = node.getAttribute("data-edit")!;
      // A point key already wrote this text into the change it made.
      let done = false;
      const commit = () => {
        if (done) return;
        // "^1" typed in any text becomes the superscript that points to footnote 1.
        const value = node.innerText.replace(/\^([0-9])/g, (_, d: string) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]);
        if (value !== original && onEditRef.current) {
          onEditRef.current(node.getAttribute("data-edit")!, value);
        }
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          node.innerText = original;
          node.blur();
          return;
        }
        const ops = pointOpsRef.current;
        if (!ops || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || !ops.isPoint(path)) return;
        const text = node.textContent ?? "";
        const sub = /^[-–]\s/.test(text);
        const rest = sub ? text.slice(2) : text;
        const go = (to: string, at: Caret) => {
          done = true;
          pendingCaret.current = { path: to, at };
        };
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          // An empty sub-point steps out to a point; an empty point stays.
          if (!rest.trim()) {
            if (sub) {
              go(path, 0);
              onEditRef.current?.(path, "");
            }
            return;
          }
          const [a, b] = caretIn(node);
          const after = text.slice(Math.max(b, sub ? 2 : 0));
          const next = ops.split(path, text.slice(0, a), sub ? `- ${after.replace(/^\s+/, "")}` : after);
          if (next) go(next, sub ? 2 : 0);
          return;
        }
        if ((e.key === "Backspace" || e.key === "Delete") && !rest.trim()) {
          e.preventDefault();
          const next = ops.remove(path);
          if (next) go(next, "end");
          return;
        }
        if (e.key === "Tab" && ops.nests(path)) {
          e.preventDefault();
          const [a] = caretIn(node);
          if (!e.shiftKey && !sub) {
            go(path, a + 2);
            onEditRef.current?.(path, `- ${text}`);
          } else if (e.shiftKey && sub) {
            go(path, Math.max(0, a - 2));
            onEditRef.current?.(path, rest);
          }
        }
      };
      const onInput = () => refitNode(node);
      node.addEventListener("blur", commit);
      node.addEventListener("keydown", onKeyDown);
      node.addEventListener("input", onInput);
      cleanups.push(() => {
        node.removeEventListener("blur", commit);
        node.removeEventListener("keydown", onKeyDown);
        node.removeEventListener("input", onInput);
      });
    });

    // Per-element delete buttons (rebuilt on every wiring pass)
    stage.querySelectorAll(".item-delete").forEach((b) => b.remove());
    // A page has no ✕ on its rows: the side bar removes them (Mario, 7 Oct 2026).
    if (onDeleteItemRef.current && variant !== "page") {
      stage.querySelectorAll<HTMLElement>("[data-item]").forEach((node) => {
        // Refused here (the last point of a block, a block at its minimum):
        // no ✕, and no outline promising one.
        if (canDeleteRef.current && !canDeleteRef.current(node.getAttribute("data-item")!)) {
          node.classList.add("item-fixed");
          return;
        }
        if (getComputedStyle(node).position === "static") {
          node.style.position = "relative";
        }
        const btn = document.createElement("button");
        btn.className = "item-delete";
        btn.type = "button";
        btn.title = "Delete element";
        btn.innerHTML = lucideSvg("x");
        // The ✕ overhangs the item's top-right corner (-24px). Keep it inside
        // when the item clips itself (partner logos) or when a clipping
        // ancestor would cut the overhang off (callout rows in the flex zone).
        // An item that holds other items puts its ✕ on the top-left corner
        // (data-item-corner="left"), clear of theirs on the right.
        const left = node.getAttribute("data-item-corner") === "left";
        let inside = getComputedStyle(node).overflow === "hidden";
        if (!inside) {
          const overhang = 24 * (stage.getBoundingClientRect().width / size.w);
          const r = node.getBoundingClientRect();
          for (let p = node.parentElement; p && p !== stage; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.overflowY === "hidden") {
              const cr = p.getBoundingClientRect();
              const out = left ? r.left - overhang < cr.left - 1 : r.right + overhang > cr.right + 1;
              if (out || r.top - overhang < cr.top - 1) {
                inside = true;
                break;
              }
            }
          }
        }
        if (left) {
          btn.style.right = "auto";
          btn.style.left = inside ? "8px" : "-24px";
        }
        if (inside) {
          btn.style.top = "8px";
          if (!left) btn.style.right = "8px";
        }
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          onDeleteItemRef.current?.(node.getAttribute("data-item")!);
        });
        node.appendChild(btn);
      });
    }

    // Photo reframe: drag to pan the focal point, wheel to zoom, dblclick reset.
    // Styles are mutated locally during the gesture and committed once at the
    // end (a commit re-injects the whole slide, which would kill the drag).
    if (onImagePosRef.current) {
      stage.querySelectorAll<HTMLImageElement>("img[data-image]").forEach((img) => {
        // "" on the slide layouts, a state path on a two-pager page.
        const path = img.getAttribute("data-image") || "image";
        img.style.cursor = "grab";
        const readPos = (): ImagePos => {
          const m = /([\d.]+)% ([\d.]+)%/.exec(img.style.objectPosition || "");
          const z = /scale\(([\d.]+)\)/.exec(img.style.transform || "");
          return {
            x: m ? parseFloat(m[1]) : 50,
            y: m ? parseFloat(m[2]) : 50,
            zoom: z ? parseFloat(z[1]) : 1,
          };
        };
        const apply = (p: ImagePos) => {
          img.style.objectPosition = `${p.x}% ${p.y}%`;
          img.style.transform = `scale(${p.zoom})`;
          img.style.transformOrigin = `${p.x}% ${p.y}%`;
        };
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
        let drag: { sx: number; sy: number; start: ImagePos; moved: boolean } | null = null;
        let wheelTimer: ReturnType<typeof setTimeout> | null = null;

        const onPointerDown = (e: PointerEvent) => {
          e.preventDefault();
          drag = { sx: e.clientX, sy: e.clientY, start: readPos(), moved: false };
          img.setPointerCapture(e.pointerId);
          img.style.cursor = "grabbing";
        };
        const onPointerMove = (e: PointerEvent) => {
          if (!drag) return;
          const rect = img.getBoundingClientRect();
          const dx = ((e.clientX - drag.sx) / rect.width) * 100;
          const dy = ((e.clientY - drag.sy) / rect.height) * 100;
          if (Math.abs(dx) + Math.abs(dy) > 0.5) drag.moved = true;
          apply({
            x: clamp(drag.start.x - dx, 0, 100),
            y: clamp(drag.start.y - dy, 0, 100),
            zoom: drag.start.zoom,
          });
        };
        const onPointerUp = () => {
          if (!drag) return;
          const moved = drag.moved;
          drag = null;
          img.style.cursor = "grab";
          if (moved) onImagePosRef.current?.(readPos(), path);
          // A press without a drag is a click: open the picker for this slot.
          else pageRef.current.onPickImage?.(path);
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const p = readPos();
          apply({ ...p, zoom: clamp(p.zoom * (e.deltaY < 0 ? 1.07 : 0.93), 1, 4) });
          if (wheelTimer) clearTimeout(wheelTimer);
          wheelTimer = setTimeout(() => onImagePosRef.current?.(readPos(), path), 500);
        };
        const onDblClick = () => onImagePosRef.current?.({ x: 50, y: 50, zoom: 1 }, path);

        img.addEventListener("pointerdown", onPointerDown);
        img.addEventListener("pointermove", onPointerMove);
        img.addEventListener("pointerup", onPointerUp);
        img.addEventListener("pointercancel", onPointerUp);
        img.addEventListener("wheel", onWheel, { passive: false });
        img.addEventListener("dblclick", onDblClick);
        cleanups.push(() => {
          if (wheelTimer) clearTimeout(wheelTimer);
          img.removeEventListener("pointerdown", onPointerDown);
          img.removeEventListener("pointermove", onPointerMove);
          img.removeEventListener("pointerup", onPointerUp);
          img.removeEventListener("pointercancel", onPointerUp);
          img.removeEventListener("wheel", onWheel);
          img.removeEventListener("dblclick", onDblClick);
        });
      });
    }

    // Partner cells: replace the partner from the logo library or an upload
    // (PartnerLogoModal); without that dialog, the old SVG upload.
    stage.querySelectorAll(".logo-upload").forEach((b) => b.remove());
    if (pageRef.current.onReplacePartner || onUploadLogoRef.current) {
      stage.querySelectorAll<HTMLElement>("[data-logo]").forEach((cell) => {
        const btn = document.createElement("button");
        btn.className = "logo-upload";
        btn.type = "button";
        const replace = pageRef.current.onReplacePartner;
        btn.title = replace ? "Replace this partner: from the logo library, or upload a logo" : "Upload the partner logo (SVG, rendered white automatically)";
        btn.innerHTML = replace ? `${lucideSvg("replace")}<span>Replace</span>` : `${lucideSvg("upload")}<span>SVG</span>`;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const at = Number(/^bullets\.(\d+)$/.exec(cell.getAttribute("data-item") ?? "")?.[1]);
          if (replace && Number.isFinite(at)) return replace(at);
          pendingLogoSlug.current = cell.getAttribute("data-logo");
          logoInputRef.current?.click();
        });
        cell.appendChild(btn);
      });
    }

    // Two-pager blocks: click to focus, hover for move, add and delete. The
    // toolbar lives outside the page, so the printed markup and the exports
    // stay exactly what the design says.
    if (pageRef.current.onFocusBlock) {
      const blocks = [...stage.querySelectorAll<HTMLElement>("[data-block]")];
      blocks.forEach((node) => {
        const i = Number(node.getAttribute("data-block"));
        if (i === focusedBlock) node.classList.add("block-on");
        const onClick = () => pageRef.current.onFocusBlock?.(i);
        node.addEventListener("click", onClick);
        cleanups.push(() => {
          node.removeEventListener("click", onClick);
          node.classList.remove("block-on");
        });
        // Hover moves the side bar to this block (rendered below, outside
        // the stage, so the sheet never carries it).
        const onEnter = () => {
          if (barTimer.current) clearTimeout(barTimer.current);
          setHoverBlock(i);
        };
        const onLeave = () => leaveBlock();
        node.addEventListener("mouseenter", onEnter);
        node.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          node.removeEventListener("mouseenter", onEnter);
          node.removeEventListener("mouseleave", onLeave);
        });
      });
      // A block just moved: every block slides from where it was to where it
      // is now (FLIP), so the eye follows the moved one instead of losing it.
      const moved = pendingMove.current;
      pendingMove.current = null;
      const wrapNow = containerRef.current?.getBoundingClientRect();
      if (moved && wrapNow && moved.rects.length === blocks.length) {
        const order = blocks.map((_, k) => k);
        order.splice(moved.to, 0, order.splice(moved.from, 1)[0]);
        const zoom = stage.getBoundingClientRect().height / stage.offsetHeight || 1;
        blocks.forEach((node, k) => {
          const was = moved.rects[order[k]];
          const dy = (was.top - (node.getBoundingClientRect().top - wrapNow.top)) / zoom;
          if (Math.abs(dy) < 0.5) return;
          node.style.transition = "none";
          node.style.transform = `translateY(${dy}px)`;
        });
        void stage.offsetHeight;
        blocks.forEach((node) => {
          node.style.transition = "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)";
          node.style.transform = "";
        });
        const landed = blocks[moved.to];
        landed?.classList.add("block-landed");
        const t = setTimeout(() => landed?.classList.remove("block-landed"), 900);
        cleanups.push(() => clearTimeout(t));
      }
      // Where each block sits, for the side bar, once this frame is laid out.
      const frame = requestAnimationFrame(() => {
        const wrap = containerRef.current?.getBoundingClientRect();
        // From the layout, not the painted box: right after a move the
        // blocks are still sliding, and their painted place is the old one.
        const flow = blocks[0]?.offsetParent as HTMLElement | null;
        const zoom = stage.getBoundingClientRect().height / stage.offsetHeight || 1;
        if (wrap && flow) {
          const origin = flow.getBoundingClientRect().top - wrap.top;
          setBlockRects(blocks.map((n) => ({ top: origin + n.offsetTop * zoom, height: n.offsetHeight * zoom })));
        }
      });
      cleanups.push(() => cancelAnimationFrame(frame));
    }

    // A page that runs past its sheet is clipped at the bottom of the content
    // zone. Say so where it happens, with how much has to go (pages/fit.ts
    // measures the same way). Re-measured once the type has loaded.
    stage.querySelectorAll(".page-over").forEach((b) => b.remove());
    if (variant === "page" && editable) {
      const mark = () => {
        stage.querySelectorAll(".page-over").forEach((b) => b.remove());
        const over = measureFlow(stage);
        const zone = stage.querySelector<HTMLElement>("[data-page-zone]");
        if (over == null || over <= 1 || !zone) return;
        const lines = Math.max(1, Math.round(over / 15));
        const note = document.createElement("div");
        note.className = "page-over";
        note.style.top = `${zone.offsetTop + zone.offsetHeight}px`;
        note.textContent = `About ${lines} line${lines === 1 ? "" : "s"} past the page: shorten a section or remove a block`;
        zone.parentElement?.appendChild(note);
      };
      mark();
      let live = true;
      document.fonts.ready.then(() => live && mark());
      cleanups.push(() => {
        live = false;
      });
    }

    // The programme logo at the top right of a two-pager's first page: click
    // the logo to change it, or "+ Logo" over the date to add one.
    stage.querySelectorAll(".logo-add").forEach((b) => b.remove());
    if (pageRef.current.onPickLogo && variant === "page") {
      const open = (e: MouseEvent) => {
        e.stopPropagation();
        pageRef.current.onPickLogo?.({ x: e.clientX, y: e.clientY });
      };
      const logo = stage.querySelector<HTMLElement>("[data-page-logo]");
      const date = stage.querySelector<HTMLElement>('[data-edit="pageDate"]');
      if (logo) {
        logo.style.cursor = "pointer";
        logo.title = "Change or remove the programme logo";
        logo.addEventListener("click", open);
        cleanups.push(() => logo.removeEventListener("click", open));
      } else if (date?.parentElement) {
        const btn = document.createElement("button");
        btn.className = "logo-add";
        btn.type = "button";
        btn.title = "Add a programme logo at the top right";
        btn.innerHTML = `${lucideSvg("plus")}<span>Logo</span>`;
        btn.style.top = date.style.top;
        btn.addEventListener("click", open);
        date.parentElement.appendChild(btn);
      }
    }

    // Photo slots: their own upload action, which is what makes a page with
    // several images workable (the toolbar action can only mean one of them).
    stage.querySelectorAll(".image-upload").forEach((b) => b.remove());
    if (pageRef.current.onPickImage && variant === "page") {
      stage.querySelectorAll<HTMLElement>("img[data-image]").forEach((img) => {
        const slot = img.parentElement;
        if (!slot) return;
        if (getComputedStyle(slot).position === "static") slot.style.position = "relative";
        const btn = document.createElement("button");
        btn.className = "image-upload";
        btn.type = "button";
        btn.title = "Change this image";
        btn.innerHTML = `${lucideSvg("image")}<span>Image</span>`;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          pageRef.current.onPickImage?.(img.getAttribute("data-image") || "image");
        });
        slot.appendChild(btn);
      });
    }

    // A node that sets a value (the progress slide's stages): a click writes
    // data-value to the path in data-set, one undo step like any edit.
    if (editable) {
      stage.querySelectorAll<HTMLElement>("[data-set]").forEach((node) => {
        node.style.cursor = "pointer";
        // A control, for the mouse and the keyboard (halo in globals.css).
        node.classList.add("set-node-live");
        node.tabIndex = 0;
        node.setAttribute("role", "button");
        node.setAttribute("aria-label", node.title || "Set");
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEditRef.current?.(node.getAttribute("data-set")!, node.getAttribute("data-value") ?? "");
          }
        };
        node.addEventListener("keydown", onKey);
        cleanups.push(() => node.removeEventListener("keydown", onKey));
        const onClick = (e: MouseEvent) => {
          e.stopPropagation();
          onEditRef.current?.(node.getAttribute("data-set")!, node.getAttribute("data-value") ?? "");
        };
        node.addEventListener("click", onClick);
        cleanups.push(() => node.removeEventListener("click", onClick));
      });
    }

    // Charts: a click on the bars or the donut opens the data panel. The
    // editable labels inside keep their own click (inline editing).
    if (pageRef.current.onChartClick) {
      stage.querySelectorAll<HTMLElement>("[data-chart]").forEach((node) => {
        node.style.cursor = "pointer";
        node.title = "Edit the chart data";
        const onClick = (e: MouseEvent) => {
          if ((e.target as HTMLElement).closest("[data-edit]")) return;
          e.stopPropagation();
          pageRef.current.onChartClick?.();
        };
        node.addEventListener("click", onClick);
        cleanups.push(() => node.removeEventListener("click", onClick));
      });
    }

    // Tier-table checkmark cells: click to cycle on → dimmed → empty
    if (onToggleCellRef.current) {
      stage.querySelectorAll<HTMLElement>("[data-cell]").forEach((node) => {
        node.style.cursor = "pointer";
        const onClick = (e: MouseEvent) => {
          e.stopPropagation();
          const [row, col] = node.getAttribute("data-cell")!.split(".").map(Number);
          onToggleCellRef.current?.(row, col);
        };
        node.addEventListener("click", onClick);
        cleanups.push(() => node.removeEventListener("click", onClick));
      });
    }

    // Icon-card icons: click opens the icon picker
    if (onPickIconRef.current) {
      stage.querySelectorAll<SVGElement>("[data-icon-pick]").forEach((node) => {
        node.style.cursor = "pointer";
        const onClick = (e: Event) => {
          e.stopPropagation();
          onPickIconRef.current?.(node.getAttribute("data-icon-pick")!);
        };
        node.addEventListener("click", onClick);
        cleanups.push(() => node.removeEventListener("click", onClick));
      });
    }

    // In-slide "+ Add element" (rebuilt on every wiring pass)
    stage.querySelectorAll(".item-add").forEach((b) => b.remove());
    if (onAddItem) {
      const btn = document.createElement("button");
      btn.className = "item-add";
      btn.type = "button";
      btn.title = "Add an element to this slide";
      btn.innerHTML = `${lucideSvg("plus")}<span>Add element</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onAddItemRef.current?.();
      });
      stage.appendChild(btn);
    }

    return () => {
      alive = false;
      cleanups.forEach((fn) => fn());
    };
    // box.w: the ✕ placement measures rects, which are all zero until the
    // container is first measured — re-wire once the real size lands.
  }, [html, editable, onAddItem, box.w, size.w, focusedBlock]);

  // After the slide is drawn and wired: the caret where a point key or an
  // Element menu add left it (the new point, the restored part).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !editable) return;
    const want = pendingCaret.current ?? (focusRequest ? { path: focusRequest.path, at: "all" as Caret } : null);
    if (!want) return;
    const node = [...stage.querySelectorAll<HTMLElement>("[data-edit]")].find((n) => n.getAttribute("data-edit") === want.path);
    if (!node) return;
    pendingCaret.current = null;
    if (focusRequest) onFocusDoneRef.current?.();
    placeCaret(node, want.at);
  }, [html, editable, focusRequest]);

  // Fit, then overscan by two source pixels: a fractional container width
  // otherwise leaves a sub-pixel sliver of the container showing along one
  // edge, which reads as a white hairline on a colored slide. The overflow
  // clip hides the extra pixel on each side.
  const fit = Math.min(box.w / size.w, box.h / size.h);
  // With a decorated frame the frame is sized to the slide exactly and clips
  // it itself, so there is no gap to hide and no overscan: the container
  // stays open so the frame's shadow can fall outside the slide.
  const scale = fit > 0 ? (frameClassName ? fit : fit + 2 / size.w) : 0;

  return (
    // data-hj-suppress: Hotjar records the page, not the deck's words.
    <div
      ref={containerRef}
      data-hj-suppress
      className={`relative ${frameClassName ? "" : "overflow-hidden "}${className ?? ""}`}
      onDragOver={(e) => {
        if (!onDropNewBlock || !blockRects.length || !e.dataTransfer.types.includes(BLOCK_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const wrap = containerRef.current?.getBoundingClientRect();
        if (!wrap) return;
        const y = e.clientY - wrap.top;
        const gap = blockRects.filter((r) => r.top + r.height / 2 < y).length;
        if (gap !== incoming) setIncoming(gap);
      }}
      onDragLeave={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node | null)) setIncoming(null);
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(BLOCK_MIME);
        if (!type || !onDropNewBlock) return;
        e.preventDefault();
        e.stopPropagation();
        const at = incoming ?? blockRects.length;
        setIncoming(null);
        onDropNewBlock(type, at);
      }}
    >
      <div
        className={`absolute overflow-hidden ${frameClassName ?? ""}`}
        style={{
          width: size.w * scale,
          height: size.h * scale,
          left: (box.w - size.w * scale) / 2,
          top: (box.h - size.h * scale) / 2,
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        <div
          ref={stageRef}
          className={variant === "page" ? "slide-root page-root" : "slide-root"}
          style={{
            position: "absolute",
            width: size.w,
            height: size.h,
            left: 0,
            top: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            // The editor chrome injected into a page is sized in screen
            // pixels: it multiplies by this to undo the stage's zoom.
            ["--inv" as string]: scale > 0 ? 1 / scale : 1,
          }}
        />
      </div>
      {editable && variant === "page" && onMoveBlock && scale > 0 && blockRects.length > 0 && (() => {
        const count = blockRects.length;
        // The bar stays with the selected block: hovering another never moves it (Mario, 7 Oct 2026).
        const index = Math.min(drag?.from ?? focusedBlock ?? 0, count - 1);
        const canItem = canAddBlockItem?.(index) ?? false;
        const canLess = canRemoveBlockItem?.(index) ?? false;
        const tone = toneOf?.(index) ?? null;
        const sideTitle = onSideTitle ? (sideTitleOf?.(index) ?? null) : null;
        const cols = onColumns ? (columnsOf?.(index) ?? null) : null;
        const height = 46 * (4 + (canItem ? 1 : 0) + (canLess ? 1 : 0) + (tone ? 1 : 0) + (sideTitle !== null ? 1 : 0) + (cols !== null ? 2 : 0)) + 12;
        const pageLeft = (box.w - size.w * scale) / 2;
        // The gap a pointer at this height drops into: 0 is above the first block.
        const gapAt = (y: number) => blockRects.filter((r) => r.top + r.height / 2 < y).length;
        const gapY = (gap: number) =>
          gap === 0 ? blockRects[0].top - 6 : blockRects[gap - 1].top + blockRects[gap - 1].height + 6;
        return (
          <>
            <div
              // Beside the sheet, level with the block: the slide bar's pill
              // stood upright (DESIGN.md "Block toolbar").
              className="side-bar absolute z-20 flex flex-col gap-1.5 rounded-full border border-hairline-light bg-surface p-1.5 shadow-float transition-[top] duration-300 ease-out"
              style={{
                left: pageLeft + size.w * scale + 12,
                top: Math.max(0, Math.min(blockRects[index]?.top ?? 0, box.h - height)),
              }}
              onMouseEnter={() => barTimer.current && clearTimeout(barTimer.current)}
              onMouseLeave={leaveBlock}
            >
              {onEditWithAi && (
                <Button variant="primary" iconOnly icon={Sparkles} onClick={onEditWithAi} data-tip="Edit with AI" aria-label="Edit with AI" />
              )}
              <Button
                iconOnly
                icon={GripVertical}
                data-tip="Move"
                aria-label="Drag to move this block"
                className="cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={(e) => grabBlock(e, index)}
                onPointerMove={(e) => {
                  if (!drag) return;
                  const wrap = containerRef.current?.getBoundingClientRect();
                  if (wrap) setDrag({ from: drag.from, gap: gapAt(e.clientY - wrap.top) });
                }}
                onPointerUp={dropBlock}
                onPointerCancel={() => releaseDrag()}
              />
              <Button
                iconOnly
                variant={addingBlocks ? "primary" : undefined}
                icon={Plus}
                onClick={() => onAddBlock?.(index + 1)}
                data-tip={addingBlocks ? "Close blocks" : "Add block"}
                aria-label="Add a block"
                aria-pressed={addingBlocks}
              />
              {canItem && (
                <Button
                  iconOnly
                  icon={ListPlus}
                  onClick={() => onAddBlockItem?.(index)}
                  data-tip="Add item"
                  aria-label="Add an item to this block"
                />
              )}
              {canLess && (
                <Button
                  iconOnly
                  icon={ListMinus}
                  // Keeps the caret's row: the button would otherwise take the focus.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    // The row the text cursor is in, else the last one.
                    const at = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(`[data-block="${index}"] [data-item]`);
                    const rows = stageRef.current?.querySelectorAll<HTMLElement>(`[data-block="${index}"] [data-item^="stack.${index}.items."]`);
                    const path = at?.getAttribute("data-item") ?? (rows?.length ? rows[rows.length - 1].getAttribute("data-item") : null);
                    if (path) onDeleteItemRef.current?.(path.replace(/^(stack\.\d+\.items\.\d+).*$/, "$1"));
                  }}
                  data-tip="Remove item"
                  aria-label="Remove an item from this block"
                />
              )}
              {tone && onTone && (
                <div className="relative">
                  <Button
                    iconOnly
                    icon={Palette}
                    onClick={() => setTones((v) => !v)}
                    data-tip="Colour"
                    aria-label="Colour of this banner"
                    aria-expanded={tones}
                  />
                  {tones && (
                    <div className="pop-in absolute left-full top-1/2 ml-2 flex -translate-y-1/2 gap-1.5 rounded-full border border-hairline-light bg-surface p-1.5 shadow-float">
                      {(Object.keys(CALLOUT_TONES) as CalloutTone[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            onTone(index, t);
                            setTones(false);
                          }}
                          title={t[0].toUpperCase() + t.slice(1)}
                          aria-label={t}
                          aria-pressed={t === tone}
                          className={`size-7 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${t === tone ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                          style={{ background: CALLOUT_TONES[t].solid }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {sideTitle !== null && (
                <Button
                  iconOnly
                  icon={sideTitle ? PanelLeftClose : PanelLeftOpen}
                  onClick={() => onSideTitle?.(index)}
                  data-tip={sideTitle ? "Hide side title" : "Show side title"}
                  aria-label={sideTitle ? "Remove the side title" : "Bring back the side title"}
                />
              )}
              {cols !== null && (
                <>
                  <Button
                    iconOnly
                    icon={BetweenVerticalEnd}
                    disabled={cols >= 5}
                    onClick={() => onColumns?.(index, true)}
                    data-tip={cols >= 5 ? "Max 5 columns" : "Add column"}
                    aria-label="Add a column"
                  />
                  <Button
                    iconOnly
                    icon={Columns2}
                    disabled={cols <= 2}
                    onClick={() => onColumns?.(index, false)}
                    data-tip={cols <= 2 ? "Min 2 columns" : "Remove column"}
                    aria-label="Remove the last column"
                  />
                </>
              )}
              <Button
                variant="danger"
                iconOnly
                icon={Trash2}
                disabled={count <= 1 || canDeleteBlock?.(index) === false}
                onClick={() => {
                  onDeleteBlock?.(index);
                  setHoverBlock(null);
                }}
                data-tip={canDeleteBlock?.(index) === false ? "Page 1 keeps its title" : "Delete block"}
                aria-label="Remove this block"
              />
            </div>
            {incoming != null && (
              // Where a block from the rail will land.
              <div
                className="pointer-events-none absolute z-20 h-[3px] rounded-full bg-giga"
                style={{ left: pageLeft + 24 * (4 / 3) * scale, width: (595 - 48) * (4 / 3) * scale, top: gapY(incoming) - 1.5 }}
              />
            )}
            {drag && drag.gap !== drag.from && drag.gap !== drag.from + 1 && (
              // Where the block will land: a line across the text width.
              <div
                className="pointer-events-none absolute z-20 h-[3px] rounded-full bg-giga"
                style={{ left: pageLeft + 24 * (4 / 3) * scale, width: (595 - 48) * (4 / 3) * scale, top: gapY(drag.gap) - 1.5 }}
              />
            )}
          </>
        );
      })()}
      {editable && (
        <>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/svg+xml,.svg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              const slug = pendingLogoSlug.current;
              pendingLogoSlug.current = null;
              if (!file || !slug) return;
              if (!file.type.includes("svg") && !file.name.toLowerCase().endsWith(".svg")) {
                alert("Il logo deve essere un file SVG.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => onUploadLogoRef.current?.(slug, reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
        </>
      )}
    </div>
  );
}
