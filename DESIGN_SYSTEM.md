# KolShek Design System

Source of truth for the settings dashboard CSS. Built with **Tailwind CSS v4** + custom component classes in `src/web/styles.css`.

## Visual Direction

**"Warm precision."** Clean density inspired by Stripe/Linear. Color is an event, not decoration.

- **Indigo primary** (`#6366f1` / `#4f46e5`) with zinc neutrals
- Monochrome surfaces with selective accent pops
- Tight vertical rhythm, typographic hierarchy carries meaning
- Subtle depth via layered shadows with faint indigo tint
- Transitions: 150ms for micro-interactions, 200-250ms for layout shifts

## Build Pipeline

```bash
# One-time build
bun run build:css

# Watch mode during development
bun run dev:css
```

Source: `src/web/styles.css` → Output: `src/web/dist/styles.css` (minified via `@tailwindcss/cli`)

## Color Palette

| Token        | Light          | Dark           | Usage                    |
|-------------|----------------|----------------|--------------------------|
| Primary     | `#4f46e5`      | `#818cf8`      | Buttons, links, accents  |
| Primary-alt | `#6366f1`      | `#a5b4fc`      | Gradients, badges, focus |
| Surface     | `#ffffff`      | `#18181b`      | Cards, inputs            |
| Background  | warm gradient  | `#09090b` + glow | Body background       |
| Border      | `#e4e4e7`      | `#27272a`      | Cards, inputs, dividers  |
| Text        | `#18181b`      | `#e4e4e7`      | Body text                |
| Text-muted  | `#71717a`      | `#a1a1aa`      | Secondary text (WCAG AA) |
| Success     | `#059669`      | `#6ee7b7`      | Emerald badges, dots     |
| Danger      | `#e11d48`      | `#fb7185`      | Rose badges, errors      |
| Warning     | `#b45309`      | `#fbbf24`      | Amber badges, alerts     |

## Dark Mode

Class-based: `<html class="dark">`. Toggle via `localStorage('kolshek-theme')`.

Contrast hierarchy (on zinc-950 `#09090b`):
- **Headings**: white `#ffffff` (21:1)
- **Body**: zinc-100 `#f4f4f5` (18.5:1)
- **Secondary**: zinc-300 `#d4d4d8` (13:1)
- **Metadata**: zinc-400 `#a1a1aa` (6.3:1) — minimum for WCAG AA

Never use `dark:text-zinc-500` for readable text (3.7:1 fails AA).

## Component Classes

### Layout
- `.ks-body` — full-height body with gradient background
- `.ks-header` — sticky frosted-glass header (`backdrop-filter: blur(16px)`)
- `.ks-brand` / `.ks-brand-mark` / `.ks-brand-text` — gradient brand lockup with shekel icon
- `.nav-pill` / `.nav-pill--active` — capsule nav links
- `.nav-badge` — gradient count pill with glow
- `.ks-theme-toggle` — SVG sun/moon toggle button

### Buttons
- `.btn-primary` — indigo gradient with inner highlight, hover lift
- `.btn-outline` — bordered neutral button
- `.btn-ghost` — minimal text button, indigo hover
- `.btn-ghost-danger` — destructive ghost variant (rose)
- `.btn-sm` — compact size modifier

### Cards
- `.card` — white surface with layered shadow + indigo tint
- `.card-header` — subtle gradient header strip
- `.card-accent` — left-border accent variant

### Badges
- `.badge-indigo` / `.badge-emerald` / `.badge-rose` / `.badge-amber` / `.badge-zinc`
- All use semi-transparent backgrounds with matching borders

### Status Dots
- `.status-dot` + `-success` / `-error` / `-warning` / `-info` / `-neutral`
- `.status-dot-pulse` — breathing animation
- `.status-dot-lg` — 10px variant

### Animations
- `toastSlideIn` / `toastFadeOut` — toast notifications
- `txFadeOut` — transaction row removal
- `translateFade` — translation success fade
- `highlightRow` — indigo flash for new items
- `statusPulse` — breathing status dot

## Typography

Font: **Inter** (400, 500, 600, 700) via Google Fonts.

| Level          | Size     | Weight | Color (light / dark)         |
|---------------|----------|--------|------------------------------|
| Page heading  | text-xl  | 700    | zinc-900 / white             |
| Section title | text-sm  | 600    | zinc-800 / zinc-100          |
| Body          | text-sm  | 400    | zinc-700 / zinc-300          |
| Badge/meta    | text-xs  | 500    | varies by badge color        |

## Icons

All icons are inline SVG (16x16, stroke-based, Feather-style). No icon library dependency.

Key patterns:
- Section headers: colored icon box (`w-7 h-7 rounded-lg bg-{color}-100`)
- Buttons: 16px SVG inline with text
- Empty states: larger icon in rounded container
- Theme toggle: sun/moon SVGs with `display` toggling

## Tailwind v4 Config

```css
@import "tailwindcss";
@source "./**/*.ts";
@variant dark (&:where(.dark, .dark *));
@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

No `tailwind.config.js` needed — Tailwind v4 uses CSS-first configuration.
