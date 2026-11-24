---
name: scss-design-tokens
description: Use for any styling work. One shared SCSS token source for colors, spacing, type, radius, shadow, z-index, breakpoints; no hard-coded values in components.
---

# SCSS design tokens (single source)

## Layout
```
src/styles/
  tokens/
    _colors.scss  _spacing.scss  _typography.scss
    _radius-shadow.scss  _breakpoints.scss  _z-index.scss
    _index.scss          // @forward all
  _css-vars.scss         // emits :root custom properties from the maps
  _mixins.scss           // bp(), focus-ring(), touch-target()
  global.scss
```

## Authoring
```scss
// _colors.scss
$brand: (
  primary-600: #4b3ace,   // token source — the only place a hex may appear
  ink-brand:   #ffffff,
);
$colors: (
  primary: map.get($brand, primary-600),
  ink-brand: map.get($brand, ink-brand),
  surface: #1C2130,
  status-blocker: #c62828,
  /* …ramps, semantic status, floor palette… */
);
```
`_css-vars.scss` loops the maps to `--color-*`, `--space-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--z-*`, and `--gradient-brand: linear-gradient(135deg, var(--color-primary), var(--color-ink-brand))`.

## Usage in components (`*.module.scss`)
```scss
@use '@/styles/mixins' as *;
.card {
  padding: var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  font: var(--type-body);
  @include bp(tablet) { padding: var(--space-6); }
}
```
Canvas/JS needing colours: `getComputedStyle(document.documentElement).getPropertyValue('--color-status-blocker')`.

## Rules
- Scales: spacing 4-px base (`--space-1…12`), type scale with line-heights, radius sm/md/lg/pill, 3 shadow levels, z-index named layers.
- **No hex/rgb/hsl, no px/rem/em for spacing/type/radius, no raw z-index** in component SCSS or inline TSX style. Stylelint enforces; exceptions need `// token-exempt: reason`.
- Semantic over raw: `--color-status-returned`, not `--color-orange-500`.
- Need a value that doesn't exist? Add the token, then use it — in the same PR.
- Never duplicate a token file in a feature folder.
