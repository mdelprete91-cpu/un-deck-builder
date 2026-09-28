"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import createChapters from "@/public/help/create.chapters.json";
import editChapters from "@/public/help/edit.chapters.json";

/**
 * "How it works" (Mario, 28 Sep 2026): two short videos of the real editor,
 * recorded and narrated by tools/help-video (`npm run help:videos`).
 *
 * No tabs (Mario, the same day: a tab row is the wrong way to name two
 * topics). The rail beside the player is the table of contents, the way
 * chaptered help videos present it (Loom, YouTube chapters, Notion and
 * Figma help): the two videos are the two numbered chapters, each opening to
 * its moments with their timestamps, and they play as one sequence, the
 * second starting when the first ends. The moment playing is the one Mist
 * row, Ink and medium like every active item in the chrome (the chapter
 * playing has an Ink ring on its number, as an active thumbnail has), with a hairline
 * of Giga Blue under it for how far into it the video is: the dialog's only
 * accent. A click on a moment plays from there, in either video.
 */
const VIDEOS = [
  { id: "create", title: "Create a deck", chapters: createChapters, duration: 97 },
  { id: "edit", title: "Edit your slides", chapters: editChapters, duration: 71 },
] as const;
type VideoId = (typeof VIDEOS)[number]["id"];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const TOTAL = VIDEOS.reduce((t, v) => t + v.duration, 0);

export default function HelpModal({ initial = "create", onClose }: { initial?: VideoId; onClose: () => void }) {
  const [current, setCurrent] = useState<VideoId>(initial);
  const [open, setOpen] = useState<Record<VideoId, boolean>>({ create: initial === "create", edit: initial === "edit" });
  const [time, setTime] = useState(0);
  /** Where to start once the next source has loaded (a click in the other video). */
  const pending = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = VIDEOS.find((v) => v.id === current)!;
  const active = video.chapters.reduce((at, c, i) => (time + 0.05 >= c.start ? i : at), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const play = (id: VideoId, at: number) => {
    setOpen((o) => ({ ...o, [id]: true }));
    if (id !== current) {
      pending.current = at;
      setTime(at);
      setCurrent(id);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = at;
    setTime(at);
    void v.play().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="pop-in flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id="help-title" className="text-xl font-medium text-ink">
              How it works
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {VIDEOS.length} videos · {clock(TOTAL)}
            </p>
          </div>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        <div className="flex min-h-0 flex-col gap-5 p-6 md:flex-row">
          <div className="min-w-0 flex-1">
            <video
              key={current}
              ref={videoRef}
              src={`/help/${current}.mp4`}
              poster={`/help/${current}.jpg`}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                if (pending.current != null) {
                  e.currentTarget.currentTime = pending.current;
                  pending.current = null;
                }
              }}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              // One sequence: the second video starts where the first ends.
              onEnded={() => {
                const i = VIDEOS.findIndex((v) => v.id === current);
                if (i < VIDEOS.length - 1) play(VIDEOS[i + 1].id, 0);
              }}
              className="aspect-video max-h-[70vh] w-full rounded-2xl bg-canvas-2"
            >
              <track kind="captions" src={`/help/${current}.vtt`} srcLang="en" label="English" default />
            </video>
          </div>

          <nav aria-label="Chapters" className="flex shrink-0 flex-col gap-1 overflow-y-auto md:max-h-[70vh] md:w-72">
            {VIDEOS.map((v, n) => {
              const isCurrent = v.id === current;
              const expanded = open[v.id];
              return (
                <section key={v.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`help-${v.id}`}
                    onClick={() => {
                      // A closed chapter opens and plays; the one playing folds.
                      if (!expanded && !isCurrent) play(v.id, 0);
                      else setOpen((o) => ({ ...o, [v.id]: !o[v.id] }));
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-canvas-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                        isCurrent ? "border border-ink text-ink" : "bg-canvas-2 text-ink-muted"
                      }`}
                    >
                      {n + 1}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${isCurrent ? "font-medium text-ink" : "text-ink"}`}>{v.title}</span>
                    <span className="text-xs tabular-nums text-ink-faint">{clock(v.duration)}</span>
                    <ChevronDown
                      size={14}
                      aria-hidden
                      className={`shrink-0 text-ink-faint transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expanded && (
                    <ol id={`help-${v.id}`} className="mb-2 ml-[1.375rem] mt-0.5 flex flex-col border-l border-hairline-light pl-3">
                      {v.chapters.map((c, i) => {
                        const on = isCurrent && i === active;
                        const end = v.chapters[i + 1]?.start ?? v.duration;
                        const progress = on ? Math.min(1, Math.max(0, (time - c.start) / (end - c.start))) : 0;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => play(v.id, c.start)}
                              aria-current={on ? "step" : undefined}
                              className={`relative flex w-full items-baseline gap-3 overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                                on ? "bg-canvas-2 font-medium text-ink" : "text-ink-muted hover:bg-canvas-2 hover:text-ink"
                              }`}
                            >
                              <span className="w-8 shrink-0 text-xs tabular-nums text-ink-faint">{clock(c.start)}</span>
                              <span className="min-w-0 flex-1">{c.title}</span>
                              {on && (
                                <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-hairline-light">
                                  <span className="block h-full origin-left bg-giga" style={{ transform: `scaleX(${progress})` }} />
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
