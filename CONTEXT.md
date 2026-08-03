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

1. **The Giga palette is fixed.** Switching brand (Digital Impact Division, Giga, UNICEF, Digital
   Inclusion) changes the logo lockup and the footer label only, never the colors. See the comment
   in `lib/slides/brand.ts`.
2. **No black.** No solid black or near-black background anywhere, in the chrome or on a slide.
   This is why `section-image-dark` was retired. Dark surfaces are Giga blue, not black.
3. **One accent.** Giga Blue `#277AFF` and its tints. Red only for destructive and error states.
4. **Typography never varies.** Manrope plus Open Sans, self-hosted in `public/fonts`. No third
   typeface, in the chrome or in a slide.
5. **Slide markup is verbatim from the template.** The renderers in `lib/slides/layouts/` reproduce
   approved geometry at 1920x1080. Do not "improve" spacing, sizes, or hierarchy on your own
   judgment. If a slide looks wrong, the fix is usually the fit budget or the word limit, not the
   geometry.
6. **Never invent a layout.** New slide types come from the template, not from the model and not
   from us.
7. **Slide renderers emit HTML strings with inline styles only.** No Tailwind classes, no external
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
their own text.

**`dly()` for animation delays.** Never write `animation-delay:.${n}s` by hand. With a single-digit
n that reads as 0.8s, which is what broke element ordering in the HTML export once already.

**`esc()` on every user string.** Renderers build raw HTML.

**Uploaded assets never reach the model.** `app/page.tsx` strips `image`, `imagePos`, `logoTone`,
`logos` and `grid` before sending existing slides to the API (`lightSlide`), and merges them back
into the replaced slide afterwards. Data URLs in a prompt are expensive and useless to the model.

**Retired layouts stay in the code.** `LEGACY_LAYOUT_IDS` exists so decks saved before a layout was
banned still validate and render. Never offer them to the AI or in the insert list, never delete
them.

**Forced content.** The closing slide is always titled "Thanks" (`normalizeSlide`). Agenda bullets
mirror the `section-divider` slides one to one, enforced both in the prompt and by `syncAgenda` in
`state.ts`.

**Bump `VERSION` in `storage.ts`** whenever the persisted shape changes, otherwise returning users
hydrate a broken deck from localStorage.

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
- Errors are translated to plain language for the user, including the 529 overloaded case. Keep that
  behavior when touching the route.

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
6. Check the fit budgets against the word limits by generating a slide at the catalog maximum.

If a layout is dense approved content that the model would hallucinate (the partnership tiers, for
example), make it manual-insert only instead of AI-selectable.

## Exports

- **PDF**: browser print (`window.print()`), one slide per page, via `components/PrintRoot.tsx`.
  Chrome, backgrounds on, scale 100%.
- **HTML deck**: one self-contained file, fonts and logos inlined as data URIs, arrow-key navigation,
  template entrance animations, autofit script inlined.
- **PPTX**: the code in `export-pptx.ts` works (renders each slide offscreen, captures to PNG,
  places it full bleed) but is deliberately **not wired into the UI**. It was parked. Do not
  re-enable it without asking.

Known limits, on purpose for now: table cells in the tier layouts are not inline-editable, and
PDF/PPTX import is not implemented.

## Working here

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

There is no test suite. "Done" means all of the following:

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
  over layout, re-enabling PPTX, changing the brand-to-palette rule. Mario owns those calls.
