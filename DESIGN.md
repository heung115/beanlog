---
version: alpha
name: beanmap Coffee Journal
description: A restrained, editorial design system for a private coffee tasting journal.
colors:
  primary: "#211D19"
  primary-soft: "#4F4842"
  secondary: "#6F665E"
  accent: "#8A4B2B"
  accent-soft: "#C7A68F"
  neutral: "#F4F0E8"
  neutral-strong: "#E8E0D4"
  surface: "#FCFAF5"
  surface-warm: "#EEE6DA"
  border: "#D4CABC"
  border-light: "#E5DDD2"
  on-primary: "#FFFFFF"
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
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.02em
  display-lg:
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 1.875rem
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.02em
  heading-md:
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.35
  body-md:
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: SUIT Variable, SUIT, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
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
  content-max-width: 72rem
rounded:
  sm: 0.125rem
  md: 0.125rem
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
    rounded: "{rounded.sm}"
    padding: 0.125rem 0.5rem
  filter-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 0.375rem 0.75rem
---

# beanmap Design System

## Overview

beanmap is a personal coffee journal, not a marketplace or an operational dashboard. Its visual language combines the restraint of an editorial notebook with the clarity of a modern data tool. Screens should feel calm and deliberate while remaining fast to scan on mobile.

The primary audience records coffee immediately after drinking it and later returns to compare origins, processes, scores, and tasting impressions. The interface should therefore prioritize quick entry, legible metadata, and the user's own notes over decorative content.

The source of truth for implementation is this document together with the Tailwind v4 theme in `src/app/globals.css`. When legacy files disagree, use the tokens in this document and migrate the legacy value deliberately instead of adding another near-duplicate.

## Colors

The default palette uses uncoated-paper neutrals with espresso ink and a restrained terracotta accent. It should feel like a well-kept tasting folio rather than a dashboard or a nostalgic coffee-shop theme.

- **Primary (`#211D19`)** is espresso ink. Use it for core text, primary actions, active navigation, and the strongest rules.
- **Primary soft (`#4F4842`)** supports secondary text and primary hover states.
- **Secondary (`#6F665E`)** is for captions and metadata that must remain readable but visually quiet.
- **Accent (`#8A4B2B`)** is a dry terracotta used for focus, selection, map marks, links, and score emphasis. It is not a general decorative fill.
- **Neutral (`#F4F0E8`)** is the paper canvas; **surface (`#FCFAF5`)** and **surface warm (`#EEE6DA`)** create shallow folio layers.
- Borders (`#D4CABC`, `#E5DDD2`) create hierarchy before shadows are introduced.
- Process and roast colors communicate coffee-domain categories only. Never reuse them as generic status colors. On pale category fills, use espresso-brown text rather than the category hue so compact labels meet WCAG AA.
- Error red is reserved for destructive actions and validation failures.

All normal-sized text must meet WCAG AA contrast. Do not place secondary ink, accent-soft, or category colors on pale surfaces as body text without checking contrast.

The operator selects the palette through `BEANMAP_THEME=mist|cream|contrast`. `mist` is the default. This is a deployment setting; never expose it as a user preference or add a theme switcher to the interface.

## Typography

Display, body, and interface typography use the self-hosted **SUIT Variable** family with system sans-serif fallbacks. Weight, scale, spacing, rules, and surface contrast create hierarchy without switching typefaces. Data numerals use tabular figures or the monospace stack.

Reserve bold display type for meaningful hierarchy. A screen should usually have one dominant title; avoid making every card label look like a headline.

## Layout

beanmap is mobile-first. The shared editorial canvas is capped at `72rem`, with a `1rem` mobile gutter and a `1.5rem` desktop gutter. Detail and form content use narrower reading widths when that improves focus.

Spacing follows a 4px base rhythm, with 8px, 12px, 16px, 24px, 32px, and 48px as the preferred steps. Use smaller steps inside a component and larger steps between conceptual sections. Do not compensate for unclear hierarchy by wrapping every group in another card.

Desktop navigation lives in the top bar. Mobile navigation stays fixed at the bottom and must preserve safe-area padding. Primary actions and important state must remain reachable and understandable at narrow widths.

## Elevation & Depth

Depth comes primarily from tonal surfaces, borders, and a stronger top or left rule. Default content panels are flat. One offset paper shadow may identify an important sheet, form, or toolbar; floating navigation and transient overlays may use a shallow neutral shadow.

Use `journal-panel` for ordinary contained content, `journal-panel-feature` for one emphasized area, and `journal-panel-quiet` for subordinate information. Avoid stacking framed panels inside framed panels.

Motion is restrained. The standard entrance is a short rise-and-fade of roughly 450ms with a decelerating curve. Interaction feedback should be approximately 150–200ms. Motion must never delay data entry or obscure loading state.

## Shapes

The shape language is restrained and editorial rather than playful. Content panels, controls, labels, and inset regions use a near-square 2px radius. Hierarchy should come from spacing, type, rules, and tonal surfaces instead of soft card silhouettes.

Pills are not a default container. Reserve circles for controls whose meaning or mechanics are inherently circular, such as avatars, slider thumbs, chart points, and loading indicators. Domain charts and icons should use simple strokes and geometric shapes that match the existing navigation icons.

## Components

- **Buttons:** Primary buttons use the espresso fill with cream text. Secondary buttons are transparent with a visible border. Ghost buttons are for low-priority actions. Only destructive actions use red.
- **Inputs:** Inputs use the surface token, a one-pixel neutral border, 2px radius, and accent focus treatment. Labels remain outside the control. Placeholder text must be visibly subordinate but legible.
- **Journal panels:** Use the surface token for standard panels and the quieter surface token for subordinate content. Prefer borders and spacing to drop shadows.
- **Bean cards:** Lead with bean name and score, then roastery and origin. Process, roast, and type are supporting metadata. Notes and tasting tags must not overpower identity and score.
- **Badges and filter controls:** Badges describe data and use compact, near-square labels; filters change a query and use the same low rectangular control language as other inputs. An active filter uses the primary fill. Category colors must keep consistent meanings across lists, detail pages, forms, and charts.
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
