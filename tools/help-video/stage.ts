/**
 * In-page helpers for the help-video recorder, injected before the app
 * loads: a camera (a CSS transform on <body> that eases towards an element,
 * so text stays sharp at any zoom) and a cursor (headless Chromium draws
 * none) with a ring on each click. Both live on window.__stage.
 */
export const STAGE_JS = `
(() => {
  const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  let s = 1, tx = 0, ty = 0;
  const W = () => innerWidth, H = () => innerHeight;
  function apply(ms) {
    const b = document.body;
    b.style.transformOrigin = "0 0";
    b.style.transition = "transform " + ms + "ms " + EASE;
    b.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
  }
  function unscaled(r) {
    return { x: (r.left - tx) / s, y: (r.top - ty) / s, w: r.width / s, h: r.height / s };
  }
  let cursor, ring;
  function ensureCursor() {
    if (cursor) return;
    cursor = document.createElement("div");
    cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 9-7 1.6L9.5 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    cursor.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform 650ms " + EASE + ";transform:translate(" + (W() / 2) + "px," + (H() / 2) + "px);filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))";
    ring = document.createElement("div");
    ring.style.cssText = "position:fixed;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:3px solid #277aff;z-index:2147483646;pointer-events:none;opacity:0;";
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(cursor);
  }
  let cx = 0, cy = 0;
  window.__stage = {
    zoomRect(r, scale, ms) {
      const u = unscaled({ left: r.x, top: r.y, width: r.width, height: r.height });
      s = scale;
      tx = Math.min(0, Math.max(W() - s * W(), W() / 2 - s * (u.x + u.w / 2)));
      ty = Math.min(0, Math.max(H() - s * H(), H() / 2 - s * (u.y + u.h / 2)));
      apply(ms ?? 900);
      return true;
    },
    reset(ms) { s = 1; tx = 0; ty = 0; apply(ms ?? 800); },
    moveTo(sel, dx, dy) {
      ensureCursor();
      const el = typeof sel === "string" ? document.querySelector(sel) : sel;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      cx = r.left + r.width * (dx ?? 0.5); cy = r.top + r.height * (dy ?? 0.5);
      cursor.style.transform = "translate(" + cx + "px," + cy + "px)";
      return { x: cx, y: cy };
    },
    moveXY(x, y) { ensureCursor(); cx = x; cy = y; cursor.style.transform = "translate(" + x + "px," + y + "px)"; },
    click() {
      ensureCursor();
      ring.animate([{ transform: "translate(" + cx + "px," + cy + "px) scale(.4)", opacity: .9 }, { transform: "translate(" + cx + "px," + cy + "px) scale(1.4)", opacity: 0 }], { duration: 520, easing: "ease-out" });
    },
    hideCursor() { if (cursor) cursor.style.opacity = "0"; },
    showCursor() { ensureCursor(); cursor.style.opacity = "1"; },
  };
})();
`;
