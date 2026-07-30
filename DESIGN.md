---
version: alpha
name: Beanlog Coffee Journal
description: A warm, editorial design system for a private coffee tasting journal.
colors:
  primary: "#3E2F23"
  primary-soft: "#6B5744"
  secondary: "#735E47"
  accent: "#865D42"
  accent-soft: "#C4A882"
  neutral: "#FAF7F2"
  neutral-strong: "#F3EDE4"
  surface: "#FFFFFF"
  surface-warm: "#FDFBF8"
  border: "#E8E0D5"
  border-light: "#F0EBE3"
  on-primary: "#FAF7F2"
  error: "#B91C1C"
  on-error: "#FFFFFF"
  process-washed: "#7B9EA8"
  process-natural: "#B85C6F"
  process-honey: "#D4A843"
  process-anaerobic: "#8B6BAE"
  process-carbonic: "#5E8B6A"
  process-decaf: "#735E47"
  process-other: "#9B9B9B"
  roast-light: "#C4A882"
  roast-medium: "#8B6B4A"
  roast-dark: "#4A3728"
typography:
  display-xl:
    fontFamily: Playfair Display, Nanum Myeongjo, serif
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Playfair Display, Nanum Myeongjo, serif
    fontSize: 1.875rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  heading-md:
    fontFamily: Playfair Display, Nanum Myeongjo, serif
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.35
  body-md:
    fontFamily: Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
spacing:
  micro: 0.25rem
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  section: 3rem
  page-gutter-mobile: 1rem
  page-gutter-desktop: 1.5rem
  content-max-width: 56rem
rounded:
  sm: 0.375rem
  md: 0.5rem
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    padding: 0.625rem 1rem
  button-primary-hover:
    backgroundColor: "{colors.primary-soft}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    padding: 0.625rem 1rem
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 0.625rem 0.75rem
  journal-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 1.25rem
  badge:
    backgroundColor: "{colors.neutral-strong}"
    textColor: "{colors.primary-soft}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0.125rem 0.625rem
  filter-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0.375rem 0.875rem
---

# Beanlog Design System

## Overview

Beanlog is a personal coffee journal, not a marketplace or an operational dashboard. Its visual language combines the warmth of a paper tasting notebook with the clarity of a modern data tool. Screens should feel calm, tactile, and editorial while remaining fast to scan on mobile.

The primary audience records coffee immediately after drinking it and later returns to compare origins, processes, scores, and tasting impressions. The interface should therefore prioritize quick entry, legible metadata, and the user's own notes over decorative content.

The source of truth for implementation is this document together with the Tailwind v4 theme in `src/app/globals.css`. When legacy files disagree, use the tokens in this document and migrate the legacy value deliberately instead of adding another near-duplicate.

## Colors

The palette is built from warm paper neutrals and coffee browns. Pure white is reserved for focused content surfaces; the page canvas remains cream.

- **Primary (`#3E2F23`)** is espresso brown. Use it for core text, primary actions, active navigation, and the strongest rules.
- **Primary soft (`#6B5744`)** supports secondary text and primary hover states.
- **Secondary (`#735E47`)** is for captions and metadata that must remain readable but visually quiet.
- **Accent (`#865D42`)** indicates focus, selection, links, and restrained highlights. It is not a general decorative fill.
- **Neutral (`#FAF7F2`)** is the application canvas; **surface (`#FFFFFF`)** and **surface warm (`#FDFBF8`)** create shallow tonal layers.
- Borders (`#E8E0D5`, `#F0EBE3`) create hierarchy before shadows are introduced.
- Process and roast colors communicate coffee-domain categories only. Never reuse them as generic status colors. On pale category fills, use espresso-brown text rather than the category hue so compact labels meet WCAG AA.
- Error red is reserved for destructive actions and validation failures.

All normal-sized text must meet WCAG AA contrast. Do not place secondary brown, accent-soft, or category colors on cream or white as body text without checking contrast.

## Typography

Display typography uses **Playfair Display**, falling back to **Nanum Myeongjo** for Korean and then a generic serif. It gives names, page titles, scores, and editorial section headings the character of a tasting journal.

Body and interface typography use **Pretendard**, with system sans-serif fallbacks. Controls, metadata, long notes, and charts should prioritize compact readability. Use tabular numerals for changing scores, totals, prices, percentages, and chart values.

Reserve bold display type for meaningful hierarchy. A screen should usually have one dominant title; avoid turning every card label into a serif headline.

## Layout

Beanlog is mobile-first. The main application column is capped at `56rem`, with a `1rem` mobile gutter and a `1.5rem` desktop gutter. Detail and form content may use a narrower reading width when that improves focus.

Spacing follows a 4px base rhythm, with 8px, 12px, 16px, 24px, 32px, and 48px as the preferred steps. Use smaller steps inside a component and larger steps between conceptual sections. Do not compensate for unclear hierarchy by wrapping every group in another card.

Desktop navigation lives in the top bar. Mobile navigation stays fixed at the bottom and must preserve safe-area padding. Primary actions and important state must remain reachable and understandable at narrow widths.

## Elevation & Depth

Depth comes primarily from tonal surfaces, borders, and a stronger top or left rule. Default content panels are flat. Shadows are allowed only for floating navigation, transient overlays, tooltips, or a subtle hover cue; they must remain warm, low-opacity, and shallow.

Use `journal-panel` for ordinary contained content, `journal-panel-feature` for one emphasized area, and `journal-panel-quiet` for subordinate information. Avoid stacking framed panels inside framed panels.

Motion is restrained. The standard entrance is a short rise-and-fade of roughly 450ms with a decelerating curve. Interaction feedback should be approximately 150–200ms. Motion must never delay data entry or obscure loading state.

## Shapes

The shape language is gently editorial rather than playful. Controls and focused panels use an 8px radius; quieter inset regions may use 6px. Pills and circles are limited to tags, filter chips, avatars, score markers, and compact status-like elements.

Do not introduce large, soft card radii or mixed radius scales. Domain charts and icons should use simple strokes and geometric shapes that match the existing navigation icons.

## Components

- **Buttons:** Primary buttons use espresso brown on cream. Secondary buttons are transparent with a visible border. Ghost buttons are for low-priority actions. Only destructive actions use red.
- **Inputs:** Inputs use a white surface, one-pixel warm border, 8px radius, and accent focus treatment. Labels remain outside the control. Placeholder text must be visibly subordinate but legible.
- **Journal panels:** Use white for standard panels and warm white for quiet panels. Prefer borders and spacing to drop shadows.
- **Bean cards:** Lead with bean name and score, then roastery and origin. Process, roast, and type are supporting metadata. Notes and tasting tags must not overpower identity and score.
- **Badges and filter chips:** Badges describe data; filter chips change a query. An active filter uses the primary fill. Category colors must keep consistent meanings across lists, detail pages, forms, and charts.
- **Charts:** Use the coffee-brown sequence for neutral series and domain category colors for process data. Labels and tooltips use the same typography and surface rules as the rest of the application.
- **Navigation:** The active destination is indicated through color and a rule, not a filled card. The mobile add action may be visually elevated because it is the central workflow.
- **Empty and loading states:** Use quiet line illustrations, concise copy, and one clear next action. Skeletons should reproduce the real content structure without decorative animation beyond a subtle pulse.

## Do's and Don'ts

- Do make recording and recalling a coffee feel more important than application chrome.
- Do reuse the semantic tokens from `src/app/globals.css` and the shared UI components before adding local values.
- Do keep Korean and English layouts resilient to different string lengths.
- Do preserve accessible focus indicators, keyboard operation, touch targets, and reduced-motion expectations.
- Do check new text/background pairs for WCAG AA contrast.
- Don't introduce raw hex colors in components when a semantic token already exists.
- Don't use process or roast colors as generic success, warning, or error indicators.
- Don't add gradients, glassmorphism, heavy shadows, emoji icons, or oversized rounded cards.
- Don't make every section a card; whitespace, typography, and dividers should carry most of the hierarchy.
- Don't change a canonical token in only `DESIGN.md` or only CSS. Update both sources in the same change and run `npm run design:lint`.
