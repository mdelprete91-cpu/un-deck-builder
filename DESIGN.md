---
name: Giga Deck Builder
description: Editor chrome for the AI deck builder. A neutral, flat chrome in the register of a chat product, with Giga Blue as its one accent.
colors:
  giga-blue: "#277AFF"
  giga-blue-deep: "#0050E6"
  giga-blue-100: "#D4E5FF"
  giga-blue-tint: "#EAF2FF"
  ink: "#0D0D0D"
  muted-ink: "#5D5D5D"
  faint-ink: "#8F8F8F"
  hairline: "rgba(0,0,0,0.10)"
  hairline-light: "rgba(0,0,0,0.05)"
  canvas: "#FCFCFC"
  canvas-2: "#F3F3F3"
  mist: "rgba(0,0,0,0.05)"
  mist-deep: "#E3E3E3"
  scrim: "rgba(0,0,0,0.50)"
  surface: "#FFFFFF"
  status-red: "#FF002A"
  status-red-bg: "#FFF0F0"
  status-red-border: "#FFE1E0"
typography:
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    letterSpacing: "0"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    letterSpacing: "0"
rounded:
  md: "8px"
  chip: "16px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.giga-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  eyebrow:
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
---

# Design System: Giga Deck Builder (editor chrome)

The chrome is neutral and flat, in the register of a chat composer: white and warm grey surfaces, hairline borders, near-black text, one accent. It says as little as possible so the slides, which carry the brand, are the only colored thing on screen. This file governs the editor chrome only; slide content follows the "Giga Slides" template renderers in `lib/slides/layouts/`.

## Rules

- **Two themes, both ChatGPT's, verbatim.** The dark values (read off chatgpt.com on 18 Sep 2026) sit in `.dark` in globals.css: text `#FFFFFF` / `#CDCDCD` / `#AFAFAF`, surface `#212121`, sidebar and stage `#000000`, secondary `#303030`, borders at 15% and 5% white, hover at 10% white, control `#676767`, error `#FF8583` on `#4D100E`. Giga Blue stays; its tints become blue at 18% and 28% so chips still read. Every surface in the chrome is a token (`bg-surface`, never `bg-white`; `bg-mist`, never `bg-black/…`), which is what makes the theme a variable swap. Slides never follow the theme. The switch is `components/ThemeToggle.tsx`, next to How it works: a 36px pill on Canvas-2 holding three 28px icon segments (Monitor, Sun, Moon: system, light, dark), the selected one on Surface with `shadow-stripe`; a radiogroup, arrow keys move it. `next-themes` applies the class before first paint and follows the OS while on system; a new browser opens in dark (Mario, 25 Sep 2026), the switch still offers system and light.
- **The palette is ChatGPT's light theme, verbatim, minus its accent.** Every value in the front matter was read off chatgpt.com's CSS variables on 15 Sep 2026: text primary/secondary/tertiary, sidebar `#FCFCFC`, tertiary surface `#F3F3F3`, borders at 10% and 5% black, hover at 5% black, control grey `#E3E3E3`, scrim at 50%, and the error trio. The one substitution is the accent: their `#3A83F7` is Giga Blue `#277AFF` here. Do not tune these by eye; if ChatGPT changes, re-read them.
- **One accent.** Giga Blue is spent on few things: the primary action (Generate, Download, Next), the active Chapters pill, attachment chips, links. Hover and selection on everything else are Mist (5% black), never a blue tint. Status red is for destructive and error only, always with text.
- **No black background.** Ink is text, icon and border color; the 50% scrim under modals is the only place it covers a surface. Active thumbnails and picked layouts use an Ink border, not the accent.
- **Flat by default.** Buttons carry no shadow. `shadow-stripe` (a 5% ring plus a whisper) sits on the composer and on white pills over grey; `shadow-float` lifts menus and the slide bar; `shadow-stripe-lg` is for modals and the slide on the stage. All shadows are neutral. Nothing glows, nothing bobs.
- **Inter, regular.** The chrome is Inter (variable, self-hosted in `public/fonts`), weight 400 by default. Buttons, labels and thumbnail badges are 500; the empty-state headline and modal titles are 500 or 600. No negative tracking, no uppercase labels. Section labels are 13px, regular, Faint Ink, like ChatGPT's "Recents". Slides keep Manrope and Open Sans, which never appear in the chrome, and Inter never appears on a slide.
- **One button, in `components/Button.tsx`.** Every button in the chrome is that component: 36px tall, Inter 14px medium, 12px side padding, a 14px Lucide icon with a 6px gap, icon-only ones 36px squares. Variants (primary, secondary, ghost, danger, accent) change colour and border only; `className` carries layout, never size. Raw `<button>` elements survive only as selection tiles (layout cards, icon grid), list rows (menus, country list) and the 20px chip remove. If a control needs another size it is not a button.
- **Buttons are pills.** Primary: Giga Blue fill, white text, hover deepens to `#0050E6`, `:active` scales 0.98, no shadow. Secondary: white fill, hairline border, Ink text, hover washes Mist. Tertiary (icon and text buttons): no border, hover washes Mist.
- **Selects are settings rows** (`components/Select.tsx`): the label on the left, the current value and a chevron on the right as a borderless text button, a 5% hairline under the row. The menu is a white card, 16px radius, `shadow-menu` (ChatGPT's: a soft 8px drop plus a 1px outline at 62%), 220px minimum, 36px options at 10px radius with a 4% wash on hover and on the selected one, which also carries a tick on the right. The Download menu uses the same card, with bare labels (PDF, HTML deck, PowerPoint) and one tag on HTML deck, "To save locally" in the accent tint, because that is the file that comes back through Upload HTML. Never a native `<select>`: its popup is the one thing the chrome cannot style.
- **Segmented controls** are a Mist track with the selected option as a white pill with `shadow-stripe`.
- **Inputs.** White surface, hairline border, 8px radius, Ink text, Faint Ink placeholder. Focus: Giga Blue border plus a soft 3px ring at low alpha.
- **Motion.** 150-250ms, ease-out, state-conveying only. No entrance choreography in the chrome.
- **Icons are Lucide, only Lucide.** `lucide-react` in the chrome, the `lucide` markup (`lucideSvg` in `lib/slides/icons.ts`) for the buttons SlideFrame injects into a slide. No hand-drawn SVG, no text glyphs standing in for icons; where Lucide has no fitting icon, the control is text.

## Editor-specific vocabulary

- **Shell.** White stage between two Canvas rails: the sidebar (340px) and the filmstrip (200px), each separated from the stage by a 5% hairline. The slide preview sits on the stage with `shadow-stripe-lg` and 12px radius.
- **Sheet wizard** (`components/SheetWizard.tsx`). The image picker's box (576px, 24px radius, `shadow-float`, the scrim, `pop-in`) walking the questions a spreadsheet raised, one per step: the file name as the title with the sheet glyph in Giga Blue; the model's summary in Muted Ink; a 13px Faint Ink "Question 2 of 5 · 1 answered" line over a 4px Canvas-2 track with a Giga Blue fill; the question at 16px medium, its "why" at 13px Muted Ink; options as 40px rows with a 16px circle (single) or 4px-radius square (multi) at the left, Mist on hover, Giga tint with the accent-filled control and a white tick when picked; a text question is the standard textarea. Footer: Skip as ghost on the left, Back (secondary) and Next/Done (primary, arrow or tick) on the right; ⌘↵ advances, Esc closes and keeps the answers. While the sheet is read the body is a Canvas-2 skeleton in the shape of a question, and the only control is "Skip for now".
- **Composer** (`components/PromptBox.tsx`). One 28px-radius white surface with a 5% border and `shadow-stripe`; focus deepens the shadow and takes the border to Giga Blue with the same soft 3px ring as every input, so "Create new" (which focuses the box) visibly lands there in both themes (Mario, 22 Sep 2026). Text on top and grows with it (up to 280px, then scrolls), links in it drawn in Giga Blue by a mirror under the textarea; attachment chips under the text, and under a spreadsheet chip a Canvas row (`components/SheetInsights.tsx`, 16px radius, light hairline) that says where the sheet's questions stand ("Reading the sheet…", "5 questions to answer", "2 of 5 answered") with a ghost Answer/Edit button that opens the wizard; a bottom bar with the "+" (attach) on the left and, on the right, the Chapters pill toggle and the Generate button: a 36px Giga Blue circle with an arrow, always the same shape (the tooltip says Regenerate once a deck exists), with a spinner while generating. ⌘↵ generates. Nothing sits under it: the tour and the placeholder carry the guidance.
- **Toolbar.** White band with bottom hairline. The deck name on the left (`components/DeckName.tsx`): Inter 500 Ink at 16px in a 36px borderless pill that washes Mist on hover and turns into a 36px hairline input on click, Giga Blue border and soft ring on focus. Everything else sits right-aligned in one row of Buttons: Undo, Redo, Upload HTML (secondary), Download (primary).
- **Filmstrip thumbnails.** 8px radius, 2px border: Ink when active, hairline otherwise. Index badge is a white chip with Ink text. Hover actions are white chips that turn Ink on hover. The add tile is a dashed hairline box that washes Mist.
- **Slide bar.** A white pill (10px padding, 8px gaps, 5% hairline, `shadow-float`) centered under the slide. It morphs between its modes rather than swapping: the width transitions over 320ms (ease-out-expo) from the measured content, and the new controls fade up 60ms later, 40ms apart (`.bar-morph`, `.bar-mode`; static under reduced motion). Every action is a Button: "Edit with AI" in the primary variant (plain Giga Blue like every primary action; the gradient, ring and sheen tried on 17 Sep 2026 were all turned down), then only the actions that apply to this slide (Element, Data, Image; Layout exists but is hidden behind `SHOW_LAYOUT_SWITCH`), then a slightly wider gap and the icon-only pair, Duplicate and Delete (danger). While the AI works the bar shows one accent pill with a spinner. The instruction field, once open, is a 36px bare input followed by a primary 36px circle with an arrow (the same send shape as the composer, enabled when there is text) and a ghost close.
- **Image picker.** One narrow dialog, 576px wide, 24px radius, `shadow-float`, no taller than its content (the 1024x540 rail-and-panel version wasted its width, Mario, 24 Sep 2026). The title "Image" with the close at its right, then the sections as a segmented control (a Canvas-2 track, the current one a white pill with `shadow-stripe`, Lucide icon plus label), then the section. It opens on Upload: a 16:9 Canvas-2 frame holding the icon, one line and Choose a photo (primary). Library is Giga's own photos (`lib/slides/library.ts`, thumbnails in `public/library/thumbs`) three to a row as 16:9 tiles with 12px radius, a hairline ring on hover, an Ink ring on the one already on the slide, no captions (the label is the tooltip); a click applies and closes. Maps is three settings rows (Country, Show, Style: label left, value and chevron right, hairline between) with one status line, then the preview at full width inside a fixed 16:9 frame on Canvas-2, the map contained in it whatever the slot's shape, so the dialog never changes shape between layouts; under it Cancel (ghost) and Use this map (primary). A slot that already holds a photo opens on a "Current" section: the image in the same frame, Remove image (danger) and Replace with a photo (primary). Clicking a photo on the slide (a press without a drag) opens the picker for that slot; clicking a chart opens the Data panel.
- **Colour picker** (`components/ColorPicker.tsx`). In the Data panel, one 20px swatch per row in a 36px round hit area: a hollow ring while automatic, the colour once picked. It opens a menu card holding the sixteen chart colours as 24px circles in a 4x4 grid, a tick on the chosen one, and an Automatic row underneath. Same card, radius and `shadow-menu` as every other menu.
- **Generation readout** (`components/GenerationReadout.tsx`). Above the How it works row once a deck has been generated: a Canvas-2 card, 12px radius, holding Lucide's party popper in Giga Blue (`PartyPopperIcon.tsx`, its strokes fly in with `motion` once per run and on hover) beside "Deck generated" in Inter 500 Ink and the cost and time in Muted Ink. The only animated icon in the chrome; it marks the one moment worth a small celebration.
- **Small screens.** Under 1024px (`lg`) the editor is covered by `components/MobileGate.tsx`: a Canvas screen with a Monitor icon, "Giga Deck Builder works on desktop", one line of Muted Ink body and a secondary Copy link button that reads "Link copied" for two seconds. Gated by viewport width in CSS, never by user agent, so turning a tablet or widening a window brings the editor back with nothing lost.
- **Empty state.** An Inter headline ("What deck are we making?") over one short line of Muted Ink body, then Create new and Open HTML deck (the drop hint lives in its tooltip), with one Faint Ink line under them saying only HTML decks downloaded from here can be reopened. No illustration: the chrome's only pictures are Lucide icons. The last-session offer is one row: a History icon, the deck title with its slide count, then Discard (ghost) and Open (primary) inline; a full pill (`rounded-full`), white, 5% border, `shadow-float`.
