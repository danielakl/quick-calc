# Design Token Reference

Quick Calc design tokens defined in `src/app/globals.css` `@theme` block.
All default Tailwind values cleared (`--color-*: initial`). Use ONLY these tokens.

## Colors

| Tailwind Suffix | Dark Value              | Light Value             | Usage                                    |
| --------------- | ----------------------- | ----------------------- | ---------------------------------------- |
| `background`    | `#0c0a14`               | `#f5f3ef`               | Page background                          |
| `surface`       | `#161225`               | `#faf8f5`               | Panels, cards, elevated areas            |
| `surface-alt`   | `#1e1a30`               | `#edeae4`               | Hover on surfaces, secondary backgrounds |
| `border`        | `#2d2640`               | `#ddd8cf`               | Dividers, structural borders             |
| `border-focus`  | `#8b5cf6`               | `#7c3aed`               | Focused input ring color                 |
| `foreground`    | `#e8e4f0`               | `#1c1a17`               | Primary text                             |
| `muted`         | `#9890a8`               | `#6e6960`               | Secondary text, placeholders             |
| `accent`        | `#8b5cf6`               | `#7c3aed`               | Results, links, interactive cues         |
| `accent-hover`  | `#a78bfa`               | `#6d28d9`               | Accent in hover state                    |
| `accent-dim`    | `rgba(139,92,246,0.45)` | `rgba(124,58,237,0.4)`  | Assignment results, subtle accents       |
| `error`         | `#f87171`               | `#cc2626`               | Error text, invalid input                |
| `success`       | `#4ade80`               | `#0d7a3a`               | Success indicators                       |
| `warning`       | `#fbbf24`               | `#a84b08`               | Warnings                                 |
| `caret`         | `#8b5cf6`               | `#7c3aed`               | Text cursor in inputs                    |
| `selection`     | `rgba(139,92,246,0.2)`  | `rgba(124,58,237,0.15)` | Text selection highlight                 |
| `white`         | `#ffffff`               | `#ffffff`               | Pure white (use sparingly)               |
| `black`         | `#000000`               | `#000000`               | Pure black (use sparingly)               |

## Typography

| Tailwind Class | Font Stack                   | Use For                                      |
| -------------- | ---------------------------- | -------------------------------------------- |
| `font-sans`    | Inter, system-ui, sans-serif | UI chrome: header, buttons, labels, tooltips |
| `font-mono`    | JetBrains Mono, monospace    | Calculator input/output, code display        |

**Type scale** (do not introduce sizes outside this set):

- `text-xs` (12px) — captions, badges, tertiary info
- `text-sm` (14px) — calculator I/O, secondary UI elements
- `text-base` (16px) — body text, labels
- `text-lg` (18px) — section headings
- `text-xl` (20px) — page titles

**Font weights:** 400 (regular), 500 (medium/labels), 600 (headings) — no bold (700+).

**Calculator line height:** `text-sm leading-6` — both textarea and results
panel use this exact pair for vertical alignment across the divider.

## Shadows

| Tailwind    | Usage                      |
| ----------- | -------------------------- |
| `shadow-sm` | Buttons, small controls    |
| `shadow-md` | Dropdowns, popovers, cards |
| `shadow-lg` | Modals, overlays           |

Dark theme shadows include a `1px` border ring (encoded in the token value).
Use shadows sparingly — only on floating or elevated interactive elements.

## Border Radius

| Tailwind       | Value  | Usage                            |
| -------------- | ------ | -------------------------------- |
| `rounded-sm`   | 4px    | Badges, chips, small tags        |
| `rounded-md`   | 6px    | Buttons, inputs, toggles         |
| `rounded-lg`   | 8px    | Cards, panels, dropdowns         |
| `rounded-full` | 9999px | Circular buttons, pills, avatars |

## Spacing (4px base unit)

Valid scale: `1` (4px), `2` (8px), `3` (12px), `4` (16px), `5` (20px),
`6` (24px), `8` (32px), `12` (48px), `16` (64px).

- Page padding: `px-6`
- Header: `px-6 py-3`
- Within component: `p-1` to `p-3`
- Between groups: `p-4` to `p-6`
- Prefer `gap` on flex/grid over individual margins

## Button Variant Recipes

**Primary:**

```
bg-accent text-white rounded-md px-4 py-2 text-sm font-medium font-sans
```

**Secondary:**

```
bg-surface border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium font-sans
```

**Ghost:**

```
bg-transparent text-muted rounded-md px-4 py-2 text-sm font-medium font-sans
hover:bg-surface-alt
```

**All variants also need:**

```
cursor-pointer transition-colors duration-150 ease-in-out
focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background
active:scale-[0.98]
```
