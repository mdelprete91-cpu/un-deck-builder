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
  hairline: "#E6E6E6"
  canvas: "#F9F9F9"
  mist: "#F0F0F0"
  mist-deep: "#E3E3E3"
  surface: "#FFFFFF"
  status-red: "#ED1C24"
typography:
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
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

- **One accent.** Giga Blue `#277AFF` is the only accent, and it is spent on few things: the primary action (Generate, Download, Next), the "Edit with AI" entry, the active Chapters pill, attachment chips, links. Hover and selection on everything else are grey (`mist`), never a blue tint. Red `#ED1C24` is for destructive/error only, always paired with text.
- **Neutral greys, no blue cast.** Text is Ink `#0D0D0D`, secondary text Muted Ink `#5D5D5D`. Surfaces: the stage is white; the sidebar and the filmstrip are Canvas `#F9F9F9`; hover and selected rows are Mist `#F0F0F0`. No black or near-black *background* anywhere: Ink is a text and border color, and the 40% overlay under modals is the only place it covers a surface.
- **Hairline borders** `#E6E6E6`, 1px only. Active thumbnails and picked layouts use an Ink border, not the accent.
- **Flat by default.** Buttons carry no shadow. `shadow-stripe` (a whisper) sits on the composer and on white pills over grey; `shadow-float` lifts menus and the slide bar; `shadow-stripe-lg` is for modals and the slide on the stage. All shadows are neutral. Nothing glows, nothing bobs.
- **Labels are quiet.** Sidebar section labels and modal titles at small size are Manrope 600, 12px, sentence case, Muted Ink. No uppercase tracking.
- **Typography.** Manrope 500-700 with negative tracking for headings/labels/buttons; Open Sans for body and inputs. No third typeface.
- **Buttons are pills.** Primary: Giga Blue fill, white text, hover deepens to `#0050E6`, `:active` scales 0.98, no shadow. Secondary: white fill, hairline border, Ink text, hover washes Mist. Tertiary (icon and text buttons): no border, hover washes Mist.
- **Segmented controls** are a Mist track with the selected option as a white pill with `shadow-stripe`.
- **Inputs.** White surface, hairline border, 8px radius, Ink text, Muted Ink placeholder. Focus: Giga Blue border plus a soft 3px ring at low alpha.
- **Motion.** 150-250ms, ease-out, state-conveying only. No entrance choreography in the chrome.

## Editor-specific vocabulary

- **Shell.** White stage between two Canvas rails: the sidebar (340px) and the filmstrip (200px), separated by hairlines. The slide preview sits on the stage with `shadow-stripe-lg` and 12px radius.
- **Composer** (`components/PromptBox.tsx`). One 24px-radius white surface with `shadow-stripe`; focus deepens the shadow and darkens the border, no colored ring. Text on top and grows with it (up to 280px, then scrolls); attachment chips under the text; a bottom bar with the "+" (attach) on the left and, on the right, the Chapters pill toggle and the Generate button: a 36px Giga Blue circle with an arrow, which widens into a "Regenerate" pill once a deck exists and shows a spinner while generating. ⌘↵ generates. Nothing sits under it: the tour and the placeholder carry the guidance.
- **Toolbar.** White band with bottom hairline. Slide counter in Manrope 600 Ink; layout name as a Mist chip in Muted Ink; icon buttons are borderless and wash Mist on hover.
- **Filmstrip thumbnails.** 8px radius, 2px border: Ink when active, hairline otherwise. Index badge is a white chip with Ink text. Hover actions are white chips that turn Ink on hover. The add tile is a dashed hairline box that washes Mist.
- **Slide bar.** A white pill with a hairline border and `shadow-float`, centered under the slide. "Edit with AI" is the one accent-colored item in it.
- **Empty state.** A Manrope headline ("What deck are we making?") over two lines of Muted Ink body, nothing else. The last-session card is a white card with a hairline border.
