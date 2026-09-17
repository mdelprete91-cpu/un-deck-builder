# Giga Deck Builder

Generate branded slide decks from a prompt. The AI never designs slides: it picks layouts from the approved **Giga Partnership Template** (27 layouts, 1920×1080) and fills in the text. You edit inline, reorder, and export.

On **UNICEF Digital Inclusion** there is a second template: the **two-pager**, an A4 portrait piece made to be printed. Same idea, one level down — the AI stacks blocks from an approved catalog (14 of them, taken from the signed-off A4 boards) and writes the text.

## How it works

- **PowerPoint download**: every slide rebuilt from native PowerPoint objects: text boxes, shapes and lines you can edit, photos and icons as pictures, in Manrope and Open Sans. It is read off the rendered slide, so a template change reaches the PPTX with no extra work. No AI involved, so it costs nothing and works offline. Slides only.

- **Sidebar**: logo lockup (UNICEF Digital Inclusion / UNICEF Digital Impact Division / UNICEF) and the prompt box, a chat-style composer: the brief, a "+" to attach reference files, the Chapters toggle and Generate in one surface. ⌘↵ generates.
- **Template switch** (Digital Inclusion only, and only on an empty deck; hidden for now behind `SHOW_TEMPLATE_SWITCH` in the sidebar while the two-pager is finished, saved two-pagers still open): Slides, or Two-pager. A two-pager page is a vertical stack of blocks at A4 — title, labelled text, status callout, stat cards, icon columns, photo cards, two columns, figure, screens, table, numbered asks, contacts. "Add page" starts from a preset composition; inside a page you add, remove and reorder blocks. Everything else behaves the same: inline editing, ✕ to delete an element, duplicate, reorder, undo, regenerate with AI, and per-slot image upload.
- **Chapters toggle** (in the prompt box next to Generate, off by default): off, the deck is generated with no agenda slide and no section dividers, for when that structure is more than the story needs. It is an input to Generate, not a view option: it shapes the next generation and never edits the deck on screen, and the sidebar says so when the two disagree.
- **Generation**: Claude Haiku 4.5 returns structured JSON (`layoutId` + text fields) via a streaming API route — slides appear one by one. Fast and cheap (~$0.01 per 12-slide deck).
- **Logo lockups** change the footer logo and the footer label, and carry one of two palettes. UNICEF keeps the Giga blue palette (so does the retired Giga lockup, still rendered for decks saved with it); Digital Impact Division and Digital Inclusion run on two surfaces only, UNICEF cyan `#01AEEF` and white. The one exception is the donut chart, whose segments take the UNICEF Brand Book secondary colours. The typography (Manrope + Open Sans, self-hosted) never changes.
- **Layout variants**: card and stat layouts adapt to their element count (1 to 4 cards, 1 to 6 stats, 2 to 5 timeline points…) — both when the AI picks a count and when you edit.
- **Editing**: click any text on the slide to edit it (Escape cancels). Hover an element for ✕ to delete it, "+ Element" adds one back. Undo/redo with Cmd+Z / Cmd+Shift+Z or the toolbar arrows. Thumbnails: reorder, duplicate, delete. "Regenerate slide" rewrites the active slide with an instruction. The deck autosaves to localStorage as you work.
- **Opening the app**: always on an empty editor. The autosave is a safety net, not a session that resumes on its own, so the deck from last time waits on a "Last session" card on the empty state, with Pick it up and Discard. Only the logo lockup and the Chapters setting carry over.
- **Product tour**: runs on first use, in two phases. The brief, the Chapters toggle and Generate on the empty editor, then the canvas, the slide bar, Add slides and Download once the first deck exists. "How it works" in the sidebar replays it at any time.
- **Download PDF**: browser print (Chrome, backgrounds on, scale 100%) — one slide per page at 1920×1080, or one A4 sheet per page for a two-pager.
- **Download HTML deck**: one self-contained file (fonts and logos inlined) with arrow-key navigation and the template's entrance animations. The same file is the project file: it carries the deck's data model in an inert JSON block. A two-pager downloads instead as a scrolling A4 document that prints to the same PDF — still the save file.
- **Upload**: drop an exported HTML deck on the canvas, or use "Upload" in the toolbar next to Download, to pick up where you left off — slides, logo, brief and the Chapters setting all come back. Replacing a deck that is on screen asks first. Decks exported before this existed can still be presented, they just cannot be reopened.

## Setup

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Deploy on Vercel with `ANTHROPIC_API_KEY` as an environment variable.

## Architecture

```
lib/slides/
  schema.ts     slide types + zod validation (flat field union across layouts)
  catalog.ts    AI-facing layout guidance + word limits (compiled into the prompt)
  brand.ts      the four brand themes (colors, logos, footer label)
  layouts/      one HTML-string renderer per layout, markup verbatim from the template
  prompt.ts     system prompt + JSON output schema (output_config.format)
  parse.ts      incremental JSON scanner → slides stream in one by one
  export-html.ts  standalone deck serializer
  deck-file.ts  the deck file format: writes the embedded state block, reads it back
  storage.ts    localStorage autosave, and the previous-session slot behind it
  onboarding.ts which phase of the product tour the user has already seen
components/Tour.tsx           the spotlight tour, driven by data-tour attributes
app/api/generate/route.ts     NDJSON streaming route (claude-haiku-4-5)
```

Layouts `tiers-1` and `tiers-2` are manual-insert only (dense approved content the model shouldn't rewrite); table cells are not inline-editable in v1.

Source template: `Giga Slides.dc.html` (2026-07, supersedes `Giga Partnership Template.dc.html`). Logos and fonts come from the brand-asset repo (gigabrand.vercel.app).
