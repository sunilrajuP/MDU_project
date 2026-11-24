---
name: responsive-layout
description: Use when building or changing screens/layouts. Mobile-first with tablet two-pane adaptation and office desktop support, touch-first and glare-friendly.
---

# Responsive layout (mobile + tablet)

## Breakpoints (tokens)
`base` ≥360 (phone) · `tablet` ≥768 · `desktop` ≥1024 (Manager/office). Write base styles for mobile, enhance upward with `@include bp(tablet)`.

## Patterns
- **AppShell:** header (title, `SyncStatusBadge`, progress) + content + `BottomActionBar` (phone) / inline action footer (tablet).
- **Runbook:** phone = vertical stepper screen with a big *Continue*; tablet = left rail (steps/floors) + right work area.
- **Floor survey:** phone = floor selector sheet → item cards; tablet = floor list + checklist + plan preview.
- **Canvas screens (markup, floor plan):** full-bleed, toolbars collapse to a bottom/side palette, large hit areas, pinch-zoom + pan, no page scroll under the canvas.
- **Manager screens:** table on desktop, card list on phone.

## Rules
- Touch target ≥ `--size-touch-min` (44 px); spacing between targets ≥ `--space-2`.
- Respect `env(safe-area-inset-*)`; use `dvh` not `vh`.
- Orientation change must not reset state/zoom.
- Never rely on hover. Never colour-only status — icon + label.
- Test at 360×640, 768×1024, 1024×768, 1280×800.
- Long forms are split into steps; one primary action per screen.
