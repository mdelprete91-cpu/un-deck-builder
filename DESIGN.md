---
name: Giga Deck Builder
description: Editor chrome for the AI deck builder, inheriting the Giga "Bright Utility" system from the Brand Asset Generator.
colors:
  giga-blue: "#277AFF"
  giga-blue-deep: "#0050E6"
  giga-blue-100: "#D4E5FF"
  giga-blue-tint: "#EAF2FF"
  ink: "#0A1B3F"
  muted-ink: "#5C7187"
  hairline: "#DDE6F0"
  canvas: "#F7F9FC"
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
    fontSize: "0.625rem"
    fontWeight: 700
    letterSpacing: "0.18em"
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
    textColor: "{colors.giga-blue}"
    typography: "{typography.label}"
---

# Design System: Giga Deck Builder (editor chrome)

Inherits the Brand Asset Generator's "Bright Utility" language, applied at product density. This file governs the editor chrome only; slide content follows the "Giga Slides" template renderers in `lib/slides/layouts/`.

## Rules carried over from the Brand Asset Generator

- **One Voice.** Giga Blue `#277AFF` is the only accent: primary actions, active selection, focus rings, eyebrows. Variety comes from its tints (`#EAF2FF`, `#D4E5FF`, `#0050E6`), never from new hues. Red `#ED1C24` is for destructive/error only, always paired with text.
- **No black, no pure white page.** Text is Ink `#0A1B3F`; the app background is Canvas `#F7F9FC` (blue-tinted near-white); panels are white Surface. Overlay badges are white chips, never black slabs.
- **Hairline borders** `#DDE6F0`, 1px only.
- **Stripe shadows.** `shadow-stripe` at rest on floating panels, `shadow-stripe-md` on primary buttons, `shadow-stripe-lg` on the slide canvas. Depth responds to state, never decorates.
- **The Eyebrow Rule (product scale).** Sidebar section labels are Manrope 700, 10px, uppercase, tracking 0.18em, Giga Blue.
- **Typography.** Manrope 500-700 with negative tracking for headings/labels/buttons; Open Sans for body and inputs. No third typeface.
- **Buttons are pills.** Primary: Giga Blue fill, white text, hover deepens to `#0050E6`, `:active` scales 0.98. Secondary: white fill, hairline border, Ink text, hover washes Giga Blue Tint.
- **Inputs.** White surface, hairline border, 8px radius, Ink text, Muted Ink placeholder. Focus: Giga Blue border plus a soft 3px ring at low alpha. No glow.
- **Motion.** 150-250ms, ease-out, state-conveying only. No entrance choreography in the chrome.

## Editor-specific vocabulary

- **Shell.** Canvas background; sidebar (340px) and filmstrip (200px) are white surfaces separated by hairlines. The slide preview floats on canvas with `shadow-stripe-lg` and 12px radius.
- **Toolbar.** White band with bottom hairline. Slide counter in Manrope 600 Ink; layout name as a Giga Blue Tint chip; icon buttons are small pills with hairline borders and inline SVG glyphs (no emoji).
- **Filmstrip thumbnails.** 8px radius, 2px border: Giga Blue when active, hairline otherwise. Index badge is a white chip with Ink text. Hover actions are white chips that turn Giga Blue on hover.
- **Icon chip (empty state).** 44px square, 16px radius, Giga Blue Tint background, Giga Blue glyph.
