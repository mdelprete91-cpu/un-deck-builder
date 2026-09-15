"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { autofitAll, autofitNode } from "@/lib/slides/autofit";
import type { ImagePos } from "@/lib/slides/schema";

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
  /** When set, every photo slot gets its own upload action. */
  onPickImage?: ((path: string) => void) | null;
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
  onFocusBlock,
  focusedBlock,
  onMoveBlock,
  onDeleteBlock,
  size = { w: 1920, h: 1080 },
  variant = "slide",
  className,
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
  // The two-pager callbacks travel together in one ref: the wiring effect
  // must not re-run when a parent re-renders, and one ref is one lint waiver
  // rather than four.
  const pageRef = useRef({ onPickImage, onFocusBlock, onMoveBlock, onDeleteBlock });
  pageRef.current = { onPickImage, onFocusBlock, onMoveBlock, onDeleteBlock };

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
    autofitAll(stage);
    // Web fonts may land after the first measurement and reflow the text;
    // refit once they are ready (no-op when already loaded).
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive && stageRef.current === stage) autofitAll(stage);
    });
    if (!editable) return () => { alive = false; };

    const cleanups: (() => void)[] = [];

    // Inline text editing (with live autofit while typing)
    stage.querySelectorAll<HTMLElement>("[data-edit]").forEach((node) => {
      node.contentEditable = "plaintext-only";
      const original = node.innerText;
      const commit = () => {
        const value = node.innerText;
        if (value !== original && onEditRef.current) {
          onEditRef.current(node.getAttribute("data-edit")!, value);
        }
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          node.innerText = original;
          node.blur();
        }
      };
      const onInput = () => autofitNode(node);
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
        if (getComputedStyle(node).position === "static") {
          node.style.position = "relative";
        }
        const btn = document.createElement("button");
        btn.className = "item-delete";
        btn.type = "button";
        btn.title = "Delete element";
        btn.textContent = "✕";
        // The ✕ overhangs the item's top-right corner (-24px). Keep it inside
        // when the item clips itself (partner logos) or when a clipping
        // ancestor would cut the overhang off (callout rows in the flex zone).
        let inside = getComputedStyle(node).overflow === "hidden";
        if (!inside) {
          const overhang = 24 * (stage.getBoundingClientRect().width / size.w);
          const r = node.getBoundingClientRect();
          for (let p = node.parentElement; p && p !== stage; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.overflowY === "hidden") {
              const cr = p.getBoundingClientRect();
              if (r.right + overhang > cr.right + 1 || r.top - overhang < cr.top - 1) {
                inside = true;
                break;
              }
            }
          }
        }
        if (inside) {
          btn.style.top = "8px";
          btn.style.right = "8px";
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
        btn.textContent = "⬆ SVG";
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
        const button = (label: string, title: string, fn: () => void, disabled = false) => {
          const b = document.createElement("button");
          b.type = "button";
          b.title = title;
          b.textContent = label;
          b.disabled = disabled;
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            fn();
          });
          bar.appendChild(b);
        };
        button("↑", "Move this block up", () => pageRef.current.onMoveBlock?.(i, i - 1), i === 0);
        button("↓", "Move this block down", () => pageRef.current.onMoveBlock?.(i, i + 1), i === blocks.length - 1);
        button("✕", "Remove this block", () => pageRef.current.onDeleteBlock?.(i), blocks.length <= 1);
        node.appendChild(bar);
      });
    }

    // Photo slots: their own upload action, which is what makes a page with
    // several images workable (the toolbar action can only mean one of them).
    stage.querySelectorAll(".image-upload").forEach((b) => b.remove());
    if (pageRef.current.onPickImage) {
      stage.querySelectorAll<HTMLElement>("img[data-image]").forEach((img) => {
        const slot = img.parentElement;
        if (!slot) return;
        if (getComputedStyle(slot).position === "static") slot.style.position = "relative";
        const btn = document.createElement("button");
        btn.className = "image-upload";
        btn.type = "button";
        btn.title = "Change this image";
        btn.textContent = "Image";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          pageRef.current.onPickImage?.(img.getAttribute("data-image") || "image");
        });
        slot.appendChild(btn);
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
      btn.textContent = "+ Add element";
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

  // Fit, then overscan by two source pixels: a fractional container width
  // otherwise leaves a sub-pixel sliver of the container showing along one
  // edge, which reads as a white hairline on a colored slide. The overflow
  // clip hides the extra pixel on each side.
  const fit = Math.min(box.w / size.w, box.h / size.h);
  const scale = fit > 0 ? fit + 2 / size.w : 0;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        ref={stageRef}
        className={variant === "page" ? "slide-root page-root" : "slide-root"}
        style={{
          position: "absolute",
          width: size.w,
          height: size.h,
          left: (box.w - size.w * scale) / 2,
          top: (box.h - size.h * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      />
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
