/**
 * The live aura behind the cover and the closing slide: the Unicorn Studio
 * scene Mario picked (27 Sep 2026), recoloured for the brand and vendored in
 * `public/aura` (runtime 155 KB, two scene files, no badge, no network: the
 * scenes load from our own origin, or from inline JSON in the HTML file).
 * Slides carry a still of each scene (`/aura/<kind>.jpg`), which is what the
 * thumbnails, PDF and PPTX show; the editor's stage and the presenter mount
 * the live scene over the still. Reduced motion keeps the still.
 */
type Scene = { destroy: () => void };
type Unicorn = { addScene: (o: Record<string, unknown>) => Promise<Scene> };

let loading: Promise<Unicorn | null> | null = null;

function runtime(): Promise<Unicorn | null> {
  const w = window as unknown as { UnicornStudio?: Unicorn };
  if (w.UnicornStudio) return Promise.resolve(w.UnicornStudio);
  loading ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/aura/unicornStudio.umd.js";
    s.onload = () => resolve(w.UnicornStudio ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

let seq = 0;

/** Mounts the live scene in every [data-aura] under `root`; returns the cleanup. */
export function mountAura(root: HTMLElement): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const hosts = [...root.querySelectorAll<HTMLElement>("[data-aura]")];
  if (!hosts.length) return () => {};
  const scenes: Scene[] = [];
  let alive = true;
  runtime().then((us) => {
    if (!us || !alive) return;
    for (const host of hosts) {
      const kind = host.getAttribute("data-aura");
      const el = document.createElement("div");
      el.id = `aura-live-${++seq}`;
      el.style.cssText = "position:absolute;inset:0;";
      host.appendChild(el);
      us.addScene({ elementId: el.id, filePath: `/aura/${kind}.json`, fps: 60, scale: 1, dpi: 1, lazyLoad: false })
        .then((scene) => (alive ? scenes.push(scene) : scene.destroy()))
        .catch(() => el.remove());
    }
  });
  return () => {
    alive = false;
    scenes.forEach((s) => s.destroy());
    root.querySelectorAll('[id^="aura-live-"]').forEach((n) => n.remove());
  };
}
