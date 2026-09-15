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

- **The palette is ChatGPT's light theme, verbatim, minus its accent.** Every value in the front matter was read off chatgpt.com's CSS variables on 15 Sep 2026: text primary/secondary/tertiary, sidebar `#FCFCFC`, tertiary surface `#F3F3F3`, borders at 10% and 5% black, hover at 5% black, control grey `#E3E3E3`, scrim at 50%, and the error trio. The one substitution is the accent: their `#3A83F7` is Giga Blue `#277AFF` here. Do not tune these by eye; if ChatGPT changes, re-read them.
- **One accent.** Giga Blue is spent on few things: the primary action (Generate, Download, Next), "Edit with AI", the active Chapters pill, attachment chips, links. Hover and selection on everything else are Mist (5% black), never a blue tint. Status red is for destructive and error only, always with text.
- **No black background.** Ink is text, icon and border color; the 50% scrim under modals is the only place it covers a surface. Active thumbnails and picked layouts use an Ink border, not the accent.
- **Flat by default.** Buttons carry no shadow. `shadow-stripe` (a 5% ring plus a whisper) sits on the composer and on white pills over grey; `shadow-float` lifts menus and the slide bar; `shadow-stripe-lg` is for modals and the slide on the stage. All shadows are neutral. Nothing glows, nothing bobs.
- **Inter, regular.** The chrome is Inter (variable, self-hosted in `public/fonts`), weight 400 by default. Buttons, labels and thumbnail badges are 500; the empty-state headline and modal titles are 500 or 600. No negative tracking, no uppercase labels. Section labels are 13px, regular, Faint Ink, like ChatGPT's "Recents". Slides keep Manrope and Open Sans, which never appear in the chrome, and Inter never appears on a slide.
- **Buttons are pills.** Primary: Giga Blue fill, white text, hover deepens to `#0050E6`, `:active` scales 0.98, no shadow. Secondary: white fill, hairline border, Ink text, hover washes Mist. Tertiary (icon and text buttons): no border, hover washes Mist.
- **Selects are settings rows** (`components/Select.tsx`): the label on the left, the current value and a chevron on the right as a borderless text button, a 5% hairline under the row. The menu is a white card, 16px radius, `shadow-menu` (ChatGPT's: a soft 8px drop plus a 1px outline at 62%), 220px minimum, 36px options at 10px radius with a 4% wash on hover and on the selected one, which also carries a tick on the right. The Download menu uses the same card. Never a native `<select>`: its popup is the one thing the chrome cannot style.
- **Segmented controls** are a Mist track with the selected option as a white pill with `shadow-stripe`.
- **Inputs.** White surface, hairline border, 8px radius, Ink text, Faint Ink placeholder. Focus: Giga Blue border plus a soft 3px ring at low alpha.
- **Motion.** 150-250ms, ease-out, state-conveying only. No entrance choreography in the chrome.

## Editor-specific vocabulary

- **Shell.** White stage between two Canvas rails: the sidebar (340px) and the filmstrip (200px), each separated from the stage by a 5% hairline. The slide preview sits on the stage with `shadow-stripe-lg` and 12px radius.
- **Composer** (`components/PromptBox.tsx`). One 28px-radius white surface with a 5% border and `shadow-stripe`; focus deepens the shadow and takes the border to 10%, no colored ring. Text on top and grows with it (up to 280px, then scrolls); attachment chips under the text; a bottom bar with the "+" (attach) on the left and, on the right, the Chapters pill toggle and the Generate button: a 36px Giga Blue circle with an arrow, always the same shape (the tooltip says Regenerate once a deck exists), with a spinner while generating. ⌘↵ generates. Nothing sits under it: the tour and the placeholder carry the guidance.
- **Toolbar.** White band with bottom hairline. Slide counter in Inter 500 Ink; layout name as a Mist chip in Muted Ink; icon buttons are borderless and wash Mist on hover.
- **Filmstrip thumbnails.** 8px radius, 2px border: Ink when active, hairline otherwise. Index badge is a white chip with Ink text. Hover actions are white chips that turn Ink on hover. The add tile is a dashed hairline box that washes Mist.
- **Slide bar.** A white pill with a hairline border and `shadow-float`, centered under the slide. "Edit with AI" is the one accent-colored item in it.
- **Empty state.** An Inter headline ("What deck are we making?") over two lines of Muted Ink body, nothing else. The last-session card is a white card with a hairline border.
