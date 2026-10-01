# Context for Claude (and for anyone new to this repo)

Read this file before touching any code. It is the shared brief between the people working on
this product: what it is, what must never change, where things live, and how a change gets
verified. `README.md` explains the feature set, `PRODUCT.md` the audience and register,
`DESIGN.md` the editor chrome tokens. This file is the one that keeps two collaborators from
undoing each other's work.

## What this product is

Un Deck Builder generates on-brand slide decks for Giga (the UNICEF-ITU initiative connecting
every school in the world to the internet) from a plain-language brief. The users are brand and
communications people, not designers.

The load-bearing idea: **the AI never designs a slide.** It picks a `layoutId` from a fixed,
approved catalog and writes the text that fills it. Every pixel comes from the "Giga Slides"
template, already signed off by the design team. Anything that gives the model more freedom over
layout, color, or geometry is a regression, not a feature, no matter how good the output looks.

Stack: Next.js 16.2 (App Router), React 19, TypeScript, Tailwind 4, OpenAI SDK, zod.
Deployed on Vercel as `un-deck-builder`. One env var: `OPENAI_API_KEY`.

## Non-negotiables

Do not change these without asking Mario first. They are decisions, not defaults.

1. **One palette for every lockup on the menu, and it is fixed.** UNICEF, Digital Impact Division
   and Digital Inclusion all run on the cyan palette (Mario, 17 Sep 2026, when UNICEF moved off the
   Giga palette). Switching between them changes the logo lockup and the footer label only, never
   the colors. The Giga palette survives only for the retired Giga lockup, which is no longer
   offered in the Logo menu (see `PICKER_BRAND_IDS`) but still renders decks saved with it. See
   the comment in `lib/slides/brand.ts`.
2. **The UNICEF lockups are two-surface brands.** Every colored surface is exactly UNICEF
   cyan `#01AEEF`; anything that is not that cyan is white. So there is no second darker blue
   (`deep` is the same cyan as `accent`), the tinted surface (`light`) is plain white, Section +
   image is a white slide, and the template's green quote slide is cyan here too. Bar chart series
   are tints of the same cyan. The one multi-hue element is the donut, which uses the UNICEF Brand
   Book's secondary colours (`chartSeries` in `brand.ts`, Mario's call, 15 Sep 2026).

   **Charts have a hand-picked exception.** A bar or a donut segment may be given one of the sixteen
   colours in `lib/slides/chart-colors.ts` (Giga blues, UNICEF Brand Book secondaries, neutrals)
   from the Data panel; `bars[i].color` carries it, `normalizeSlide` drops any other hex, and the
   model never sets it (it is not in the output schema); a regenerated chart keeps its colours by
   position (`recolor` in `app/page.tsx`). Absent, the brand series decides.

   **On paper this rule has one documented exception.** The approved A4 boards use a small print
   palette on top of the cyan: `#D14807` for status and attention, its peach border `#E8B8A2` and
   10% tint, panel grey `#EFF2F5`, hairline `#E6E6E6`. It lives in `PALETTE` in
   `lib/slides/pages/a4.ts` and deliberately **not** on `BrandTheme`, so no slide renderer can
   reach it. Anything beyond that list is still a question for Mario.
3. **No black on a slide.** No solid black or near-black background on any slide. This is why
   `section-image-dark` was retired. Dark surfaces on slides are Giga blue, not black. The one
   exception is the chrome's dark theme (Mario, 18 Sep 2026): it takes ChatGPT's dark values
   verbatim, pure black sidebar included, because the chrome is not the brand's output.
4. **One accent.** Giga Blue `#277AFF` and its tints, or `#01AEEF` and its tints on the Digital
   sub-brands. Red only for destructive and error states.
5. **Slide typography never varies.** Manrope plus Open Sans, self-hosted in `public/fonts`, on
   every slide and page. The editor chrome is a separate matter: it is set in Inter (Mario's call,
   15 Sep 2026, self-hosted too), regular weight by default, and Inter never reaches a slide.
6. **Slide markup is verbatim from the template.** The renderers in `lib/slides/layouts/` reproduce
   approved geometry at 1920x1080. Do not "improve" spacing, sizes, or hierarchy on your own
   judgment. If a slide looks wrong, the fix is usually the fit budget or the word limit, not the
   geometry.
7. **Never invent a layout.** New slide types come from the template, not from the model and not
   from us. One approved exception (Mario, 25 Sep 2026): the five full-width charts in
   `lib/slides/layouts/charts.ts` (wide columns up to thirty, horizontal bars, line, grouped
   columns, stacked columns) are derived from chart-bars, template 16: its title, axis, grid and
   tints, with the plot run across the content width. See "Charts" below. A second one (Mario,
   26 Sep 2026): `progress` in `lib/slides/layouts/progress.ts`, derived from timeline-phases,
   3-6 stages on a progress bar. `current` (1-based, in the output schema as an integer, 0 when
   unused) is the stage in progress: earlier stages are filled accent nodes with a tick and
   "Done", the current one a larger accent ring with its label in the accent and "In progress",
   the rest grey rings and "Next"; the bar fills to it. Absent, the slide is a plain sequence. A
   click on a node sets it: `data-set` / `data-value` on the node, read by SlideFrame as an edit
   of that path. Body limits are 12 words up to four stages, 8 with five or six. A third (Mario,
   28 Sep 2026): the six dense layouts in `lib/slides/layouts/dense.ts` (cascade and the takeaway
   added the same day from the patterns sheet) and the footnote, see
   "Dense layouts and footnotes" below. And every content layout has a high-density variant (Mario,
   28 Sep 2026), see "High density" below.
8. **Slide renderers emit HTML strings with inline styles only.** No Tailwind classes, no external
   CSS. The same markup has to survive the editor preview, the thumbnails, the print root, the
   self-contained HTML export, and the PPTX capture. A class that only exists in `globals.css`
   breaks the exports silently.

## The pipeline in one screen

```
brief ──> app/api/generate/route.ts        streaming NDJSON route, gpt-6-luna
             ├─ lib/slides/prompt.ts       system prompt = catalog + brand voice + hard rules
             ├─ lib/slides/parse.ts        incremental JSON scanner, slides stream in one by one
             └─ lib/slides/schema.ts       zod validation + normalizeSlide (clamps array sizes)
                     │
                     v
          lib/slides/state.ts              useReducer deck state, undo/redo, agenda sync
                     │
                     v
          lib/slides/layouts/*.ts          one HTML-string renderer per layout
                     │
                     v
          components/SlideFrame.tsx        injects the HTML, wires inline editing + autofit
```

Supporting files: `catalog.ts` (the AI-facing layout list with word limits), `brand.ts` (the four
brand themes), `defaults.ts` (placeholder content for manual insert), `autofit.ts` (text shrinking),
`storage.ts` (localStorage autosave), `icons.ts` (Lucide markup), `partners.ts` (the partner logo
wall), `export-html.ts` and `export-pptx.ts`.

`app/page.tsx` is the whole editor shell (sidebar, toolbar, canvas, filmstrip, modals). It is large
on purpose, but if you add a self-contained piece of UI, put it in `components/`.

## Contracts that are easy to break

**`data-edit` / `data-fit` / `data-item`.** Every editable text node carries `data-edit="<state path>"`
and usually `data-fit="<vertical budget in px>"`; every deletable element carries
`data-item="<array path>"`. `SlideFrame` and `autofit.ts` read these attributes. A renderer that
skips them produces a slide the user cannot edit, with no error anywhere. Use the `ed()` and
`item()` helpers in `layouts/shared.ts`.

**`data-hj-suppress` on deck content.** Hotjar (site 6786608, `app/layout.tsx`, production
only) records sessions, and people build real decks here. Every surface that shows the user's
content carries `data-hj-suppress`, so recordings keep clicks and layout but not the words:
`SlideFrame` (every slide, thumbnail and preview), `PrintRoot`, the deck name, attachment names,
sheet titles, the resume row, the Edit with AI box, the chart data panel and the fidelity review.
A new surface that shows deck text needs it too.

**Fit budgets and word limits are one system.** The `data-fit` value in a renderer and the
`<=N words` limit in `catalog.ts` were tuned together so that text at the catalog limit still
renders at full size. Change one and you have to re-check the other, or slides start shrinking
their own text. Stat values (`stat-grid`, `brand-equity`, `two-stats`) are the special case: they
wrap to a second line inside a budget sized to the row pitch before they shrink, and they carry
`data-fit-group="stat"`, so `autofitAll` gives every value on the slide the smallest scale among
them: six values, one size. The group logic lives twice, in `autofit.ts` and in its ES5 copy
`AUTOFIT_JS` that the HTML export inlines; change both. `SlideFrame` fits every stage itself and
reports the count to `onAutofit` afterwards: never fold the fit into the optional call
(`onAutofit?.(autofitAll(stage))`), because an optional call skips its arguments when nobody
listens, and the main stage and the thumbnails pass no listener. That shipped once (23 Sep 2026)
and no slide shrank its text for a day.

**`dly()` for animation delays.** Never write `animation-delay:.${n}s` by hand. With a single-digit
n that reads as 0.8s, which is what broke element ordering in the HTML export once already.

**`esc()` on every user string.** Renderers build raw HTML.

**Uploaded assets never reach the model.** `app/page.tsx` strips `image`, `imagePos`, `logoTone`,
`logos` and `grid` before sending existing slides to the API (`lightSlide`), and merges them back
into the replaced slide afterwards. Data URLs in a prompt are expensive and useless to the model.

**Retired layouts stay in the code.** `LEGACY_LAYOUT_IDS` exists so decks saved before a layout was
banned still validate and render. Never offer them to the AI or in the insert list, never delete
them.

**Editable means it must be on the slide.** `setPath` (`state.ts`) walks the dotted path and returns
the slide untouched if an intermediate node is missing, so a renderer that puts `data-edit` on a
value read from a module constant produces a field the user can click, type into, and watch revert.
That was the closing slide's social row: it now lives in `slide.channels`, seeded from
`DEFAULT_CHANNELS` by `normalizeSlide` and, for decks saved before it moved, by `loadDeck`. Deleting
is a separate contract: on a standard slide the ✕ from `item()` only works for the layout's
`PRIMARY_ARRAY` field (and the footnote); on a high-density slide `deleteModular` decides (below).

**Forced content.** The closing slide is always titled "Thanks" (`normalizeSlide`), except when a
deck file is reopened: that title is the user's own output, so `normalizeSlide(raw, {
keepClosingTitle: true })` keeps whatever it says, as long as it says something. The AI path never
passes that flag. Agenda bullets mirror the `section-divider` slides one to one, enforced both in
the prompt and by `syncAgenda` in `state.ts`.

**The state payload must stay out of the rendered markup.** `exportHtmlDeck` inlines assets by
rewriting every `src="/…"` it finds anywhere in the slide markup, and a user can type that text into
a slide title. The `<script id="giga-deck-state">` block is therefore assembled at document level,
after the runtime script, never inside the `body` string. Move it into `body` and the two corrupt
each other.

**The "Chapters" toggle is a generation setting.** `state.chapters` (off by default) decides whether
a generated deck gets an agenda slide and section dividers. It sits *inside* the prompt box, as a
pill in the composer's bottom bar right next to Generate, because it is an input to the same
Generate press: as a detached card it read as a live view option, which it is not. When the deck on
screen disagrees with the toggle, the sidebar says so under the prompt rather than silently doing
nothing. Off, it does two things:
`NO_CHAPTERS` goes into the user message for generate and add, and `dropChapters` in `page.tsx`
discards any `agenda` or `section-divider` the model emits anyway. Keep both — the prompt rule alone
leaks a stray divider often enough to matter. It never edits the deck already on screen, and
`regenerate` is deliberately exempt so regenerating an existing agenda slide still works.

**A named count under eight overrides the toggle.** Cover, agenda, two dividers, two content
slides and the closing slide are eight already, so "Six slides" with chapters on cannot hold
(`MIN_SLIDES_WITH_CHAPTERS` in `page.tsx`). `onGenerate` then sends `chapters: false` and drops
strays for that generation only, the setting itself is untouched, and the sidebar says "Chapters
left out" in place of the usual regenerate-to-apply line (`chaptersSkipped`, session state in
`page.tsx`). For a larger count the model is told that when the count leaves no room for both,
the chapters go, never the content. Before this (22 Sep 2026) a six-slide OKR brief came back as
sixteen slides, seven of them agenda and dividers.

**Bump `VERSION` in `storage.ts`** whenever the persisted shape changes, otherwise returning users
hydrate a broken deck from localStorage.

**The editor opens empty, and the autosave is a safety net rather than a session.** It used to
restore the last deck silently, so every visit after the first started on finished work with no
obvious way back to a blank page. `openSession` now returns that deck separately from the settings:
`app/page.tsx` holds it in `previous` state and offers it on the empty state instead of applying it,
and only `brandId` is hydrated, because a preference is not work and Chapters is a per-deck
decision that opens off every time (Mario, 25 Sep 2026).

The offer is backed by the saved session itself, not a copy — a photo-heavy deck already runs at the
edge of the localStorage quota, so a second key would be the write that fails. What keeps it alive
is the autosave: **it is held off while `previous` is set**, since the empty editor has nothing worth
writing over that deck. Remove that guard and the first debounce tick erases the deck the card is
still offering. `onDeckArrived` releases it, which is also what stops the offer from resurfacing
behind a deck the user has since deleted; Discard calls `clearSaved`.

**"How it works" is two narrated videos, not a tour** (Mario, 28 Sep 2026; the spotlight tour
is gone). `components/HelpModal.tsx` plays `public/help/create.mp4` and `edit.mp4` as one
sequence, with English captions (`.vtt`). No tabs (Mario, the same day): the rail beside the
player is the table of contents, the two videos as two numbered chapters that fold open onto
their moments (`.chapters.json`, imported at build time; the chapter playing has an Ink ring on
its number), the moment playing a Mist row with a hairline of Giga Blue for its progress, a click
on any moment plays from there. It opens on the edit video once a deck exists. Captions are
drawn by the dialog, not the player: the track stays `hidden` (its cues drive an overlay inset 8%
from the sides and 14% from the bottom, above the control bar), because native cues sat on the
frame's edges and Chrome ignores the VTT position settings; the player's CC menu still turns them
off. Durations are
constants in `VIDEOS`: update them after a re-record. The videos are the real editor, driven by `tools/help-video/`:

- `script.json` is the narration, one scene per chapter; `voice.ts` turns it into ElevenLabs
  clips (voice Jessica on Eleven v4, chosen 1 Oct 2026 for a less robotic read: the script is written the way people talk, stability 0.3, similarity 0.6, a `[warm, friendly]` tag cut from the timings; `ELEVENLABS_API_KEY` in `.env.local`; a clip is skipped when text, voice, model and settings are unchanged) with
  character timings.
- `record.ts` runs the editor on `localhost:3777` in Playwright at 1920x1080, one function per
  scene, each scene held for its clip. A fake cursor and a CSS camera on `<body>` (`stage.ts`)
  do the pointing and the zooms. Model calls are recorded once to `.omc/help-video/fixtures` and
  replayed after, a generation streamed back one slide at a time, so a re-record costs nothing;
  delete a fixture to fetch it again. The edit video starts from a deck written in the script.
- `assemble.ts` places each clip where its scene started, encodes H.264 with faststart, and
  writes the poster, captions (one cue per sentence, from the voice timings) and chapters.
- `npm run help:videos` runs all of it with the dev server up. Re-record when the chrome the
  videos show changes. Selectors used: the `data-tour` attributes (kept for this), aria labels
  and titles; a scene that cannot find its target logs a line and the video goes on, so read
  the log and look at frames before shipping.

`onDeckArrived` stays the single place every path that puts slides on screen goes through
(generate, restore, open a file, manual insert, drop an image); it only retires the last-session
offer.

## The AI layer

- Model: `gpt-6-luna` through the OpenAI Responses API (Mario's call, 25 Sep 2026; it replaced
  `claude-haiku-4-5` outright, no provider switch). The fast model of the GPT-6 series, about a
  tenth of Haiku's price: $0.10 per million input tokens, $0.50 output, so a 12-slide deck is
  about $0.001. The whole design still assumes a small model doing a constrained job, and
  `reasoning.effort` is `none` for the same reason: the schema and the catalog constrain, thinking
  tokens would only add latency. The system prompt goes in `instructions`, the user turn in
  `input`, the schema in `text.format` with `strict: true`; the stream's `response.output_text.delta`
  feeds the same `SlideStreamParser`, `response.incomplete` with reason `max_output_tokens` is
  the truncation the client hears about, a refusal (`response.refusal.delta`) is an error in plain
  words. Errors: 401 says the key is invalid, 429 rate limited, 503 or `server_is_overloaded`
  the overloaded message. Everything the guards, the QA suite and this file say about the model's
  slips was measured on Haiku: re-run `tools/qa-suite.ts` and read the report before trusting them
  on Luna.
- **Every field in the output schema is required and every object has `additionalProperties:
  false`.** That is what strict structured outputs demand (and it was the shape already: optional
  fields made the Anthropic grammar "too complex"). The model fills unused fields with `""` or `[]`
  and the route strips them in `stripEmptyFields`. Do not "clean this up" by making fields optional.
  Strict mode also has no `minItems`, so the slide count is still enforced client-side.
- **Prompt size is a cost and latency budget.** The catalog is compiled into the system prompt on
  every call. Keep new catalog lines to one tight line.
- Three modes share the route: `generate`, `add` (returns new slides plus `insertAfter` plus
  refreshed agenda bullets), `regenerate` (one slide). A fourth, `relayout`, lived for a day (23
  Sep 2026): the switcher asked the model to write the slide in four other layouts, a deck's worth
  of tokens per opening. The switcher is model-free now, see "The layout switcher" below.
- **The subject comes from the brief and the material, never from the tool.** The system prompt
  introduces the planner as a tool used by UNICEF and Giga teams, not as Giga's voice; Giga's own
  figures are allowed only in a deck the brief makes about Giga; the partner roster is used only
  when the brief names partners; the lockup sentence in the user turn says it sets logo and
  colours, not subject; `attachmentsNote` says the deck is about the material, with the brief
  first on everything it states (length, angle, which organisations to feature). Mario's rule,
  22 Sep 2026: the input is the union of prompt and attachment, the prompt in priority; UNICEF
  enters the content only if the prompt names it. The closing slide's fallback contact and social
  row follow the lockup (`channelsFor` in `schema.ts`): Giga's handles only under the Giga lockup.
  `tools/qa-generate.py` scores a generated deck against its source (drift, coverage, count):
  run it after touching the prompt.
- Errors are translated to plain language for the user, including the overloaded case. Keep that
  behavior when touching the route.
- **The slide count comes from the brief.** `countFromBrief` in `app/page.tsx` reads "20-page",
  "in 6 slides", "Six slides", "10 diapositive" (digits or number words, English and Italian, from
  two up to `MAX_SLIDES`, forty since 28 Sep 2026, when a 38-slide investment case had to be
  rebuilt with all its text) and sends it as `count`; one is never a count, "uno slide deck per UNICEF"
  read as one slide gave a cover and a closing slide and nothing else (23 Sep 2026); the user turn then demands exactly that many and the route
  sizes `max_tokens` to it (650 tokens a slide, all thirteen fields are required). A count
  followed by per / each / ogni ("one slide per objective") is a structure, not a length, and is
  passed over, and `seriesFromBrief` sends `perItem: true` instead: the user turn then reads the
  count as the number of items ("Six slides, one per objective" is six content slides, cover and
  closing on top), the route budgets two more, and the top-up in `onGenerate` aims at count + 2.
  This is flat on purpose: as a conditional in the prompt ("unless the items need more") Haiku
  obeyed "exactly 6" one time in two and dropped two objectives. No number in the brief means the
  model chooses (8-14). When the model still hits
  `max_tokens` the route says `truncated` and the client shows an error naming how many slides
  arrived, instead of a silently shorter deck. That silent short deck (12 for "20-page") is what
  happened on 22 Sep 2026: the count stayed prose, the prompt offered 8-14, and 400 tokens a slide
  was not enough. Later the same day "Six slides" went unread because it was a word, and the
  model chose fourteen.
- **The brief's structure comes first.** When the brief prescribes one slide per item, the titles,
  or what goes on each slide, the system prompt tells the model to follow it to the letter: every
  item gets its slide, titles are copied as written, and every slide of the series takes a layout
  that holds all its sub-points. The variety rules ("never the same layout three times in a row",
  alternate surfaces) still apply to the series: one layout repeated across it happens only when
  the brief says "same layout" (Mario, 23 Sep 2026, after an evening with a uniform series that
  read as flat). Items are never dropped, merged or renumbered; if no layout holds them all, the
  model picks the one that holds the most. Before this rule (22 Sep 2026) an OKR brief with six objectives came back
  with a different layout per objective, three-word titles and two KRs silently gone. Dates are on
  the never-invent list too: the same deck got a "2024" subtitle from nowhere. **`list` is the layout
  for this**: drawn 23 Sep 2026 from the callout's row system (template 03) without the photo,
  full width, 1-6 rows, label in the accent beside the point, a hairline under each row; body
  budgets are whole BODY30 lines per row count (5-6 rows → 2 lines, 4 → 3, fewer → 4) and the
  padding grows as the count drops, so every count ends inside the zone and the type never
  shrinks at the catalog limit. Before it, the widest layout was `four-cards` (4 x 16 words) and
  a six-KR objective lost two KRs or spilled onto a "continued" slide. **The rhythm of a series is decided in the client, not by the model.** Six runs with rhythm
  rules in the prompt (soft and hard, 22-23 Sep 2026) gave six identical slides four times, and
  the one time the model varied on request it merged KRs into "KR1–KR2" blocks. So `makeRhythm` in
  `lib/slides/rhythm.ts` runs on every incoming slide of a prescribed series (`rhythm: perItem` in
  `onGenerate`, generate and top-up): a blocks-family slide that repeats the previous content
  slide's layout, does not hold all its points, or is a `list` under five points (mostly white
  space) moves to another layout of its point count. Only layouts whose body budget holds text
  written for `list` (30 words a point) are used, so nothing shrinks: 1-2 points alternate the two
  example-image layouts, 3 points four-cards and three-columns, 4 points four-cards and list, 5-6
  points list only. icon-cards, steps and callout are not automatic alternatives (about fifteen
  words a body at four columns). The text is never touched, and a uniform series still needs
  "same layout" in the brief only for the model; the pass runs regardless. `stripInventedYear`,
  same file, same place: a year in the cover's subtitle that the brief never gave is the model's
  ("2024", three times with the rule against it), and the subtitle goes.

## Attachments to the brief

The prompt box takes reference files (PDF, Word, PowerPoint, Excel, text, images) via "Attach files"
or a drop on the box. They exist to give the model the facts; they are **not** deck content.

- **Session state only.** `attachments` lives in `app/page.tsx` state and travels in the
  `generate` and `add` request bodies. It is never written to deck state, the deck file or
  localStorage: a single PDF would blow the quota that photos already strain. Reloading the page
  drops them, by design.
- **What the model receives** (`buildUserContent` in `lib/slides/prompt.ts`): PDFs as native
  `document` blocks, images as `image` blocks, everything else as text. Word and PowerPoint are
  reduced to text **in the browser** (`lib/slides/attachments.ts`, jszip over the OOXML parts,
  speaker notes included) so the request stays small and readable. A closing note in the user
  turn tells the model the brief wins on any conflict and that numbers must be quoted as written.
- **Limits, enforced twice.** Client side in `onAttach` for the UX, server side in
  `lib/slides/attachments-server.ts` as the guarantee: 6 files, 4 MB of body in total (Vercel's
  request ceiling is 4.5 MB; base64 grows a file by a third, so the user is told 3 MB of files),
  60k characters of text per file and 120k across files. **A PDF that would not fit is not
  dropped**: `readPdfAsText` (pdf.js in the browser) sends its text instead, the chip says "text
  only", and only a PDF with no text layer is refused. A refusal is a red box under the composer
  and blocks Generate until the file is removed: before 22 Sep 2026 it was a quiet line, a 3.2 MB
  study was silently dropped, and the model wrote a UNICEF deck from a two-word brief. A brief may
  be empty when files are attached; the route substitutes "Build it from the attached material."
- **Links in the brief are fetched on the server** (`lib/slides/links-server.ts`, called from the
  route for generate and add): `extractUrls` in `lib/slides/links.ts` takes the first three
  http(s) URLs, the page is fetched with an 8 s timeout, private hosts refused, HTML stripped to
  text; a page that yields under 80 characters (built by JavaScript) is fetched again through
  Jina Reader (`r.jina.ai`, 20 s timeout), which renders it and returns the readable text; the
  result is capped like a text attachment, then appended to `attachments` as a text item named by
  its URL (`buildUserContent` labels it "Linked page"). A failed fetch is skipped, never an
  error. The composer draws links in Giga Blue through a mirror div under the textarea
  (`splitLinks`), so the user sees the link was recognised.
- **A spreadsheet is a text attachment with the questions it raises** (25 Sep 2026, rewritten
  the same afternoon: one fixed question was not enough, Mario wants the questions to come from
  the document). On attach, `analyzeSheet` in `app/page.tsx` posts the sheet text to
  `app/api/analyze` (same model, reasoning off, first 12k characters, strict schema in
  `lib/slides/sheet-questions.ts`): back come a summary and up to five questions, single, multi
  or text, whose options are quoted from the file (a sheet name, a header, a row, a period). The
  contract with the model is in `SHEET_ANALYSIS_INSTRUCTIONS`: ask only what the data cannot
  settle and that changes the slides, never slide count, colours or layouts, never "Other".
  `normalizeAnalysis` drops what does not fit, and turns a single-choice question about what to
  show, present or include into a multi-choice one unless it asks for the one main thing (Mario, 28
  Sep 2026: "both scenarios" had no way in); the wizard says "Choose one or more" on those. A
  client-written question may carry `details`, one line under each short option (the file-use
  question: Replicate, Reinterpret, Use as a source). **The questions are asked when Generate is pressed,
  not when the file lands** (Mario, 25 Sep 2026, later the same day: the model must read each file
  next to the whole brief). `onGenerate` in `app/page.tsx` builds a queue of subjects still to ask
  (readable attachments without `asked`, plus `"brief"` when there is no file and the brief is under
  `SHORT_BRIEF_WORDS`, plus `"length"` last when `countFromBrief` finds no count, the piece is not a
  two-pager, no attached deck is set to Replicate and the brief is not a series (`seriesFromBrief`,
  "one slide per objective": its list sets the length, and a picked count would read as items)), starts their analyses and opens
  `components/SheetWizard.tsx` on the first. `"length"` (Mario, 1 Oct 2026: most briefs name no
  length) is a fixed question, `lengthAnalysis` in `sheet-questions.ts`: 5, 8, 10, 12 or 15 slides,
  or "Let the builder decide"; `lengthOf` turns the answer into the `count` `runGenerate` sends when
  the brief names none (Skip and "decide" send none, as before). Its answers are keyed to the
  brief's text (`lengthQ`), so a changed brief is asked again, and it drops out of the queue if the
  file question just before it was answered Replicate;
  `advanceWizard` marks the subject `asked`, moves to the next, and after the last runs
  `runGenerate` (the old generate handler). A subject that comes back with no questions is passed
  over by an effect; X or Esc stops with nothing generated, answers kept, and the next press goes
  straight to the deck because everything is `asked`. The primary button on the last question says
  "Generate" (or "Next file" with more to ask). Every answer is saved as it is given (`answers`)
  and compiled into `insights` (`compileInsights`); the brief's own answers travel as `briefNotes`
  in the request (capped in the route, printed under the brief in the user turn). The row under
  the chip (`components/SheetInsights.tsx`, "2 of 5 answered · Edit") appears only once a file was
  asked and had questions, and reopens the wizard without generating. A failed analysis is a red
  box with Try again or Continue without. `analysis`, `answers`, `analysisError` and `asked` are
  editor fields on the attachment; the route still reads only `insights`.
  `.omc/analyze-check.mts <file.xlsx>` prints the questions a workbook gets.
- **Every readable file is read for questions, not only spreadsheets** (Mario, 25 Sep 2026: "launch
  it for any document when the situation is not clear to you"). PDF (as `input_file`, under 2.8 MB
  of base64), Word, PowerPoint and text go to the same route with `kind: "document"` and the brief
  as pressed; a short brief with no file goes with `kind: "brief"` and `BRIEF_ANALYSIS_INSTRUCTIONS`
  (subject, audience, angle, period, options the model proposes since there is nothing to quote); `DOCUMENT_ANALYSIS_INSTRUCTIONS` asks only where the material could become
  two different decks and neither it nor the brief settles it (several projects or countries in
  one file, a report the deck could follow in part, two scenarios, a term the slides would have
  to explain), and says an empty list is the right answer otherwise. A clear document leaves the
  composer as it was: no row, no dialog, and a failed analysis is swallowed for documents (the file
  still travels whole) while a spreadsheet shows the red box. The answers travel as `insights` on any pdf or text attachment
  (`Questioned` in `attachments.ts`, `insightsOf` on the server), printed under the file in the
  user turn ("About this file, from the user: …"), and `attachmentsNote` says those answers rank
  with the brief. Measured on the Mexico DQR PDF and two long briefs: zero questions, as intended;
  `.omc/analyze-doc-check.mts <file> [brief]` shows what a file gets. The file itself: `extractXlsx` in
  `lib/slides/attachments.ts` reads the workbook in the browser with jszip (sheet list and
  relationships, shared strings, `styles.xml` so a date cell reads `2025-03-01` and a percentage
  `49%` instead of their serial numbers, hidden sheets skipped, blank rows dropped, `MAX_SHEET_ROWS`
  a sheet cut by whole rows with a note, a `|` in a cell turned into `/`) and lays each sheet out as
  a pipe table headed by its name. The attachment is `kind: "text"` with `spreadsheet: true`, so
  the server contract did not change; the chip shows a sheet glyph. `insights` (session state,
  capped at `MAX_INSIGHTS_CHARS`, re-capped in `attachments-server.ts`, only kept on a spreadsheet)
  is printed by the user turn under the table, and `attachmentsNote` adds `SPREADSHEET_NOTE` (data, not prose;
  a comparison is a chart-bars, a share a donut, a headline figure a stat slide; cell values as
  written) whenever a spreadsheet is attached. The model fills `bars[]` from the table itself
  (Mario's call, 25 Sep 2026, over building the chart client-side). `.xls` is refused with a message
  to save as `.xlsx`; CSV was already text. `.omc/attach-test.mts xlsx <file>` prints what the model
  would see.
- **`regenerate` does not carry attachments.** It already gets the brief and the slide; re-sending
  a PDF for every single-slide rewrite would multiply the cost for little gain.
- The composer is `components/PromptBox.tsx`: it owns the textarea, the hidden file input behind
  the "+" button, the drop target, the Chapters pill and the Generate button. `AttachmentsRow` only
  renders the chips (`bg-giga-tint`, `text-giga`, inline SVG glyphs). The outer node keeps
  `data-tour="prompt"`, and the pill and the button carry `data-tour="chapters"` and
  `data-tour="generate"`, which the help-video recorder uses as selectors.

## What the pipeline decides without the model

Haiku does a constrained job well and a rule-following job badly: the QA suite (23 Sep 2026)
found the same slips in run after run with the rule in the prompt. Each got a deterministic
guard, all pure functions, none touching the user's words:

- **`lib/slides/brief.ts`** reads the brief before the model does: `countFromBrief` (digits or
  number words from two to forty in English and Italian, slide words in five languages, a count
  followed by per / each / ogni skipped, one is never a count), `seriesFromBrief` ("one slide
  per …"), `uniformFromBrief` ("same layout"), `languageOf` (stopword counts; the user turn then
  says "write every slide in Italian", because the same-language rule alone was ignored on short
  Italian briefs), `TIERS_REQUEST`, `MIN_SLIDES_WITH_CHAPTERS`.
- **`lib/slides/rhythm.ts`**, one pass per incoming slide in `runGeneration`: layouts alternate
  (no two alike in a prescribed series, at most two elsewhere; when the brief says "same layout"
  the first blocks-family layout is imposed on every later one that fits, since Luna still varied
  one slide in eight, 25 Sep 2026); a list under five points, a stat whose value has no digit ("Ericsson" as a two-stats
  value), a big-stat with no figure (a statement with the number left empty, four decks in
  twenty) and a timeline with one point (four one-phase timelines for four quarters) each become
  the layout that fits their words; nothing lands after the closing slide (three empty covers
  after "Thanks"); a named count caps the deck, the closing slide always through; a year the
  brief never gave leaves the cover's subtitle; a section-image slide with no body (a title beside
  a photo, Luna's first slip, 25 Sep 2026) takes a stray `support`/`subtitle` as its body or is
  dropped, never counted against the cap; a chart whose every (label, figure) pair is already on
  the previous chart is dropped too (Luna drew a three-line trend and then one line per series
  from the same table, 25 Sep 2026); a series chart whose series are the categories themselves
  (one figure per bar, no series used twice) becomes chart-bars or chart-columns-wide, since it is
  one distribution wearing a legend; a slide that says what an earlier one said (same title, same
  block labels or stat values) is dropped as a repeat; a section divider starts a new run, so
  parallel chapters in one layout are structure. `normalizeSlide` drops a slide with no text at
  all and strips blocks, stats and bullets from a chart slide.
- **Once the deck is complete** (`runGenerate` after the top-up, and the suite): `mergeContinuations`
  folds two consecutive blocks-family slides with one title into one (Objective 1 with KR1-3 and
  again with KR5-6, 26 Sep 2026); `unifyLayouts` under "same layout" gives every blocks-family
  slide the one layout that holds the longest of them (list past four points), which the streaming
  pass could not know; `ENSURE_CLOSING` appends the default closing slide when the model left it
  out (a numbers deck of eight stats ended on a stat). A topped-up slide whose title the deck
  already has is dropped as a repeat. The route budgets 800 tokens a slide, up to 36k for a forty-slide deck, and runs for up to 300 s (`maxDuration`; thirty slides from the Gambia pptx took 26 s) (a fifteen-slide deck
  with chapters from a long report was truncated at 650), and a named count under twelve with
  chapters on asks for at most two chapters.
- **Icons are the model's, from a curated list** (Mario, 26 Sep 2026, after a globe on "Award"):
  `lib/slides/icon-set.ts` holds about 150 Lucide names grouped by what the decks talk about,
  listed once in the system prompt (about 500 tokens); `icons` is in the output schema (one per
  block on icon-cards, [] elsewhere). `normalizeSlide` keeps only names from that list, no
  repeats, and only on icon-cards; a bad entry falls back to the old rotation. A pick in the
  editor sets `iconsPinned`, and a regenerate keeps pinned icons, otherwise the rewrite brings
  icons for its own words. The picker still offers the whole library. The suite prints the
  label=icon pairs and fails on a repeated icon.
- **Progress stages are one box each** (`STAGE_H` in `layouts/progress.ts`): the delete frame and its
  ✕ cover the whole stage, and in the editor the node is a control (`.set-node-live`, added by
  SlideFrame, never exported): hover on a stage lifts its node with an accent halo, Enter or Space
  sets it from the keyboard.
- **The timeline is drawn on the progress slide's grammar** (Mario, 27 Sep 2026: the template's
  gradient band with labels alternating above and below read as scattered). `timeline` in
  `layouts/progress.ts` shares `stagesSlide` with `progress`: same title, grey track, columns and
  type; every node a solid 28px accent dot, the date above the track in the accent (bottom-aligned to it), the text below, no
  status line and no click. 2-6 points, body 12 words up to four, 8 with five or six.
- **The cover and the closing slide carry an aura**: the Unicorn Studio scene Mario chose (27 Sep
  2026), running on its own runtime, recoloured and vendored in `public/aura` (runtime 155 KB,
  `cover.json`, `closing.json`, excluded from lint; `includeLogo` is off, no network). Cover: white
  with UNICEF cyan waves (a wide cyan band and a light-cyan sphere: the first, paler version
  barely showed, Mario, 27 Sep 2026), time halved; closing: the cyan surface with waves a touch lighter (the
  overlay circle is mid grey: a white overlay on cyan turned it turquoise). Slides render a still
  of each scene (`/aura/<kind>.jpg`, `aura()` in `layouts/shared.ts`), which is what thumbnails,
  PDF and PPTX show. `mountAura` (`lib/slides/aura-live.ts`) mounts the live scene over the still
  on the editing stage only; the HTML file inlines the runtime and the scenes as JSON script tags
  (the runtime's `filePath` takes an element id) and mounts the scene on the slide on screen,
  destroying it when it leaves. A CSS rule makes the canvas fill its slide, because the runtime
  sizes it from the stage's scaled box. Reduced motion keeps the still. To change the colours,
  edit the `getColor` cases in the scene's first shader and the two circle fills, then recapture
  the still.
- **No photo slot is ever empty, and the AI placeholder is gone** (Mario, 27 Sep 2026: the model
  left 56 of 69 photo slots empty, and `/giga-placeholder.jpg` is AI-generated). `fillPhotos` in
  `library.ts` gives every empty slot a children photo (`CHILDREN_PHOTOS`) the deck does not use
  yet, cycling only when all are taken: after generation (`MERGE_CONTINUATIONS`), on a manual
  insert and when a deck is opened (`HYDRATE`). Renderers fall back to `DEFAULT_PHOTO`, a children
  photo, wherever an image is missing.
- **Library photos are the model's to place** (27 Sep 2026): each entry in `lib/slides/library.ts`
  carries a description written from the picture and the slides it suits; the system prompt lists
  them once, the output schema has `photo` (a library id or ""), and `normalizeSlide` turns a valid
  id into `image` only on a layout with a photo slot (`PHOTO_LAYOUTS`) and only when the slot is
  empty. The rhythm pass puts a repeated photo back to the placeholder. The two buildings are the
  Giga Technology Center in Barcelona (Ca l'Alier) and in Geneva (Campus Biotech), for a slide
  about that office only. A rewrite keeps a photo already on the slide and may fill an empty slot.
- **Content QA** (`tools/qa-content.ts`, 27 Sep 2026): gpt-6-sol with reasoning judges each deck of
  a suite run next to its brief and material on Mario's priorities, fidelity first: fidelity,
  selection (which text is shown), arrangement (text where its shape fits), consistency across
  parallel slides, no repetition, numbers with units and dates. About $0.26 for 23 decks;
  `npx tsx --env-file=.env.local tools/qa-content.ts .omc/qa/<run>`. Titles-as-claims was tried and
  dropped: it pushes the model to reinterpret the source, which Mario does not want. Measured on 23
  use cases: 3.17 before, 3.24 after the rules below, within the noise of one run; the
  deterministic passes are what reliably moved: `fixLonelyGrid` (one card on a grid layout goes
  to text and photo), `sortRanking` (horizontal bars sorted), and `finishDeck` after the top-up (a
  stat slide whose every figure an earlier one showed is dropped; an agenda with no chapters goes).
- **Known limit, not guarded**: a PDF with no text layer (a scanned or rendered page) is read by
  the model as an image, and a digit can come back wrong (3,323 rejected schools read as 3,523,
  twice, 26 Sep 2026). The prompt says digit by digit; the fix is a PDF with a text layer.
- **`lib/slides/voice.ts`**, in the route on every string the model wrote: the banned words
  (leveraging, synergies, cutting-edge, revolutionary, empower, unlock) become plain ones, forms
  preserved, unless the brief itself uses the word. Never in a replica: those are the source's words.
- **Top-up**: a counted deck that arrives short gets up to two add requests for the missing
  slides (one came back empty once in twenty).

Left to the model, and it still slips about once in twenty: Giga's own figures in a deck that
never named Giga, a year in a body ("by 2030"), a KR renumbered, the lockup's name as a title.

## Replicating a deck

"Replicate it in a more beautiful way, all text are important" with the 38-slide Gambia pptx
attached came back as 11 slides (28 Sep 2026): no count in the brief, one call for the whole
deck, a flat text in file order. Now:

- **A PowerPoint file is read as a deck** (`lib/slides/pptx-source.ts`, `readPptx`): slides in
  presentation order (`sldIdLst`), hidden ones skipped, the heading found by type size when there
  is no title placeholder, shapes in reading order (wide shapes by their top, narrow ones column by
  column, so a column header stays with its points), levels relative to the shape ("- " for a
  sub-point), tables as pipe rows, charts from their chart part, footnotes apart (a numbered line in
  small type or any sentence at 8pt or less, the shape's list style counting when runs set no
  size), and lines on more than a quarter of the slides dropped as boilerplate (agenda slides left
  out of that count). **Hand-drawn chart labels win over chart data**: the Gambia deck writes 3.10,
  6.12, 11.65, 21.59 over a series whose data says otherwise, so the numbers drawn as text are
  grouped by the axis label they stand over ("28: 3.10, 0.44 | 29: …", the axis being the row with
  the most period labels) and the prompt says they win. Each slide gets a kind: cover (the first),
  agenda (named so, or repeating an earlier agenda; the chapter in progress is the bullet whose
  colour no other bullet shares), divider (a title and little else), closing, content.
  `extractPptx` is this reader's text, so "use as a source" reads the file better too. Shapes in
  a group are placed through the group's transform (`shapesOf`: Gambia 15 draws each scenario as
  a group, and in group coordinates the two scenarios' notes read as one interleaved column). A
  legend drawn as text boxes (small single lines stacked under a chart, inside its width) is
  "Chart legend: a | b | c" after the chart's data, not footnotes. Every slide keeps `boxes`:
  each text box and chart with its place in slide fractions, what the rebuild reads the source's
  structure from (29 Sep 2026).
- **A PDF is read the same way, page by page** (`lib/slides/pdf-source.ts`, 28 Sep 2026): pdf.js
  runs become lines, lines become paragraphs (a point opens at a bullet glyph, often a control or
  private-use character, a size change or a gap; a word broken at a hyphen is mended), a number
  alone is a chart label with its position, the footer's site and page number are dropped, and the
  shared `classify` (in `pptx-source.ts`) does the rest. A PDF has no colours to read, so an agenda
  repeated before each chapter opens the chapters in order. The Gambia PDF replicates to the same 36
  slides as its pptx.
- **A PDF with no text layer is asked too, and transcribed on Replicate** (28 Sep 2026: text turned
  into outlines on export from Figma or Illustrator, or a scan; the Mexico DQR in English and
  Spanish read 0 pages and the question never showed). `onAttach` keeps its page count
  (`pageCount`, from `readPdfSlides`, capped at 80) where it would have kept slides; `isDeckSource`
  in `attachments.ts` is the one test for "ask what to do with this file", a pptx or any PDF. The
  question names its pages. Reinterpret and Use as a source send the file whole as a document, as
  before. Replicate, only when chosen and Generate pressed, runs `transcribeThenReplicate` in
  `app/page.tsx` under the generating state: `app/api/transcribe` sends the PDF as the same
  `input_file` block `/api/analyze` uses (gpt-6-luna, reasoning off, strict schema, at most
  `MAX_TRANSCRIBED_PAGES`, `MAX_SLIDES` minus cover and closing) and gets back `{ title, subtitle,
  pages: [{ n, title, lines, footnotes }] }`; `slidesFromTranscript` in `lib/slides/transcribe.ts`
  runs the pages through `classify` into the same `SourceSlide`s, so `planReplica` and
  `runReplicate` are unchanged. A first page past 40 words is content (a report opens on its
  figures), and the cover is built from the document's title. The pages are kept on the
  attachment, so a second press does not transcribe again. A failed transcription generates the
  deck with the file as a source and says so in the sidebar's red box. The digits come from the
  page image, so the known limit below applies (3,323 read as 3,523 on the Mexico DQR again).
- **The wizard asks what to do with it**, first, for every pptx and every PDF (`fileUseQuestion` in
  `sheet-questions.ts`, prepended by the client to the model's own questions, never empty so the
  file is always asked): replicate, reinterpret (one line in the file's insights), or use as a
  source. Reinterpret comes first and is preselected (Mario, 28 Sep 2026), then Replicate, then
  Use as a source; `preselectFileUse` writes the preselected answer and its insight the moment the
  question is added, so a skip or a close means Reinterpret. The question does not wait on the
  model's analysis: `analyzeAttachment` puts it up the moment the wizard opens and the model's own
  questions join it when they land (a slow analysis once left only "Skip the questions", which
  skipped this one too). Generate is disabled while a file is still being read, or a press would
  run without it. Until that choice is made, every Generate press opens the
  wizard on it, even for a file whose other questions were answered (`undecidedDeck` in
  `onGenerate`; a file read before the choice existed gets it in front of its questions). The row
  under the chip says "Replicate · 36 slides".
- **Replicate is planned by the client** (`planReplica` in `lib/slides/replicate.ts`): the cover
  and every content slide in order, one agenda from the source's, a divider for each chapter the
  source's agendas mark as current and for each source divider, a chapter never opened twice (the
  appendix repeats the agenda), the source's mid-deck "Thank you" moved to the end. The source
  decides the chapters whatever the Chapters toggle says (Mario's call). Nothing with text is left
  out of the plan (29 Sep 2026): a divider with a strapline is the divider and then a content slide
  with its text; a closing slide with more than its "Thank you" (a contact line) is a content slide
  before the deck's own closing slide. Ceiling `MAX_SLIDES`, which only removes fixed slides
  (dividers, the agenda): content never goes, so a source with more content slides than the
  ceiling replicates past it, and continuation slides (below) may take a replica past 40. Nothing
  technical caps a deck at 40: the deck file takes 200, the exports and thumbnails have no limit.
  The one real cap is the transcription of a text-less PDF (`MAX_TRANSCRIBED_PAGES`, 38 pages).
- **One call per slide** (`runReplicate` in `app/page.tsx`, mode `replicate` in the route):
  only that slide's text, its place ("slide 12 of 36, in the chapter …"), `REPLICATE_NOTE` in
  `prompt.ts` (title as written, every point and figure, dense layouts, notes, the source's
  language, never a structural layout), 3,000 tokens, six calls at a time, landing in order as
  the prefix completes. The count and the order are the plan's by construction. No rhythm pass, no
  merge, no finish pass: the slides are the source's one to one; `FILL_PHOTOS` and
  `ENSURE_CLOSING` only. A slide the model fails twice is rebuilt from the source by the app
  (below): a rate limit hit mid-replica (two replicas back to back reach 200K tokens a minute)
  costs design, never text. The Gambia deck: 36 slides, about 35 s with the repair pass,
  about $0.04.
- **Replicate does not change the content** (Mario, 28 Sep 2026). In replicate mode only, and
  nowhere else: the route skips `cleanVoice` (it turned the source's own "synergies" into "shared
  gains", "leverage" into "use"); the source reaches the model whole up to 40,000 characters
  (`REPLICATE_SOURCE_CHARS`, 12,000 before); the title is never shortened; a chart with an
  explanation is made dense before `normalizeSlide` (`denseBeforeNormalize`), which would delete
  its `bullets` on a standard chart; an answer with more items than its layout draws (`overLimits`
  in `schema.ts`: `ARRAY_LIMITS`, ten points or five figures a dense block) is asked again once with
  the count, and what the second answer still cuts the app restores (below); a first slide
  past 40 words (a report opening on its figures, the Mexico DQR) is the cover with its title and a
  content slide with everything (`planReplica`). `normalizeSlide` itself is unchanged.
- **The fidelity check** (`lib/slides/fidelity.ts`, pure functions, `npx tsx tools/fidelity-test.ts`):
  each source slide against the slide made from it, `steps[i]` against `results[i]`, never the
  whole deck (a deck-wide substring test finds "2026" somewhere and calls every 2026 kept).
  `sourceUnits` reads `SourceSlide.text`: lines (title, points, sub-points, footnotes, table cells
  with a letter; `entries` are the same lines with their kind and level, for the restore), the
  charts (`charts`: the labelled columns, an axis label seen again opening the second chart, or the
  series data), figures (two digits or more, or a percentage; the chart labels written on the
  slide; the series values only when the slide has no labels, since the labels win), speaker notes
  left out, and a running header (`runningLines`: a short line on three slides or more) not
  measured. `compareSlide` normalises case, punctuation, the typographic minus, thousands
  separators, "76 %" and a footnote marker glued to a word; a figure must appear as written or,
  on a chart, as a bar of the same value (3.10 is the bar 3.1; "240K" is not 240,000); each line is
  aligned word by word against the slide's text (a fitting LCS: the slide's ends free, a gap inside
  costs) and is identical, touched (85% or more), changed (50%) or missing; "added" is a run of
  words the source never writes (bar values aside). `compareSlide` also takes a slide and its
  continuations (the repeated title not measured). `planLeftovers` lists what the plan itself
  does not carry: agenda lines no chapter carries (a chapter renamed on another agenda is
  "renamed", below) and, should the plan ever drop them again, slides past the ceiling, a
  divider's strapline, the closing slide's extra lines.
- **The repair pass**: a content slide with a wrong figure, a changed or missing line or added
  text gets one more call with `repairNote` (the lines to write exactly, the figures, the text to
  remove, quoted) and its first answer; the one with the higher `fidelityScore` stays. Same six
  workers. Gambia through the app: first pass 313 of 336 figures and 93% of the words, after the
  repair 328 of 336 and 97% (17 slides asked again, 14 closer); the Mexico DQR PDF 88% to 91% of
  the words, all 59 figures; the text-less Mexico DQR_EN 99%, all 59 figures of the transcript.
- **The app's guarantee** (`lib/slides/restore.ts`, Mario 29 Sep 2026: "if I click Replicate, 100%
  of the text must be present"; the product owner had seen 20 lines missing on Gambia after the
  repair pass). After the repair call, `runReplicate` compares the slide again and restores what
  the model still changed, deterministically, without another call. Three layers, in order:
  1. **Put back** (`putBack`): every missing, changed or reworded line goes in verbatim. A changed
     line replaces, in place, the stretch `compareSlide` matched it to, only when that makes it
     whole and breaks no other line ("School Connectivity" also sits inside a longer line). A
     missing line goes after the point that precedes it in the source (first under the header
     that precedes it), else before the point that follows it; when those neighbours are on the
     slide but their list is full the slide is rebuilt (never at the end of an unrelated block),
     and only a line whose neighbours are all missing opens a new block; "- " stays; a footnote goes to `notes`; the title is the source's.
     A wrong chart value is set on its bar (`fixBars`, when the slide's chart has the source's
     columns); a figure with no bar to hold it is written as one point the way the source writes
     it ("27: -1.37, -8.91, -9.76; 28: …"). The Element menu's own functions in `modular.ts`
     (`addPointAt`, `pointLists`) insert, so the ten-point limit holds and the slide stays
     editable; a layout with a high-density variant goes dense.
  2. **Rebuild** (`rebuildFromBoxes`, then `rebuild`): when the put-back slide does not hold it
     all (no room, over its limits, or `readable` in `fit-check.ts` finds a text under 18px or
     clipped), the slide is built from the source alone. A PowerPoint source is rebuilt from its
     structure first (the product owner, 29 Sep 2026: the line-order rebuild read as a dump):
     a grid (a row of three to five header boxes over a row of value boxes in the same columns,
     a label box to their left, a caption between) is a `matrix`, the label as the row, each cell
     header and value, the caption as the band, and when the heading was read as the first row's
     label, the line over everything is the title (Gambia 10: "School & Health Connectivity",
     rows School and Health, five effects each, then Scope and Why on a continuation); each chart
     is a `chart-text` slide with the boxes in its column (the scenario heading over it as the
     heading, its notes as the explanation), the second chart on the continuation titled "(cont.)"
     (Gambia 15: 2 km, then 20 km); the series take the legend's names, matched to the labels'
     top-to-bottom order by the data's ranking of the last values, and a legend too long for its
     two rows goes by the words that set each series apart ("health facilities") with the full
     names as the chart's numbered notes; a column only partly labelled (two of three labels over
     2031) is not drawn with an invented value but written out, and a chart whose complete
     columns do not cover most of its axis stays text; the rest is columns as the source sets
     them, a full-width line opening a section (its band when it is up to 60 words), a one-line
     header box joined to the box under it, a header with its points as the column's label, more
     than three columns merged neighbour to neighbour. This is kept only when the comparison finds
     every line and figure; else, and for a PDF, the lines in order: `bullet-columns` with the lines in source order, one to three
     columns, a column opening on a header when it starts with one (a short line with no full stop
     and no figure), sub-points kept, footnotes to `notes` up to 36 words (as points past that);
     `chart-text` when the source draws a chart the renderer can draw (2-12 columns, 1-3 values
     each, every column complete), its explanation the lines; `figures-panel` when the slide is
     mostly figures written apart from the text. A second chart is drawn on the continuation, or
     written out as a point.
  3. **Continue**: when even that does not hold at 18px, the source is split in order (a cut
     before a header when one is near, never before a sub-point) over two slides or more, titled
     "<title> (cont.)" or the source's own convention (`continuationLabel`); they land right after.
  A slide the model got whole is kept as it is unless its text clips (out of sight is not on the
  slide). Words the model invented are removed only as whole points, blocks, headers, bands or
  headings that no source line needs (`trimAdded`: a removal is kept only when every line and
  figure stays); after a put-back, a point that only repeats what is now there goes too; never
  the title. `readable` renders the slide offscreen with the real autofit; `estimateFits` stands in
  for it in node (the tests, `qa-suite.ts`). The cover (`restoreCover`) takes the source's other
  lines in its subtitle ("Investment Case · September 2026"), and past 18 words a content slide
  after it. Gambia through the app after the design pass (29 Sep 2026, five runs on the final
  code path): 336 / 336 figures and every line each time (the independent check in agreement;
  two runs kept one or two invented header words the trim now also removes, or cannot on a
  standard `list`),
  the model alone at 332-336 figures and 97-99% of the words; 0-3 lines put back, 6-8 slides
  rebuilt from the structure, 6-7 continuation slides, 42-43 slides in all. Every restored slide
  measures 18px or more with nothing clipped.
- **Chapter names worded differently** (`reason: "renamed"` in `planLeftovers`): an agenda line at
  the place of a chapter the deck carries, on an agenda of the same length ("The Learning and
  Digital Access Challenge" on one Gambia agenda, "The Challenge" on the others), is the same
  chapter. The deck names each chapter once, as the agenda that opens it does (`syncAgenda` keeps
  the agenda and the dividers one to one), so the other wording is listed in the review, not
  counted missing.
- **The report** (`components/FidelityReport.tsx` inside `GenerationReadout`, `fidelity` session
  state in `page.tsx` like `chaptersSkipped`, cleared by the next generation and by opening a deck,
  never saved): the card shows one percentage, the weaker of figures exact and words kept (100
  only when nothing changed, nothing is missing and every slide was rebuilt; rounded down, so a
  partial never reads 100), and a "Review" button. The review is short: a bullet summary (content slides of the source
  and the slides they became, slides split over more slides, slides the app rebuilt in a simpler
  layout, figures exact and words kept, slides not in the deck), then one row per source slide
  that changed: where it went ("Slides 9–10"), its layout label (`LAYOUTS[id].label`), what
  happened, a "Lines" toggle with the source and deck lines side by side, and Go to slide (the
  slide's place when it landed, or its title if the deck moved since). "Show all N slides" adds
  the word-for-word ones. A transcribed PDF says in the review that the figures need checking,
  since the comparison is with the transcript, not the file. The suite's `use: "replicate"` case
  runs the same pass headless and prints the report before and after the repair; the old deck-wide
  figure count is printed beside it for one release.
- **What the check does not see**: words the source has anywhere on the slide (a card label that
  repeats the title, a paragraph written twice, a short header whose words sit in another line)
  are not "added" and not "missing".
- **Known limits**: two charts on one source slide become one chart-text plus the second's figures
  in its points; which label belongs to which line is inferred from the top-to-bottom order. A
  rebuilt chart has no series names only when neither its data nor a legend on the slide gives
  them ("Series 1" is then the legend, not measured). A slide the model got whole is kept even when autofit takes its text under 18px
  (its footnotes can reach 9px); applying the floor there would rebuild more slides in the simpler
  design, a call for Mario. The figures-panel rebuild cannot pair a figure with its label (the
  source's text does not say which), so the figures stand in a column beside the lines.

## High density

Two kinds of decks come in: essential ones with little text, and report-style pptx at 150-250
words a slide. Every content layout (cards and columns, stats, charts, timeline and progress) has a
high-density variant, approved by Mario on 28 Sep 2026 from a design sheet: `density: "high"` on
the slide, rendered by `DENSE_RENDERERS` in `lib/slides/layouts/density.ts`, which `renderSlide`
picks over the layout's own renderer. Same fields, same geometry family, the dense layouts'
grammar: 60px title on up to two lines (`topOf`, width-aware), #F7F7F7 cards, Manrope 30px
headers in the accent, Open Sans 24px points in em under one `data-fit` per text group, the key
message band where a card layout has `support`. Stats take labels of about 30 words; charts move
right with the explanation card (`subtitle` + `bullets`, kept by `normalizeSlide` on dense charts)
on the left; timeline and progress run through `stagesSlide(…, dense)`.

- **Standard slides do not change.** A slide without `density` renders exactly as before;
  `.omc/markup-baseline.ts` fingerprints every layout's markup (both palettes, defaults and chart
  cases) and was identical before and after, the agenda aside (below).
- **`DENSITY_LAYOUTS` in `schema.ts` and `DENSE_RENDERERS` must list the same layouts**;
  `normalizeSlide` drops `density` elsewhere.
- **The picker has two tabs** (`components/ThumbStrip.tsx`): "Slides" (the template, without the
  six dense layouts) and "High density" (every variant, from `denseContent` in `defaults.ts`,
  plus the six dense layouts).
- **The model** has `density` in the output schema ("" or "high") and one DENSITY rule in the
  prompt. In a replica the density follows the content, not the source's length (Mario, 28 Sep
  2026: "replicate does not mean high density"): `withContentDensity` in `replicate.ts` sets
  "high" when the slide's text runs past its layout's standard word limits (`STANDARD_LIMITS`, the
  catalog's, plus a fifth), its blocks carry points or a chart carries an explanation, and removes
  it when the text fits the standard version, whatever the model set. Luna still prefers the five
  dense layouts for dense slides, which are dense by design. A rewrite keeps the slide's density.
  A source "divider" with a line of text that opens nothing (the last slide, or one before another
  divider) is replicated as a content slide, not dropped.
- **Negative values** on every chart but the donut (a share): `signedValue` and a sign-aware `fmt`
  (typographic minus) in `layouts/stats.ts`, `scaleOf` / `zeroLine` in `layouts/charts.ts`: the
  zero line moves up, is drawn darker, bars hang from it, horizontal bars run left of it, stacked
  columns stack negative parts down, and the axis reads max, 0, min. Written so that all-positive
  data takes the very same expressions (the fingerprints prove it). The Data panel accepts
  negatives everywhere but the donut, and says so. `normalizeSlide` turns a leading hyphen in a
  stat into "−".
- **The agenda shares one size** (Mario, 28 Sep 2026: long chapter titles shrank on their own,
  four sizes on one slide): one `data-fit` container, a long title wraps to a second line at the
  size of the others after its number, the list shrinks together only when it cannot fit.
- `.omc/density-preview.ts` renders the design sheet (every layout standard beside dense, the
  standard charts with negatives).

## Dense layouts and footnotes

Drawn 28 Sep 2026 for a 38-slide consulting-style investment case (the Gambia joint school and
health connectivity case), where a slide carries 150-250 words and every figure has to stay, and
approved by Mario the same day. `bullet-columns` (1-3 cards of points under a header, a key
message in an accent band), `figures-panel` (rows Outcome/Benefits/Costs, figures in the accent
beside a commentary, a takeaway band under them), `cascade` (groups of policies with arrows down
to objectives, converging on a goal band), `scenarios` (2-3 options on accent tiles, a conclusion panel), `matrix`
(1-3 rows of 2-5 cells) and `chart-text` (an explanation card, a line chart of 1-3 series with
negative values allowed, a numbered note per line). Same grammar as the rest, nothing new in
colour or type: 60px title on two lines, #F7F7F7 cards, accent labels and hairlines, the
chart's grid and series colours, and the closing slide's accent surface for the band.

- **Blocks carry `items` and `stats`.** A point is one string in `blocks[i].items` ("- " opens a
  sub-point, the dash stays in the text so an edit keeps the level); a figure or a matrix cell is
  `blocks[i].stats[j]` (`value`, `label`). Both are in the output schema on every block (required,
  like everything) and empty elsewhere; `normalizeSlide` caps ten points and five figures. A block
  added with Element has only `body`, which the renderers show as one point.
- **A text group shrinks as one.** Body text is Open Sans 500 at 24px, children sized in em under
  one container that carries `data-fit` (headers inside the same budget), with `data-fit-group`
  across columns, rows or cells so parallel text keeps one size. The Gambia text lands at 18-21px,
  the source deck's own 9pt. The containers keep 28px on the right: the delete ✕ overhangs an item
  by 24px and would otherwise read as overflow. The content starts at 200 under a title of at most
  50 characters, at 272 under a longer one; the title's budget follows, so a wrong guess shrinks
  the title instead of overlapping.
- **`chart-text` is a chart** (`bars`, `series` in `SERIES_LAYOUTS`, the Data panel) that keeps
  `bullets` (the explanation) and `blocks` (a note per series); `normalizeSlide` deletes those
  only on the other charts. Its values may be negative (costs), so `barSchema` no longer clamps
  at zero: every other chart clamps at render through `numeric`, and the Data panel keeps the sign
  only on this layout. The lines are an SVG over the whole slide with `pointer-events:none`, or it
  swallows every click on the slide.
- **Footnotes** are `slide.notes`, printed by `renderSlide` (not the renderers) in the footer row
  between the division label and the logo, grey 17px on two lines, white at 75% on dark footers,
  never on cover, agenda, divider, partner or closing slide (`NO_NOTES`). The model writes them
  from the material, numbered, with the superscripts kept in the text; "Footnote" in the slide bar
  adds one ("1. ") when the slide has none; its ✕ on hover removes it (`data-item="notes"` on a
  wrapper, `DELETE_ITEM` special-cases the path). A text points to a note with a superscript:
  "Reference" in the slide bar (shown once the slide has a note; its mousedown is prevented so the
  caret stays in the text) inserts the next number where the caret is, commits the text and adds
  "N. " on a new line of the note; typing "^1" in any text does the same on commit (SlideFrame).
- **None of them is in the rhythm pass or `LAYOUT_FAMILIES`**: the passes that swap layouts would
  cut their text down to cards, and the switcher has nothing of the same shape to offer.
- **AI-added slides carry their own place.** The add schema gives every new slide `after` (the
  existing slide it goes behind) and `INSERT_SLIDES` splices each group there, last position
  first. A top-up of eight missing slides from three chapters used to land in one block after
  "Next steps" with the single `insertAfter`, which stays as the fallback.
- **Cascade and the takeaway** (approved by Mario 28 Sep 2026 from a sheet of seven patterns; the
  other five, annotated chart, twin charts, impact pathway, equation and the takeaway on
  bullet-columns, were turned down and are not in the code). `cascade`: each block is a group,
  `label` on an accent bar spanning its columns, `items` its policies, `stats[j].value` its
  objectives (`label` unused, `normalizeSlide` moves a label-only objective to `value`), `support`
  the goal on the takeaway band with a target icon. A group takes as many columns as its longer
  tier and the shorter tier shares the width evenly: that is how an objective spans several
  policies (Gambia: two objectives under four policies), no explicit links. Arrows run from the
  finer tier's centres, or the coarser tier's when one would land between two boxes; the lowest
  box of every column drops onto one rule into the goal. `takeaway` is a slide field like
  `notes`, drawn only on `TAKEAWAY_LAYOUTS` (figures-panel for now, `normalizeSlide` drops it
  elsewhere): `takeawayBand`, the key message's band with a white icon circle. In the output
  schema; the model sets it when the material draws one closing sentence.
- **Both are modular.** Almost every block has its own ✕ and the rest re-flows, so a slide never
  shows a hole, an empty header or a dangling arrow. figures-panel: a row, a figure, a
  commentary point, a row's whole commentary (`blocks.i.items`), the headers row
  (`data-item="subtitle,support"`, the rule goes with it and the rows move up), the takeaway (the
  rows get the height back and the figures stop pairing), the footnote; a row with no figures
  gives its commentary the figures' column; with no commentary anywhere the figures take the full
  width in a grid of two to four columns and the commentary header is not drawn. Without a
  takeaway the markup is the approved figures-panel's, only the new `data-item` attributes added
  (`.omc/figures-markup.ts` proves it). cascade: a group (with its policies and objectives), a
  policy, an objective, the goal (the connector goes, the tiers take the height); a group with one
  tier gives it the full height, top-aligned, with no arrows; groups re-flow to the 1720px.
- **Every high-density slide is modular** (Mario, 28 Sep 2026: "every high-density slide must be
  totally modular"; before, only figures-panel and cascade were, and there was no way to add a
  point to a step). `lib/slides/modular.ts` holds the model, pure functions shared by the reducer
  and the editor; `isModular` is the six dense layouts plus any slide with `density: "high"`.
  - **Points** are strings in a list: a block's `items` (or its `body`, drawn as its one point;
    a second point folds the body into `items`), the explanation or conclusion `bullets`, a
    chart-text note (`blocks[j].body`). SlideFrame takes `pointOps` on these slides: Enter splits
    at the caret (`INSERT_POINT`, the current point keeps the text left of the caret, one undo
    step), on a sub-point the new one is a sub-point, Enter on an empty sub-point outdents it;
    Backspace or Delete on an empty point removes it (caret to the end of the previous one); Tab
    and Shift+Tab add or drop the "- " (not on cascade policies, notes or a stage's lone
    paragraph). A key that changed the slide marks its node done so the blur commit does not
    write the old text back, and the caret is placed after the next draw (`pendingCaret`).
  - **The ✕** is `DELETE_ITEM` routed to `deleteModular`: bare fields (`support`, `takeaway`,
    `subtitle`, `notes`, `body`, `subtitle,support`), a header or a stat's explanation emptied
    (`blocks.i.label`, `stats.i.label`, and the renderers skip an empty one), a point, a figure,
    objective or cell, a chart-text note, a block down to `PRIMARY_ARRAY.min`. It refuses the last
    point of a block (the block's own ✕ removes the block), the last element of a chart's
    explanation card, a block under the minimum; figures-panel, cascade and matrix keep the
    approved rule that a block emptied by its last ✕ goes too. SlideFrame's `canDeleteItem` is a
    dry run of the same function: a refused item gets `.item-fixed`, no ✕ and no outline.
  - **Element** is a menu on these slides (`addOptions` / `addPart`, one candidate table, action
    `ADD_PART`): Point (after the point with the caret, in the block with the caret, else the last
    block or the explanation), the block noun up to the layout max, Figure / Objective / Cell /
    Note where the layout has them, then only the optional parts that are missing (Header, Key
    message, Goal, Takeaway, Headers, Intro, Explanation, Heading, Conclusion, Footnote). The
    trigger and the rows prevent mousedown so the caret stays in the text; the text being typed
    is committed first; the new text is focused with its placeholder selected (`focusRequest`).
  - **Room at 18px.** Every add is first rendered offscreen with the real autofit
    (`lib/slides/fit-check.ts`, `roomFor`): refused with a message when any text that was at 18px
    or more would drop under it, a new text would land under it, or a budget would clip. Limits
    in `modular.ts`: ten points a list, six policies and four objectives a cascade group, five
    figures or cells a row, three notes. `normalizeSlide` allows all of it (its caps are the same
    or looser; an empty header or stat explanation is valid).
  - **Markup.** Every point and header sits in a `data-item` wrapper (never on the node that
    carries `data-fit`), a block that holds items puts its ✕ on the top-left corner, the band,
    the intro, a stat's explanation and a one-stat's text are wrapped the same way. With every
    part present the dense markup is the approved one plus those attributes and wrappers
    (`.omc/dense-dump.ts` before and after); standard slides are byte-identical
    (`.omc/markup-baseline.ts`). A dense stage with `items` lists them under its label (before
    this the High density timeline, phases and progress drew an empty stage: `denseContent` gives
    stages `items` and the dense stage read only `body`); a stage with only a body keeps its
    paragraph.
  - `.omc/modular-all.mts <outdir>` drives every layout of the High density tab on the local dev
    server: Enter, Backspace, every menu entry, the ✕ on everything down to the minimum, undo and
    redo, every part added back, text sizes, HTML and PPTX export, and the Process case (a point
    and a sub-point in Step 3, deleted, undone). `.omc/modular-audit.mts` prints what each layout
    offers.
- `.omc/modular-preview.ts` renders both layouts full and after deletions made by the real
  reducer (`.omc/modular-shot.mts` for PNGs); `.omc/modular-editor.mts` drives the editor on the
  local dev server (insert, ✕, undo/redo, HTML and PPTX export).
- `.omc/dense-preview.ts` renders the Gambia slides in the five layouts with the real autofit,
  `.omc/render-deck.ts <qa deck.json>` renders a whole QA deck; both write to `public/`, delete
  the output after.

## Charts

Seven chart layouts, all on white, all read `bars` and all open the Data panel on a click on
`[data-chart]` (`isChartLayout` in `schema.ts` is the guard, keyed off `ARRAY_LIMITS`). The
template's two, `chart-bars` (2-5 columns beside a legend) and `donut-chart`, are as they were.
The five drawn on 25 Sep 2026 in `layouts/charts.ts` share one geometry: the 80px title at the
100/100 origin with a two-line budget, the legend row at y 296 when there is more than one series,
the plot at `PLOT` (x 240, y 372, 1580 x 440) with chart-bars' grid and grey max/half/0 axis in the
left margin, category labels under it. Things that follow:

- **`bars[i].value` is a real figure.** The zod schema clamped it at 100 until 25 Sep 2026, so a
  bar of 12,450 schools failed the whole slide silently (the model then wrote shares instead).
  Every chart scales to its largest value; only the donut treats values as shares.
- **Series charts read `series` + `bars[i].values`.** `SERIES_LAYOUTS` in `schema.ts` says which
  (line 1-3, grouped 2-3, stacked 2-4). `normalizeSeries` makes the contract true after every
  parse and every Data panel edit: `series` holds between min and max names, every bar carries
  exactly one figure per series (a lone `value` counts as the first, a missing one is 0), and a
  single-series layout drops both and keeps the first series as `value`, so the switcher can move
  a slide between families without losing its data. Both fields are in the output schema
  (required, like everything), so every slide the model writes carries `series: []` and
  `values: []`; `stripEmptyFields` and the zod transforms drop them.
- **Values on the series charts are not `data-edit`.** Three figures on one x position have no
  room for a caret each; the Data panel is their editor. Category labels and series names are
  editable on the slide.
- **Thirty labels rotate.** Past twelve categories `xLabels` turns them 45°, right-aligned to
  the column. A rotation is the one CSS transform the PPTX walker keeps as a native property
  (`isRotationOnly`), so the export follows without a branch. The line chart's lines are an
  inline SVG, which the walker rasterises on its own, like an icon.
- **Colours**: single-series charts are the accent (one tint, thirty bars; a hand-picked
  `color` still wins), series charts take `seriesColors`: the UNICEF Brand Book series where the
  brand has one, spread tints of the accent on Giga. The Data panel hides the swatch on series
  charts, where a per-category colour would mean nothing.
- **The Data panel is per layout**: row limits from `PRIMARY_ARRAY` (thirty rows scroll), series
  names in a header row with add/remove inside the layout's span. `SET_BARS` takes `series` and
  runs `normalizeSeries`.
- `.omc/charts-qa.ts` renders every chart at its minimum and maximum, both palettes, with the
  real autofit: run it after touching a renderer.

## The layout switcher

"Layout" in the slide bar is **hidden behind `SHOW_LAYOUT_SWITCH` in `app/page.tsx`** (Mario, 23
Sep 2026, deployed the same day); everything below stays wired and returns whole when the flag
flips. It opens `components/LayoutSwitcher.tsx`, which costs nothing: the slide is
rendered as it is, text and photo included, in every other layout of its **family**, the layouts
that read the same fields (`LAYOUT_FAMILIES` in `lib/slides/families.ts`: blocks, stats, bars,
section, hero, photo). A pick is `REPLACE_SLIDE` with the same merge as a regenerated slide
(`onApplyLayout` in `app/page.tsx`), one undo step. Things that follow:

- **A layout absent from `LAYOUT_FAMILIES` never appears in the switcher**, and the Layout button
  hides on it (`familyOf` in `page.tsx`). Add every new layout to the table, or it is reachable only
  through Add slide. Left out on purpose: cover, agenda, section-divider, thank-you, partner, quote,
  body-copy (its blocks are halves of prose, the labels would vanish), timeline and timeline-phases
  (their labels are dates), tiers, a4-page.
- **Order is a rule, not a model**: `switchTargets` puts the photo layouts that hold every item
  first (a photo is the first thing people reach for against a flat deck), then the other full ones
  alternating light and dark, then the ones that show fewer, with a red "2 of 4 items" badge. A pick
  there drops the extra items on apply, as the badge said.
- **"Text shrinks" is measured, not guessed.** `autofitAll` returns how many budgeted nodes ended
  below their drawn size; `SlideFrame` reports it through `onAutofit`, which the picker previews
  already run (they autofit exactly like the editor). The exported deck's `AUTOFIT_JS` ignores the
  return value and did not change.
- Moving to a different family (four KRs into a numbers slide, into prose) is Edit with AI's job.
- **Edit with AI is a dialog** (`components/EditWithAiModal.tsx`, Mario, 25 Sep 2026): an instruction
  for the model and/or a layout of the same family. `onEditWithAi` in `page.tsx` applies the layout
  on the spot (the same merge as `onApplyLayout`) and then, if there is an instruction, regenerates
  the slide in that layout. So the switcher's targets are reachable here whatever
  `SHOW_LAYOUT_SWITCH` says. The dialog states that photos and images are never edited by the AI.

## Two-pagers

A deck is one of two formats, carried on `DeckState.format`: `slides` (16:9) or `two-pager`, the
A4 portrait print piece. The switch appears in the sidebar on **UNICEF Digital Inclusion only**,
and only while the deck is empty — the formats do not mix, and `SET_FORMAT` enforces that in the
reducer rather than only in the UI.

**A page is a slide.** It lives in `state.slides` with `layoutId: "a4-page"` and its content in
`stack: PageBlock[]`. That is what makes reorder, duplicate, delete, undo, redo, autosave and the
deck file work on pages with no changes at all. `isPage()` is the guard; the slide-only actions
(`SET_MAP`, `SET_BARS`, `TOGGLE_CELL`, `SET_LOGO`, `INSERT_TIERS`) no-op on one.

**A page is a stack of blocks, not a layout.** The fourteen block types in
`lib/slides/pages/schema.ts` come from the ten signed-off A4 boards, and so do the grid and the
type scale in `pages/a4.ts`. "Add page" offers presets — a starting composition, not a fixed
layout — and blocks can then be added, removed and reordered inside the page.

**The page renderer works in points, 1:1 with Figma** (`595pt x 842pt` = A4), so printing needs no
scale factor anywhere. Two consequences that fail silently if you forget them:

- **`data-fit` budgets stay in px.** `autofit.ts` reads `getComputedStyle().fontSize` and
  `scrollHeight`, which are px whatever unit the markup uses. A budget left in pt is a third too
  generous, so the text overlaps instead of shrinking. Use `edP()` / `fitAttr()`; never write a
  `data-fit` literal.
- **Line-heights are unitless.** Autofit only remembers a line-height it can parse as px, so a pt
  one stays put while the font shrinks underneath it.

**`data-item` and `data-fit` must never sit on the same node.** The ✕ is injected *inside* the
`[data-item]` element and hangs past its right edge, which makes `scrollWidth` exceed
`clientWidth` — and that is exactly what autofit reads as overflow. It shrank whole paragraphs to
the 40% floor before this was understood. Blocks emit a separate empty `hit()` span for the ✕.

**Block heights are estimated, not measured.** A renderer is a pure string function, so
`lineCount()` guesses how many lines a string takes from the average glyph advance measured over
the boards' own text (0.457em for Open Sans), deliberately erring long. Autofit is the backstop
when the guess is short.

**A page that overruns is clipped, on purpose.** The stacker sums block heights and marks the
section `data-page-overflow` when it passes the content zone; nothing reflows onto a page the user
did not ask for. The generation-side guard is the `weight` in `page-catalog.ts` and the prompt rule
that a page's weights sum to 100 or less — the print twin of the fit-budget/word-limit pairing, and
it has to be re-checked whenever a block's geometry changes.

**Printing uses a named `@page` rule.** `@page a4` sits beside the unnamed slide rule, and
`PrintRoot` picks `.print-page` for a page. Two unnamed rules would silently overwrite each other,
and the size must be written in the same units as the box (`595pt 842pt`, not the `A4` keyword) or
Chrome emits a blank sheet after every real page.

**Images and icons are addressed by path.** A page holds several of each, so `SET_IMAGE`,
`SET_IMAGE_POS` and `SET_ICON` take a `path` and write through `setPath`; `framedImage()` now
carries its path in `data-image`. Every photo slot also gets its own upload button, because the
toolbar action can only ever mean one of them.

**The slides decide the format.** `storage.read` and `parseDeckFile` both derive it from the
content rather than trusting the stored field, so a session or a file saved before the field
existed still opens as a two-pager. `format` is *not* hydrated as a setting: it belongs to the
document, and hydrating it would open an empty editor in two-pager mode.

**The HTML file is a scrolling A4 document**, not the fullscreen deck runner
(`export-page-html.ts`), and it carries the identical `deckStateScript` payload — it is still the
save file. There is no PPTX for pages.

### Adding or changing a block

1. `lib/slides/pages/schema.ts`: the type in `PAGE_BLOCK_TYPES`, and an entry in
   `PAGE_BLOCK_LIMITS` if it has a repeating array.
2. `lib/slides/page-catalog.ts`: usage line, field spec with hard word limits, and a `weight`.
   A compile-time check enforces that every AI-selectable block has an entry.
3. `lib/slides/pages/blocks.ts`: the renderer, geometry from the boards, `edP()` / `fitAttr()` /
   `hit()` / `esc()`, inline styles only, and it must return its own height.
4. `SPACE_BEFORE` in the same file, and `BOXED` if it is a framed block.
5. `lib/slides/pages/presets.ts`: a default, and a preset if it starts a page.
6. Check the block at its `PAGE_BLOCK_LIMITS` minimum and maximum with text at the catalog limit,
   and check a page of them still fits inside 842pt.

## Adding or changing a layout

Touch all of these, in this order:

1. `lib/slides/schema.ts` : add the id to `AI_LAYOUT_IDS` or `MANUAL_LAYOUT_IDS`, add an entry to
   `ARRAY_LIMITS` if it has a repeating array (this also feeds `PRIMARY_ARRAY`, the add/delete
   element affordance).
2. `lib/slides/catalog.ts` : usage line and field spec with hard word limits. There is a compile-time
   check that every AI layout has a catalog entry.
3. `lib/slides/layouts/*.ts` : the renderer, with `ed()`, `item()`, `dly()`, `esc()`, inline styles
   only, geometry from the template.
4. `lib/slides/layouts/index.ts` : register it in `LAYOUTS` with its human label, and
   `lib/slides/families.ts` : add it to `LAYOUT_FAMILIES` with its family, or the layout switcher
   never offers it and the Layout button hides on it.
5. `lib/slides/defaults.ts` : placeholder content for manual insert.
6. If the photo runs underneath the footer, add the id to `LOGO_TONE_LAYOUTS` in `app/page.tsx`
   with the geometry the tone is sampled from (`RIGHT_PANEL_TONE` or `FULL_BLEED_TONE`). Miss this
   and the layout renders fine with a logo that never flips.
7. Check the fit budgets against the word limits by generating a slide at the catalog maximum.

If a layout is dense approved content that the model would hallucinate (the partnership tiers, for
example), make it manual-insert only instead of AI-selectable.

**The tier slides have one automatic entry point**, `TIERS_REQUEST` in `app/page.tsx`: after a
generation, a brief that asks for them by name ("partnership tiers", "tier table", "livelli di
partnership") gets `INSERT_TIERS`. It used to fire on the bare word "tier", and "API keys by tier"
in an OKR brief shipped the partnership table uninvited (22 Sep 2026). Keep the pattern about
the table, never about the word.

## Exports

The toolbar calls them Upload and Download, not Import and Export: these are files on your machine,
not a system to sync with.

- **PDF**: browser print (`window.print()`), one slide per page, via `components/PrintRoot.tsx`.
  Chrome, backgrounds on, scale 100%.
- **HTML deck**: one self-contained file, fonts and logos inlined as data URIs, arrow-key navigation,
  template entrance animations, autofit script inlined. **It is also the project file** — see below.
- **PPTX**: `export-pptx.ts`, live in the Download menu for slide decks (not two-pagers). No
  model call, and **no second description of the template anywhere**: `pptx-native.ts` walks the
  slide the renderer just produced (after autofit) and translates each DOM node into a native
  PowerPoint object. A box with a fill, a border or rounded corners becomes a shape (one side of
  border becomes a line along that edge); a node whose element children are all inline becomes an
  editable text box with the computed font, size, weight, colour, alignment, line height and
  letter spacing; an `<img>` (with its overflow-hidden frame, so crop and zoom survive), an inline
  SVG icon, and anything CSS draws that PowerPoint has no shape for (a gradient, a `filter`, a
  scale transform) is rasterised **on its own** and placed as a picture of exactly its size. An
  SVG is cut to the part with ink on it (`drawnRect`: the union of its shapes, padded for the
  stroke), not its box: line charts draw on a slide-sized SVG in slide coordinates, and the
  picture covered the whole page, so the slide looked like one image in PowerPoint (1 Oct 2026).
  Change a renderer and the export follows; that is the point of the design, so do not add a
  layout-specific branch to the walker. Rasterising a single element goes through
  `rasterize.ts` with a `crop`: the stage is cloned, every node outside that subtree is hidden
  and the root background cleared, so the picture keeps inherited fonts and CSS variables.

  If the walker throws on a slide, `export-pptx.ts` falls back for that slide to the earlier
  form (one PNG of the slide with the `data-edit` fields hidden, plus a text box per field), so
  one odd layout never stops the export. Two things in the rasteriser that fail silently if
  forgotten: the SVG must be loaded as a **data URL**, a blob URL taints the canvas and
  `toDataURL` throws; and the captured node must be the **inner stage**, not the offscreen host,
  because the host's `left:-20000px` is copied into the SVG and the picture comes out blank.
  Manrope and Open Sans are referenced by name, so a machine without them shows a fallback face;
  semibold weights become bold. Units: 1920px = 13.333in, so 1px = 0.5pt.

Known limits, on purpose for now: table cells in the tier layouts are not inline-editable, and
PDF/PPTX import is not implemented.

## Country maps

`public/country-maps/<slug>.jpg` holds the Giga Maps export for each of the 54 countries Giga works
in: every school as a dot on a dark basemap. A slide stores `map: "<slug>"`, never the image itself,
so the deck stays small and the HTML export inlines the file once. `lib/slides/country-maps.ts` is
the list, and `isCountryMap` guards it against a deck file naming a country we no longer ship.

- **A click on the photo opens the picker; a drag reframes it.** `SlideFrame` tells them apart
  in the pan gesture (`moved`): a press that never moved calls `onPickImage`, so the slide's own
  photo is the way in, not only the bar's Image button. The picker then opens on "Current", with
  Remove (`CLEAR_IMAGE`, back to the placeholder) and Replace. Likewise a click on a chart's
  `[data-chart]` area (bars, donut) opens the Data panel through `onChartClick`.
- **A photo and a map are alternatives in one slot.** `SET_IMAGE` and `SET_MAP` each clear the
  other. `SET_MAP` also drops `imagePos`, which belongs to the photo.
- **A map is drawn `contain`, on the basemap grey**, not `cover` like a photo. Cover would crop a
  country out of its own slide, and `imagePos.zoom` starts at 1, so nobody could pan it back. This
  is the one place a near-black surface is allowed: it is the map's own background, and it comes
  from Giga Maps, which is the standing exception to the no-black rule.
- **The raw exports are screenshots**, so the country sits wherever it landed in the frame.
  `tools/prepare-country-maps.py` crops each one around its school dots, which is what makes them
  usable at all. Re-run it when new countries arrive and regenerate the list to match. It never
  upscales and never crops a dot away.
- The model does not choose maps, and since 17 Sep 2026 neither does the user: the screenshots are
  no longer offered in the picker (Mario's call). `slide.map` is kept so decks saved with one still
  render; it is stripped from what the model sees (`lightSlide`) and restored via `preserve`.

**The library** (`lib/slides/library.ts`, files in `public/library`, 1920px JPEGs with 480px
thumbnails) is the picker's third section: Giga's own photos from the website export (24 Sep
2026). A pick stores the root path (`image: "/library/<id>.jpg"`) through `SET_IMAGE`, never the
pixels, the same way the placeholder photo and the country maps travel: the deck file's
`SAFE_ASSET` accepts a root path, `inlineAssets` inlines it on export, and the PPTX rasteriser
loads it like any same-origin image. Adding a photo means the file, its thumbnail, and one line
in `LIBRARY`; renaming one breaks decks that stored the old path.

**Live maps** (`components/LiveMapPanel.tsx`, `lib/giga-maps/`) are the only path now, behind the
"Maps" section of the image picker. The map is rendered in the
browser with MapLibre from the public Giga Maps vector tiles (schools, health centers, or both;
dark or light basemap; no place names, no roads, only national borders) and inserted through
`SET_IMAGE` as a JPEG data URL, exactly like an uploaded photo. Things that follow from that:

- **A live map is an `image`, not a `map`.** It is rendered at the pixel size of the layout's slot
  (`lib/giga-maps/slot.ts`, geometry from the `framedImage` / `photoPanel` calls), so cover-fit shows
  it whole and `imagePos` still works. Nothing new in the schema, the deck file or `storage.ts`.
- **It costs what a photo costs** in localStorage: 1720x572 JPEG at q0.85, usually 100 to 250 KB.
  The same quota caveat as uploads applies.
- **Tiles go through `app/api/giga-maps/tiles`** because the Giga backend sends no CORS headers; the
  route sends no `Accept` header on purpose (the backend answers 406 otherwise). `countries` proxies
  the v2 country list with school and health center counts.
- **The wait says what is happening.** `renderGigaMapDataUrl` takes `onProgress` (basemap, then
  facility tiles counted once each by key, done of asked, then the image); the preview frame shows
  "Loading the map of Brazil…", "Placing 162,741 schools on the map…", "Preparing the image…" over
  a Giga Blue bar (facility tiles move it, and it also creeps with time, never past 88%, since the
  Giga backend can take 30s on a first visit), and after 6s "Large countries take a few seconds
  more." The line under the settings keeps the facility counts.
- **The dark basemap wears maps.giga.global's colours.** OpenFreeMap's dark style is near black
  with grey water and faint borders; `cleanBasemap` repaints it with `GIGAMAPS_DARK` (config.ts:
  land #1c1c1c, water #1a2a3c, borders #7d7d7d, read from the site's Mapbox style), so a map in a
  deck matches the site. The dot colours already match (`DOT_COLORS`).
- **maplibre-gl stays on 5.x.** 6.x resolves its worker through `import.meta.url`, which never
  loads under Next, and the map silently stays empty.
- **The preview renders on its own** whenever country, facilities or style change (250 ms debounce,
  a token discards superseded renders). MapLibre draws on `requestAnimationFrame`, which browsers
  pause in background tabs, so a render started in a hidden tab completes when the tab is visible
  again; the modal is on screen while this runs, so in practice it is never noticed.
- **While the map is rendering the preview is a canvas-colored skeleton**, not a dark slab: the
  near-black basemap is slide content and only appears once the image exists.
- Only the Gambia has health centers in the backend as of September 2026; the panel says so per
  country instead of showing an empty map without explanation.

## The deck file

There is no server and no account, so the exported HTML doubles as the save file: `lib/slides/deck-file.ts`
writes the deck's data model into an inert `<script id="giga-deck-state" type="application/json">`
block and reads it back. `parseDeckFile` returns a `Partial<DeckState>` that `app/page.tsx` hands to
the existing `HYDRATE` action — the same one localStorage uses on load.

A database was considered and turned down: the need is backup and portability, and a real one would
cost auth (without it a shared deck is either public or bound to a device that loses it exactly like
localStorage does), plus moving uploads to object storage, which would break the offline HTML export
until it learned to inline remote URLs too.

Things worth knowing before touching it:

- **Everything in a file is untrusted.** `normalizeSlide` runs per slide, `image` and every `logos`
  value must look like an upload (`SAFE_ASSET`) or the field is dropped, `activeIndex` and `count`
  are clamped, an unknown `brandId` is ignored rather than guessed. Renderers put these straight
  into a `src` and `SlideFrame` injects with `innerHTML`, which wires `onerror` even though it does
  not run `<script>`.
- **`usage` is not in the file.** Token cost belongs to the session that spent it. `name` is (added
  17 Sep 2026 without a version bump: optional both ways, an older file opens as "New deck").
- **The payload doubles the size of a photo-heavy deck** (each image is in the markup and in the
  payload). Accepted: deduplicating would couple the payload to rendered markup.
- **A `<` never appears literally in the payload** — `deckStateScript` escapes them all, which is
  what makes "the first `</script>` after the marker is the terminator" safe to rely on when reading.

### Changing the deck file format

1. Bump `DECK_FILE_VERSION` in `deck-file.ts`.
2. Keep `parseDeckFile` reading every older version. Only a *newer* version is an error.
3. `VERSION` in `storage.ts` is a separate counter for the localStorage shape. Bump it only if
   `Persisted` actually changed — bumping it logs out every returning user.
4. Export a real deck with a photo, reopen it, and check the closing slide title survived.

## Working here

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

There is no unit test suite, apart from `npx tsx tools/fidelity-test.ts` (the replica's fidelity
check and the app's restore: put back, rebuild, continue; no model, no server). Two scripted checks call the real model: `tools/qa-generate.py`
scores one deck against its source material, and **`tools/qa-suite.ts` runs twenty briefs of
different nature** (and, with `QA_FILE=<json>`, any other set: `.omc/qa-usecases.json` holds
twenty-one use cases with Word, PowerPoint, PDF, CSV, notes and workbooks from `.omc/qa-files/`,
in four languages, 26 Sep 2026; `files` on a prompt attaches any of them) (`tools/qa-prompts.json`, long ones in `tools/qa-briefs/`) through the whole
pipeline as the editor runs it (brief parsing, request, normalize, chapter filter, rhythm pass,
year guard, top-up) and scores each deck: count, structure, series fidelity, chapters, language,
drift, banned words, invented years (a warning), non-figure stats, empty fields, duplicate
titles, runs of one layout, and words over the catalog limits. `npx tsx tools/qa-suite.ts` with
the dev server up, about $0.17 a run, decks and `report.md` under `.omc/qa/<stamp>/`. It went
from 3/20 to 17/20 on 23 Sep 2026; what it fixed is in "What the pipeline decides" below. Run it
after touching the prompt, the catalog, `brief.ts`, `rhythm.ts` or `voice.ts`. "Done" means all
of the following:

1. `npm run lint` clean.
2. `npm run build` clean (type errors surface here).
3. Manual pass in the browser: generate a deck from a real brief, edit a text node on the slide you
   changed, add and delete an element, undo/redo, reload the page (localStorage hydration), export
   the HTML deck, open the print preview.
4. If you touched a renderer, look at the slide at both extremes: minimum item count and maximum
   item count from `ARRAY_LIMITS`, with text at the catalog word limit.

Claiming a change works without step 3 is the main way regressions have shipped here.

Conventions:

- Branch off `main`, small commits. Commit subjects are short declarative sentences describing what
  changed for the user, not the file list. Look at `git log` before writing one.
- Never commit `.env.local` or any key. `.env*` and `.omc/` are gitignored.
- If a change makes `README.md`, `PRODUCT.md` or `DESIGN.md` wrong, update them in the same commit.
- Ask before: changing template geometry, adding a color or typeface, giving the model more control
  over layout, changing the brand-to-palette rule. Mario owns those calls.
