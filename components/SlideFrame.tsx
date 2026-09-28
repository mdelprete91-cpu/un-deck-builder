"use client";

import { mountAura } from "@/lib/slides/aura-live";
import { lucideSvg } from "@/lib/slides/icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const pageRef = useRef({ onPickImage, onFocusBlock, onMoveBlock, onDeleteBlock, onChartClick });
  pageRef.current = { onPickImage, onFocusBlock, onMoveBlock, onDeleteBlock, onChartClick };

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
    if (onDeleteItemRef.current) {
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

    // Partner cells: SVG logo upload action
    stage.querySelectorAll(".logo-upload").forEach((b) => b.remove());
    if (onUploadLogoRef.current) {
      stage.querySelectorAll<HTMLElement>("[data-logo]").forEach((cell) => {
        const btn = document.createElement("button");
        btn.className = "logo-upload";
        btn.type = "button";
        btn.title = "Upload the partner logo (SVG — rendered white automatically)";
        btn.innerHTML = `${lucideSvg("upload")}<span>SVG</span>`;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          pendingLogoSlug.current = cell.getAttribute("data-logo");
          logoInputRef.current?.click();
        });
        cell.appendChild(btn);
      });
    }

    // Two-pager blocks: click to focus, hover for move and delete. The chrome
    // is injected here rather than emitted by the renderer, so the printed
    // markup and the exports stay exactly what the design says.
    stage.querySelectorAll(".block-chrome").forEach((b) => b.remove());
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
        const bar = document.createElement("div");
        bar.className = "block-chrome";
        const button = (icon: string, title: string, fn: () => void, disabled = false) => {
          const b = document.createElement("button");
          b.type = "button";
          b.title = title;
          b.innerHTML = lucideSvg(icon);
          b.disabled = disabled;
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            fn();
          });
          bar.appendChild(b);
        };
        button("arrow-up", "Move this block up", () => pageRef.current.onMoveBlock?.(i, i - 1), i === 0);
        button("arrow-down", "Move this block down", () => pageRef.current.onMoveBlock?.(i, i + 1), i === blocks.length - 1);
        button("x", "Remove this block", () => pageRef.current.onDeleteBlock?.(i), blocks.length <= 1);
        node.appendChild(bar);
      });
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
    <div
      ref={containerRef}
      className={`relative ${frameClassName ? "" : "overflow-hidden "}${className ?? ""}`}
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
          }}
        />
      </div>
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
