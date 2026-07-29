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
  /** When set, photos can be reframed: drag to pan, wheel to zoom, double-click to reset. */
  onImagePos?: ((pos: ImagePos) => void) | null;
  /** When set, tier-table [data-cell] nodes cycle check → dimmed → empty on click. */
  onToggleCell?: ((row: number, col: number) => void) | null;
  /** When set, partner [data-logo] cells get an SVG logo upload action. */
  onUploadLogo?: ((slug: string, dataUrl: string) => void) | null;
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
  onUploadLogo,
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
  const onUploadLogoRef = useRef(onUploadLogo);
  onUploadLogoRef.current = onUploadLogo;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setBox({ w: rect.width, h: rect.height });
    };
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
          const overhang = 24 * (stage.getBoundingClientRect().width / 1920);
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
          if (moved) onImagePosRef.current?.(readPos());
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const p = readPos();
          apply({ ...p, zoom: clamp(p.zoom * (e.deltaY < 0 ? 1.07 : 0.93), 1, 4) });
          if (wheelTimer) clearTimeout(wheelTimer);
          wheelTimer = setTimeout(() => onImagePosRef.current?.(readPos()), 500);
        };
        const onDblClick = () => onImagePosRef.current?.({ x: 50, y: 50, zoom: 1 });

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
  }, [html, editable, onAddItem]);

  const scale = Math.min(box.w / 1920, box.h / 1080);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        ref={stageRef}
        className="slide-root"
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          left: (box.w - 1920 * scale) / 2,
          top: (box.h - 1080 * scale) / 2,
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
