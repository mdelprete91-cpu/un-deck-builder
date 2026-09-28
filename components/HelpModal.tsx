"use client";

import { Clapperboard, PencilLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import createChapters from "@/public/help/create.chapters.json";
import editChapters from "@/public/help/edit.chapters.json";

/**
 * "How it works" (Mario, 28 Sep 2026, replacing the step-by-step tour): two
 * short videos of the real editor, recorded and narrated by
 * tools/help-video (Playwright, ElevenLabs, ffmpeg; `npm run help:videos`).
 * Each has captions and a chapter list beside it; a click on a chapter
 * jumps there, and the chapter playing is marked as the video runs.
 * Re-record when the chrome the videos show changes.
 */
const VIDEOS = {
  create: { label: "Create a deck", icon: Clapperboard, chapters: createChapters },
  edit: { label: "Edit your slides", icon: PencilLine, chapters: editChapters },
} as const;
type VideoId = keyof typeof VIDEOS;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function HelpModal({ initial = "create", onClose }: { initial?: VideoId; onClose: () => void }) {
  const [tab, setTab] = useState<VideoId>(initial);
  const [time, setTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { chapters } = VIDEOS[tab];
  const current = chapters.reduce((at, c, i) => (time + 0.05 >= c.start ? i : at), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setTime(t);
    v.play().catch(() => {});
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
        <div className="flex items-center justify-between gap-4 px-6 pt-5">
          <h2 id="help-title" className="text-xl font-medium text-ink">
            How it works
          </h2>
          <div role="tablist" aria-label="Video" className="flex h-10 items-center gap-1 rounded-full bg-canvas-2 p-1">
            {(Object.keys(VIDEOS) as VideoId[]).map((id) => {
              const v = VIDEOS[id];
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(id);
                    setTime(0);
                  }}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-4 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                    active ? "bg-surface font-medium text-ink shadow-stripe" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <v.icon size={14} aria-hidden />
                  {v.label}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} title="Close (Esc)" aria-label="Close" className="-mr-2" />
        </div>

        <div className="flex min-h-0 flex-col gap-5 p-6 md:flex-row">
          {/* 16:9, never taller than the window allows, so the dialog fits a
              13-inch laptop with the chapter list beside it. */}
          <div className="min-w-0 flex-1">
            <video
              key={tab}
              ref={videoRef}
              src={`/help/${tab}.mp4`}
              poster={`/help/${tab}.jpg`}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              className="aspect-video max-h-[70vh] w-full rounded-2xl bg-canvas-2"
            >
              <track kind="captions" src={`/help/${tab}.vtt`} srcLang="en" label="English" default />
            </video>
          </div>
          <ol aria-label="Chapters" className="flex shrink-0 flex-col gap-0.5 overflow-y-auto md:w-60">
            {chapters.map((c, i) => {
              const on = i === current;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => seek(c.start)}
                    aria-current={on ? "step" : undefined}
                    className={`flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-giga/30 ${
                      on ? "bg-giga-tint font-medium text-giga" : "text-ink-muted hover:bg-canvas-2 hover:text-ink"
                    }`}
                  >
                    <span className="w-9 shrink-0 tabular-nums text-xs text-ink-faint">{clock(c.start)}</span>
                    {c.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
