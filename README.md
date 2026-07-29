# Giga Deck Builder

Generate branded slide decks from a prompt. The AI never designs slides: it picks layouts from the approved **Giga Partnership Template** (27 layouts, 1920×1080) and fills in the text. You edit inline, reorder, and export.

## How it works

- **Sidebar**: prompt box, brand style (Giga / UNICEF / Digital Impact Division), slide count, generate.
- **Generation**: Claude Haiku 4.5 returns structured JSON (`layoutId` + text fields) via a streaming API route — slides appear one by one. Fast and cheap (~$0.01 per 12-slide deck).
- **Brand styles** change accent colors, the footer logo, and the footer label. Typography (Manrope + Open Sans, self-hosted) never changes.
- **Layout variants**: card and stat layouts adapt to their element count (1 to 4 cards, 1 to 6 stats, 2 to 5 timeline points…) — both when the AI picks a count and when you edit.
- **Editing**: click any text on the slide to edit it (Escape cancels). Hover an element for ✕ to delete it, "+ Element" adds one back. Undo/redo with Cmd+Z / Cmd+Shift+Z or the toolbar arrows. Thumbnails: reorder, duplicate, delete. "Regenerate slide" rewrites the active slide with an instruction. Deck autosaves to localStorage.
- **Export PDF**: browser print (Chrome, backgrounds on, scale 100%) — one slide per page at 1920×1080.
- **Export HTML deck**: one self-contained file (fonts and logos inlined) with arrow-key navigation and the template's entrance animations.

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
  brand.ts      the three brand themes (colors, logos, footer label)
  layouts/      one HTML-string renderer per layout, markup verbatim from the template
  prompt.ts     system prompt + JSON output schema (output_config.format)
  parse.ts      incremental JSON scanner → slides stream in one by one
  export-html.ts  standalone deck serializer
app/api/generate/route.ts   NDJSON streaming route (claude-haiku-4-5)
```

Layouts `tiers-1`, `tiers-2`, and `leveraging-action` are manual-insert only (dense approved content the model shouldn't rewrite); table cells are not inline-editable in v1.

Source template: `Giga Slides.dc.html` (2026-07, supersedes `Giga Partnership Template.dc.html`). Logos and fonts come from the brand-asset repo (gigabrand.vercel.app).
