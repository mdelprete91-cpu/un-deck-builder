# Product

## Register

product

> The whole app is an operational tool: an AI deck editor. There is no marketing surface. Every screen uses the product register; the expressive part of the experience is the slide canvas itself, which follows the Giga Slides template, not this file.

## Users

Brand and communications people at Giga, UNICEF, ITU, and partner organizations. They are not designers; they describe a story and the tool picks the right template slides and fills them in. They then tweak text inline, reorder slides, and export. Same audience as the Giga Brand Asset Generator; several of them arrive from it.

## Product Purpose

Generate on-brand presentation decks from a prompt using the official "Giga Slides" template, then let the user refine them with zero design decisions: inline text editing with autofit, add/remove elements, real chart data, image and logo uploads, PDF/HTML export. Success means a partner ships a deck that looks indistinguishable from one made by the design team.

## Brand Personality

Institutional precision with quiet authority, warmed by mission (inherited from the Giga design system, "The Bright Utility"). The editor chrome stays out of the way: calm white surfaces, one voice color (Giga Blue), generous but efficient spacing. The slides are the show; the chrome is the frame.

## Anti-references

- **SaaS hype.** No gradient text, no glow, no glassmorphism, no "magical AI" styling.
- **Black slabs.** No solid black or near-black backgrounds anywhere in the chrome (badges included). Dark surfaces belong to slide content only.
- **Generic Tailwind gray.** The default neutral-100/neutral-500 editor look this app started with is exactly what to avoid: every neutral must be tinted toward the brand blue.
- **Second accent colors.** Giga Blue is the only accent; red exists only for destructive/error states.

## Design Principles

1. The chrome is the frame, the slide is the picture: the editor must never compete with the canvas for attention.
2. One visual system across Giga tools. A user coming from the Brand Asset Generator should feel zero context switch.
3. Utility over decoration. Every control earns its place in the workflow; motion only conveys state.
4. Familiar affordances, exceptional finish: standard editor patterns (sidebar, toolbar, filmstrip) executed with brand-grade craft.

## Accessibility & Inclusion

WCAG 2.1 AA minimum. Never color alone for meaning (errors carry text, states carry labels or titles). Visible focus rings on every control. Motion honors `prefers-reduced-motion` (slide entrance animations already do; chrome transitions stay under 250ms).
