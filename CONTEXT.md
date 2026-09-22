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

Stack: Next.js 16.2 (App Router), React 19, TypeScript, Tailwind 4, Anthropic SDK, zod.
Deployed on Vercel as `un-deck-builder`. One env var: `ANTHROPIC_API_KEY`.

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
   from us.
8. **Slide renderers emit HTML strings with inline styles only.** No Tailwind classes, no external
   CSS. The same markup has to survive the editor preview, the thumbnails, the print root, the
   self-contained HTML export, and the PPTX capture. A class that only exists in `globals.css`
   breaks the exports silently.

## The pipeline in one screen

```
brief ──> app/api/generate/route.ts        streaming NDJSON route, claude-haiku-4-5
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

**Fit budgets and word limits are one system.** The `data-fit` value in a renderer and the
`<=N words` limit in `catalog.ts` were tuned together so that text at the catalog limit still
renders at full size. Change one and you have to re-check the other, or slides start shrinking
their own text. Stat values (`stat-grid`, `brand-equity`, `two-stats`) are the special case: they
wrap to a second line inside a budget sized to the row pitch before they shrink, and they carry
`data-fit-group="stat"`, so `autofitAll` gives every value on the slide the smallest scale among
them: six values, one size. The group logic lives twice, in `autofit.ts` and in its ES5 copy
`AUTOFIT_JS` that the HTML export inlines; change both.

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
is a separate contract: the ✕ from `item()` only works for the layout's `PRIMARY_ARRAY` field.

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
and only `brandId` and `chapters` are hydrated, because a preference is not work.

The offer is backed by the saved session itself, not a copy — a photo-heavy deck already runs at the
edge of the localStorage quota, so a second key would be the write that fails. What keeps it alive
is the autosave: **it is held off while `previous` is set**, since the empty editor has nothing worth
writing over that deck. Remove that guard and the first debounce tick erases the deck the card is
still offering. `onDeckArrived` releases it, which is also what stops the offer from resurfacing
behind a deck the user has since deleted; Discard calls `clearSaved`.

**The tour is anchored by `data-tour` attributes.** `components/Tour.tsx` finds its target with
`document.querySelector('[data-tour="…"]')`, so renaming or removing one of those attributes
silently drops a step (a missing target is skipped on purpose: half the chrome only renders with
slides). The steps themselves live in `INTRO_STEPS` and `EDITOR_STEPS` in `app/page.tsx`. **The tour
never starts on its own** (Mario's call, 17 Sep 2026): the only entry point is "How it works" in the
sidebar, which runs the intro steps on an empty editor and both phases once a deck exists. There is
no "seen" flag anywhere, so nothing to bump. `onDeckArrived` stays the single place every path that
puts slides on screen goes through (generate, restore, open a file, manual insert, drop an image); it
now only retires the last-session offer.

## The AI layer

- Model: `claude-haiku-4-5-20251001`. Fast and cheap, about $0.01 for a 12-slide deck. The whole
  design assumes a small model doing a constrained job.
- **Every field in the output schema is required.** Optional fields made the grammar too complex and
  the API returned "Schema is too complex". The model fills unused fields with `""` or `[]` and the
  route strips them in `stripEmptyFields`. Do not "clean this up" by making fields optional.
- **Prompt size is a cost and latency budget.** The catalog is compiled into the system prompt on
  every call. Keep new catalog lines to one tight line.
- Three modes share the route: `generate`, `add` (returns new slides plus `insertAfter` plus
  refreshed agenda bullets), `regenerate` (one slide).
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
- Errors are translated to plain language for the user, including the 529 overloaded case. Keep that
  behavior when touching the route.
- **The slide count comes from the brief.** `countFromBrief` in `app/page.tsx` reads "20-page",
  "in 6 slides", "Six slides", "10 diapositive" (digits or number words, English and Italian, up
  to twenty) and sends it as `count`; the user turn then demands exactly that many and the route
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
  item gets its slide, titles are copied as written, the same layout for the whole series, and the
  variety rules ("never the same layout three times in a row", alternate surfaces) yield. Items
  are never dropped, merged or renumbered; if no layout holds them all, the model picks the one
  that holds the most. Before this rule (22 Sep 2026) an OKR brief with six objectives came back
  with a different layout per objective, three-word titles and two KRs silently gone. Dates are on
  the never-invent list too: the same deck got a "2024" subtitle from nowhere. **The catalog has
  no list layout**: the widest is `four-cards` (4 x 16 words), so a six-item list still loses
  items until the template gains one (Mario is drawing it, 23 Sep 2026).

## Attachments to the brief

The prompt box takes reference files (PDF, Word, PowerPoint, text, images) via "Attach files" or a
drop on the box. They exist to give the model the facts; they are **not** deck content.

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
- **`regenerate` does not carry attachments.** It already gets the brief and the slide; re-sending
  a PDF for every single-slide rewrite would multiply the cost for little gain.
- The composer is `components/PromptBox.tsx`: it owns the textarea, the hidden file input behind
  the "+" button, the drop target, the Chapters pill and the Generate button. `AttachmentsRow` only
  renders the chips (`bg-giga-tint`, `text-giga`, inline SVG glyphs). The outer node keeps
  `data-tour="prompt"`, and the pill and the button carry `data-tour="chapters"` and
  `data-tour="generate"`, so the tour still frames each of them.

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
4. `lib/slides/layouts/index.ts` : register it in `LAYOUTS` with its human label.
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
  scale transform) is rasterised **on its own** and placed as a picture of exactly its size.
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
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

There is no test suite; `tools/qa-generate.py` is the one scripted check, for the prompt (it
calls the real model). "Done" means all of the following:

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
