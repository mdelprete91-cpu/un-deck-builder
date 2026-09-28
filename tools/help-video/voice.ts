/**
 * Voice-over for the help videos: one ElevenLabs clip per scene of
 * tools/help-video/script.json, with character timestamps, saved to
 * .omc/help-video/voice/<video>-<scene>.{mp3,json}. Bella (American,
 * professional, warm), chosen by Mario on 28 Sep 2026.
 *
 *   npx tsx --env-file=.env.local tools/help-video/voice.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VOICE = "hpp4J3VqNfWAUOO0d1Us"; // Bella
const OUT = ".omc/help-video/voice";
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is not set");

type Scene = { id: string; chapter: string; text: string };
const script = JSON.parse(readFileSync("tools/help-video/script.json", "utf8")) as Record<string, { title: string; scenes: Scene[] }>;

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [video, { scenes }] of Object.entries(script)) {
    for (const s of scenes) {
      const base = join(OUT, `${video}-${s.id}`);
      // Reuse a clip whose text has not changed: a re-run costs nothing.
      if (existsSync(`${base}.json`) && JSON.parse(readFileSync(`${base}.json`, "utf8")).text === s.text) continue;
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: s.text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 } }),
      });
      if (!res.ok) throw new Error(`${video}/${s.id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const j = (await res.json()) as { audio_base64: string; alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } };
      writeFileSync(`${base}.mp3`, Buffer.from(j.audio_base64, "base64"));
      const a = j.alignment;
      writeFileSync(`${base}.json`, JSON.stringify({ text: s.text, duration: a.character_end_times_seconds.at(-1), alignment: a }));
      console.log(`${video}/${s.id} ${a.character_end_times_seconds.at(-1)?.toFixed(1)}s`);
    }
  }
}
main();
