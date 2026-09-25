# Giga Deck Builder

Generate branded slide decks from a prompt. The AI never designs slides: it picks layouts from the approved **Giga Partnership Template** (27 layouts, 1920×1080) and fills in the text. You edit inline, reorder, and export.

On **UNICEF Digital Inclusion** there is a second template: the **two-pager**, an A4 portrait piece made to be printed. Same idea, one level down — the AI stacks blocks from an approved catalog (14 of them, taken from the signed-off A4 boards) and writes the text.

## How it works

- **PowerPoint download**: every slide rebuilt from native PowerPoint objects: text boxes, shapes and lines you can edit, photos and icons as pictures, in Manrope and Open Sans. It is read off the rendered slide, so a template change reaches the PPTX with no extra work. No AI involved, so it costs nothing and works offline. Slides only.

- **Sidebar**: logo lockup (UNICEF Digital Inclusion / UNICEF Digital Impact Division / UNICEF) and the prompt box, a chat-style composer: the brief, a "+" to attach reference files, the Chapters toggle and Generate in one surface. ⌘↵ generates.
- **Links in the brief**: paste a URL and it turns blue as you type; when you generate, the page's text is fetched and handed to the model as reference material, like an attached file (three links at most, public pages only; pages built in JavaScript are read through a rendering service).
- **Reference files**: PDF, Word, PowerPoint, Excel, text and images, up to 6 files and 3 MB per brief. A PDF too big to send whole goes as its text (the chip says "text only"). The deck is about the material: the brief decides length, angle and which organisations to feature.
- **Charts**: seven chart slides, values as real numbers (the chart scales to the largest): columns beside a legend, donut, and five full-width ones for data that comes out of a spreadsheet: columns for up to thirty categories, horizontal bars for a ranking, a line chart with up to three lines, grouped columns to compare two or three measures, stacked columns for a composition. Click the chart to edit its data; series are named in the same panel.
- **Spreadsheets**: an Excel file becomes one table per sheet (dates and percentages as you see them in Excel, 200 rows a sheet), and a dialog opens with the questions that file raises: the model reads the sheet and asks which sheet or columns lead, which comparison to draw, which figure to headline, which span to show, with the choices quoted from the file. Answers steer the charts and stats; skip them and the sheet is read against the brief alone. The row under the chip reopens the questions. Any other file (PDF, Word, PowerPoint, text) is read the same way, but asks only when something is unclear: a report with several countries and no word on which one, two scenarios side by side. A clear document asks nothing.
- **Template switch** (Digital Inclusion only, and only on an empty deck; hidden for now behind `SHOW_TEMPLATE_SWITCH` in the sidebar while the two-pager is finished, saved two-pagers still open): Slides, or Two-pager. A two-pager page is a vertical stack of blocks at A4 — title, labelled text, status callout, stat cards, icon columns, photo cards, two columns, figure, screens, table, numbered asks, contacts. "Add page" starts from a preset composition; inside a page you add, remove and reorder blocks. Everything else behaves the same: inline editing, ✕ to delete an element, duplicate, reorder, undo, regenerate with AI, and per-slot image upload.
- **Chapters toggle** (in the prompt box next to Generate, off by default): off, the deck is generated with no agenda slide and no section dividers, for when that structure is more than the story needs. It is an input to Generate, not a view option: it shapes the next generation and never edits the deck on screen, and the sidebar says so when the two disagree. A brief that asks for fewer than eight slides is generated without chapters whatever the toggle says, and the sidebar says that too.
- **Change layout** (hidden for now, `SHOW_LAYOUT_SWITCH`): "Layout" in the slide bar opens a picker with the slide itself, text and photo included, rendered in every other layout of the template that takes the same content, photo layouts first. No AI call: a pick is instant and undoable. Badges say when a layout shows fewer items ("2 of 4 items") or had to shrink the text. Moving to a different kind of slide (numbers, prose) is Edit with AI's job.
- **List slide**: up to six labelled points in rows (KR1, KR2, ...), the layout the AI picks when a brief hands over a list per slide, and one the layout switcher offers.
- **The brief sets the length and the structure**: "six slides", "a 20-page deck", "10 diapositive" is honoured exactly, and "one slide per objective, titled with the objective" is followed to the letter, no item dropped. The layouts of such a series alternate by point count (a photo layout for one or two points, cards or columns for three or four, rows for more).
- **Generation**: GPT-6 Luna returns structured JSON (`layoutId` + text fields) via a streaming API route — slides appear one by one. Fast and cheap (~$0.01 per 12-slide deck).
- **Logo lockups** change the footer logo and the footer label, never the colors. UNICEF, Digital Impact Division and Digital Inclusion all run on two surfaces only, UNICEF cyan `#01AEEF` and white; the retired Giga lockup keeps the Giga blue palette so decks saved with it still render as they were. The one exception is the donut chart, whose segments take the UNICEF Brand Book secondary colours; and on any chart, the Data panel lets you give a bar or a segment one of sixteen brand colours by hand. The typography (Manrope + Open Sans, self-hosted) never changes.
- **Layout variants**: card and stat layouts adapt to their element count (1 to 4 cards, 1 to 6 stats, 2 to 5 timeline points…) — both when the AI picks a count and when you edit.
- **Light and dark**: the switch next to "How it works" picks system, light or dark for the editor chrome (slides are never affected). Remembered per browser.
- **Desktop only**: on a screen narrower than 1024px the editor is replaced by a short notice with a Copy link button. The tool needs the width; people who opened it on a phone reported it as broken.
- **Deck name**: the toolbar starts with the deck's name, "New deck" until you click it and type another. It is the file name of every download and travels inside the HTML deck, so it comes back on Upload.
- **Editing**: click any text on the slide to edit it (Escape cancels). Hover an element for ✕ to delete it, "+ Element" adds one back. Undo/redo with Cmd+Z / Cmd+Shift+Z or the toolbar arrows. Thumbnails: reorder, duplicate, delete. "Regenerate slide" rewrites the active slide with an instruction. The deck autosaves to localStorage as you work.
- **Opening the app**: always on an empty editor. The autosave is a safety net, not a session that resumes on its own, so the deck from last time waits on a "Last session" card on the empty state, with Open and Discard. Only the logo lockup and the Chapters setting carry over.
- **Product tour**: "How it works" in the sidebar walks the brief, the Chapters toggle and Generate, and, once a deck exists, the canvas, the slide bar, Add slides and Download. It never starts on its own. Above the button, after a generation, a small card with a party popper says what it cost (Haiku list price) and how long it took; the session total is in its tooltip.
- **Download PDF**: browser print (Chrome, backgrounds on, scale 100%) — one slide per page at 1920×1080, or one A4 sheet per page for a two-pager.
- **Download HTML deck**: one self-contained file (fonts and logos inlined) with arrow-key navigation and the template's entrance animations. The same file is the project file: it carries the deck's data model in an inert JSON block. A two-pager downloads instead as a scrolling A4 document that prints to the same PDF — still the save file.
- **Image picker**: "Image" in the slide bar (or a click on the photo) opens Upload, Library (Giga's own photos, served from the app and inlined on export) and Maps (a country map rendered live from Giga Maps data).
- **Upload**: drop an exported HTML deck on the canvas, or use "Upload HTML" in the toolbar next to Download, to pick up where you left off — slides, logo, brief and the Chapters setting all come back. Replacing a deck that is on screen asks first. Decks exported before this existed can still be presented, they just cannot be reopened.

## Setup

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

Deploy on Vercel with `OPENAI_API_KEY` as an environment variable.

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
components/Tour.tsx           the spotlight tour, driven by data-tour attributes
app/api/generate/route.ts     NDJSON streaming route (gpt-6-luna, Responses API)
```

Layouts `tiers-1` and `tiers-2` are manual-insert only (dense approved content the model shouldn't rewrite); table cells are not inline-editable in v1.

Source template: `Giga Slides.dc.html` (2026-07, supersedes `Giga Partnership Template.dc.html`). Logos and fonts come from the brand-asset repo (gigabrand.vercel.app).
