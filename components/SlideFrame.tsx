"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { autofitAll, autofitNode } from "@/lib/slides/autofit";

interface SlideFrameProps {
  html: string;
  editable?: boolean;
  onEdit?: (path: string, value: string) => void;
  onDeleteItem?: (path: string) => void;
  /** When set, an in-slide "+ Add element" button appears on hover. */
  onAddItem?: (() => void) | null;
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
    if (!editable) return;

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
        if (getComputedStyle(node).overflow === "hidden") {
          // clipped cells (e.g. partner logos) keep the ✕ inside the corner
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

    return () => cleanups.forEach((fn) => fn());
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
