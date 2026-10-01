/**
 * Voice-over for the help videos: one ElevenLabs clip per scene of
 * tools/help-video/script.json, with character timestamps, saved to
 * .omc/help-video/voice/<video>-<scene>.{mp3,json}. Jessica on Eleven v4,
 * chosen by Mario on 1 Oct 2026 (Bella on multilingual v2 sounded robotic).
 * Natural delivery, per ElevenLabs' v4 guidance: the script is written the
 * way people talk (contractions, short sentences, "..." for a pause), low
 * stability for a varied delivery, similarity below the default (high
 * similarity costs naturalness), and an audio tag that sets the tone. The
 * tag is spoken to the model, not read out, and is cut from the timings so
 * it never reaches the captions.
 *
 *   npx tsx --env-file=.env.local tools/help-video/voice.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VOICE = "cgSgspJ2msm6clMCkdW9"; // Jessica
const MODEL = "eleven_v4";
const SETTINGS = { stability: 0.3, similarity_boost: 0.6 };
const TAG = "[warm, friendly] ";
/** A clip is reused only if text, voice and model all match. */
const take = `${VOICE}/${MODEL}/${SETTINGS.stability}/${SETTINGS.similarity_boost}/${TAG}`;
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
      if (existsSync(`${base}.json`)) {
        const prev = JSON.parse(readFileSync(`${base}.json`, "utf8"));
        if (prev.text === s.text && prev.take === take) continue;
      }
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: TAG + s.text, model_id: MODEL, voice_settings: SETTINGS }),
      });
      if (!res.ok) throw new Error(`${video}/${s.id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const j = (await res.json()) as { audio_base64: string; alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } };
      writeFileSync(`${base}.mp3`, Buffer.from(j.audio_base64, "base64"));
      // Drop the tag's characters from the timings, so captions start at the words.
      const cut = j.alignment.characters.join("").startsWith(TAG) ? TAG.length : 0;
      const a = {
        characters: j.alignment.characters.slice(cut),
        character_start_times_seconds: j.alignment.character_start_times_seconds.slice(cut),
        character_end_times_seconds: j.alignment.character_end_times_seconds.slice(cut),
      };
      writeFileSync(`${base}.json`, JSON.stringify({ text: s.text, take, duration: a.character_end_times_seconds.at(-1), alignment: a }));
      console.log(`${video}/${s.id} ${a.character_end_times_seconds.at(-1)?.toFixed(1)}s`);
    }
  }
}
main();
