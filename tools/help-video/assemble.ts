/**
 * Turns a recording (record.ts) and its voice clips (voice.ts) into what the
 * How it works dialog plays: public/help/<video>.mp4 (H.264, faststart), a
 * poster, WebVTT captions cut per sentence from the voice alignment, and the
 * chapter list with start times. Every clip starts where its scene started.
 *
 *   npx tsx tools/help-video/assemble.ts create|edit
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".omc/help-video";
const OUT = "public/help";
const video = process.argv[2];
if (video !== "create" && video !== "edit") throw new Error("usage: assemble.ts create|edit");

type Align = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
const { end, timeline } = JSON.parse(readFileSync(join(ROOT, "raw", `${video}.timeline.json`), "utf8")) as {
  end: number;
  timeline: { id: string; chapter: string; start: number; duration: number }[];
};
// The page's first seconds are the app loading: start just before the first scene.
const lead = Math.max(0, timeline[0].start - 0.4);
const scenes = timeline.map((s) => ({ ...s, at: s.start - lead }));
const length = end - lead;

mkdirSync(OUT, { recursive: true });
const clips = scenes.map((s) => join(ROOT, "voice", `${video}-${s.id}.mp3`));
const filter =
  scenes.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s.at * 1000)}:all=1[a${i}]`).join(";") +
  `;${scenes.map((_, i) => `[a${i}]`).join("")}amix=inputs=${scenes.length}:normalize=0,apad[aout]`;
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-ss", lead.toFixed(2), "-i", join(ROOT, "raw", `${video}.webm`),
  ...clips.flatMap((c) => ["-i", c]),
  "-filter_complex", filter,
  "-map", "0:v", "-map", "[aout]",
  "-t", length.toFixed(2),
  "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "128k",
  "-movflags", "+faststart",
  join(OUT, `${video}.mp4`),
], { stdio: "inherit" });

// Poster: the first scene once the camera has settled.
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-ss", (scenes[0].at + 3).toFixed(2), "-i", join(OUT, `${video}.mp4`),
  "-frames:v", "1", "-vf", "scale=1280:-1", "-q:v", "4", join(OUT, `${video}.jpg`),
]);

// Captions: one cue per sentence, timed by the characters that open and close it.
const ts = (t: number) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};
const cues: string[] = [];
for (const s of scenes) {
  const a = JSON.parse(readFileSync(join(ROOT, "voice", `${video}-${s.id}.json`), "utf8")).alignment as Align;
  const text = a.characters.join("");
  const re = /[^.!?]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const from = m.index + (m[0].length - m[0].trimStart().length);
    const to = m.index + m[0].trimEnd().length - 1;
    if (to < from) continue;
    const start = s.at + a.character_start_times_seconds[from];
    const stop = s.at + a.character_end_times_seconds[to] + 0.25;
    // No cue settings: HelpModal draws the captions itself, inset from the frame.
    cues.push(`${ts(start)} --> ${ts(stop)}\n${text.slice(from, to + 1)}`);
  }
}
writeFileSync(join(OUT, `${video}.vtt`), `WEBVTT\n\n${cues.join("\n\n")}\n`);
writeFileSync(
  join(OUT, `${video}.chapters.json`),
  JSON.stringify(scenes.map((s) => ({ id: s.id, title: s.chapter, start: Math.round(s.at * 10) / 10 })), null, 1) + "\n",
);
console.log(`${OUT}/${video}.mp4 ${length.toFixed(1)}s, ${cues.length} captions`);
