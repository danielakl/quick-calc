# Quick Calc Design Guidelines

Design system and visual guidelines for building cohesive UI in Quick Calc. All new components, layouts, and design decisions should follow these rules.

## Color System

Quick Calc supports **dark** (default) and **light** themes. Colors are defined as CSS custom properties and switched via a `data-theme="light"` attribute on `<html>` (dark is the default).

### Dark Theme

| Token                  | Value                      | Usage                               |
| ---------------------- | -------------------------- | ----------------------------------- |
| `--color-background`   | `#0c0a14`                  | Page background                     |
| `--color-surface`      | `#161225`                  | Panels, cards, elevated areas       |
| `--color-surface-alt`  | `#1e1a30`                  | Hover states on surfaces, dropdowns |
| `--color-border`       | `#2d2640`                  | Dividers, input borders             |
| `--color-border-focus` | `#8b5cf6`                  | Focused input borders               |
| `--color-foreground`   | `#e8e4f0`                  | Primary text                        |
| `--color-muted`        | `#9890a8`                  | Secondary text, placeholders        |
| `--color-accent`       | `#8b5cf6`                  | Results, links, interactive cues    |
| `--color-accent-hover` | `#a78bfa`                  | Accent hover state                  |
| `--color-accent-dim`   | `rgba(139, 92, 246, 0.45)` | Assignment results, subtle accents  |
| `--color-error`        | `#f87171`                  | Error text, invalid input           |
| `--color-success`      | `#4ade80`                  | Success indicators                  |
| `--color-warning`      | `#fbbf24`                  | Warnings                            |
| `--color-caret`        | `#8b5cf6`                  | Text cursor in inputs               |
| `--color-selection`    | `rgba(139, 92, 246, 0.2)`  | Text selection highlight            |

### Light Theme

| Token                  | Value                      | Usage                              |
| ---------------------- | -------------------------- | ---------------------------------- |
| `--color-background`   | `#f5f3ef`                  | Page background                    |
| `--color-surface`      | `#faf8f5`                  | Panels, cards                      |
| `--color-surface-alt`  | `#edeae4`                  | Hover states, dropdowns            |
| `--color-border`       | `#ddd8cf`                  | Dividers, input borders            |
| `--color-border-focus` | `#7c3aed`                  | Focused input borders              |
| `--color-foreground`   | `#1c1a17`                  | Primary text                       |
| `--color-muted`        | `#6e6960`                  | Secondary text, placeholders       |
| `--color-accent`       | `#7c3aed`                  | Results, links, interactive cues   |
| `--color-accent-hover` | `#6d28d9`                  | Accent hover state                 |
| `--color-accent-dim`   | `rgba(124, 58, 237, 0.4)`  | Assignment results, subtle accents |
| `--color-error`        | `#cc2626`                  | Error text                         |
| `--color-success`      | `#0d7a3a`                  | Success indicators                 |
| `--color-warning`      | `#a84b08`                  | Warnings                           |
| `--color-caret`        | `#7c3aed`                  | Text cursor                        |
| `--color-selection`    | `rgba(124, 58, 237, 0.15)` | Text selection highlight           |

### Contrast Requirements

All text colors must meet **WCAG AA** minimums:

- Normal text (< 18px): 4.5:1 contrast ratio against its background
- Large text (>= 18px or 14px bold): 3:1 contrast ratio
- UI components and graphical objects: 3:1

### Adding New Colors

Do not introduce one-off hex values. If a new color is needed:

1. Add it as a CSS custom property with a semantic name
2. Define values for both themes
3. Document it in this file

---

## Typography

Quick Calc uses **two font families**: a proportional font for UI chrome and a monospace font for calculator content.

### Font Families

| Role           | Font          | CSS Variable  | Fallback                  | Usage                                 |
| -------------- | ------------- | ------------- | ------------------------- | ------------------------------------- |
| **UI**         | Space Grotesk | `--font-sans` | `system-ui, sans-serif`   | Header, buttons, labels, tooltips, UI |
| **Calculator** | Space Mono    | `--font-mono` | `ui-monospace, monospace` | Textarea input, result lines, code    |

Load both via `next/font/local` in `layout.tsx` from `src/app/fonts/` (self-hosted for build stability and a minimal payload). Space Grotesk ships as a single variable font with a `wght` axis 300–700 that covers regular/medium/semibold; Space Mono ships only Regular 400 since bold (700+) is forbidden and italics are unused.

### Type Scale

Use these sizes consistently. Do not introduce arbitrary pixel values.

| Name   | Size | Line Height | Weight | Usage                                   |
| ------ | ---- | ----------- | ------ | --------------------------------------- |
| `xs`   | 12px | 16px        | 400    | Captions, footnotes, badges             |
| `sm`   | 14px | 20px        | 400    | Secondary UI text                       |
| `base` | 16px | 24px        | 400    | Body text, input labels, calculator I/O |
| `lg`   | 18px | 28px        | 500    | Section headings, prominent labels      |
| `xl`   | 20px | 28px        | 600    | Page titles                             |

**Calculator area exception:** The textarea and result lines use `text-base` (16px) with a fixed `leading-6` (24px) line height so input and output lines stay vertically aligned. The 16px minimum also prevents mobile browsers from auto-zooming on the textarea. Do not change this ratio without updating both sides.

### Font Weights

| Weight   | Value | Usage                          |
| -------- | ----- | ------------------------------ |
| Regular  | 400   | Body text, calculator content  |
| Medium   | 500   | Labels, UI controls, nav items |
| Semibold | 600   | Headings, emphasis             |

Do not use bold (700+) — it competes with the accent color for visual hierarchy.

---

## Spacing

All spacing uses a **4px base unit**. Use only these values:

| Token | Value | Tailwind | Usage                                       |
| ----- | ----- | -------- | ------------------------------------------- |
| `1`   | 4px   | `p-1`    | Tight internal gaps (icon padding, badge)   |
| `2`   | 8px   | `p-2`    | Related element spacing, inline gaps        |
| `3`   | 12px  | `p-3`    | Compact component padding (header vertical) |
| `4`   | 16px  | `p-4`    | Standard gap between groups                 |
| `5`   | 20px  | `p-5`    | Medium section spacing                      |
| `6`   | 24px  | `p-6`    | Content area padding (current main padding) |
| `8`   | 32px  | `p-8`    | Large section spacing                       |
| `12`  | 48px  | `p-12`   | Page-level vertical spacing                 |
| `16`  | 64px  | `p-16`   | Hero/landing spacing (rarely needed)        |

### Guidelines

- **Within a component:** Use `4px`-`12px` for internal spacing.
- **Between related components:** Use `16px`-`24px`.
- **Between sections:** Use `32px`-`48px`.
- **Page padding:** `24px` horizontal (`px-6`). Header uses `px-6 py-3`.
- Prefer `gap` on flex/grid containers over margin on children.

---

## Shadows

Use shadows **sparingly** to convey elevation. The app is primarily flat; shadows appear only on floating or interactive elements.

### Shadow Scale

| Level | Dark Theme                                                     | Light Theme                      | Usage                      |
| ----- | -------------------------------------------------------------- | -------------------------------- | -------------------------- |
| `sm`  | `0 1px 2px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--color-border)`  | `0 1px 2px rgba(0, 0, 0, 0.05)`  | Buttons, small controls    |
| `md`  | `0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--color-border)` | `0 4px 12px rgba(0, 0, 0, 0.08)` | Dropdowns, popovers, cards |
| `lg`  | `0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border)` | `0 8px 24px rgba(0, 0, 0, 0.12)` | Modals, overlays           |

### Guidelines

- In dark theme, pair shadows with a `1px` border — shadows alone are hard to see on dark backgrounds.
- Do not add shadow to the main calculator split. It stays flat with a `1px` divider.
- Floating elements (dropdowns, theme toggle popover, tooltips) use `md` shadow.
- Do not use `inset` shadows.

---

## Borders and Radius

### Border Radius

| Token  | Value  | Tailwind       | Usage                            |
| ------ | ------ | -------------- | -------------------------------- |
| `sm`   | 4px    | `rounded-sm`   | Badges, chips, small tags        |
| `md`   | 6px    | `rounded-md`   | Buttons, inputs, toggles         |
| `lg`   | 8px    | `rounded-lg`   | Cards, panels, dropdown menus    |
| `full` | 9999px | `rounded-full` | Avatars, circular buttons, pills |

### Guidelines

- The calculator textarea and results panel have **no border radius** — they fill their containers edge to edge.
- Interactive controls (buttons, toggles, select menus) use `rounded-md`.
- Tooltips and dropdown panels use `rounded-lg`.
- Keep radius consistent within a component — do not mix `md` and `lg` on children of the same parent.

### Borders

- Use `1px solid var(--color-border)` for structural dividers.
- Use `var(--color-border-focus)` (accent) for focused inputs — `2px` ring via `ring-2 ring-accent` rather than border to avoid layout shift.
- The main calculator divider is a `1px` vertical line using `w-px bg-border`.

---

## Layout

### Calculator Split

The core layout is a horizontal flex split with a dynamic results panel:

- **Input area:** `flex-1 min-w-0` — fills all available space, grows to 100% when no results
- **Results wrapper:** slides in when results exist (`w-[35%]`), collapses to `w-0` when empty. Uses `transition-[width,opacity] duration-300 ease-in-out` for smooth animation. Contains the divider and results panel.
- **Divider:** `1px` (`w-px shrink-0 bg-border`) — inside the results wrapper, appears/disappears with results
- **Results panel:** `flex-1 min-w-0 overflow-y-auto` inside the wrapper

Both sides share identical vertical padding (`p-6`) and line height (`leading-6`) to keep lines aligned. The layout stays horizontal at all viewport sizes.

### Icons

All icon components default to 20px (`size={20}`). With `p-2` button padding this gives 36px touch targets.

### Z-Index Scale

| Value | Usage                 |
| ----- | --------------------- |
| `10`  | Sticky header         |
| `20`  | Dropdowns, popovers   |
| `30`  | Overlays, backdrops   |
| `40`  | Modals, dialogs       |
| `50`  | Toasts, notifications |

Do not use arbitrary z-index values. If a new layer is needed, slot it into this scale.

---

## Component Patterns

### Interactive States

All interactive elements must have visible hover, focus, and active states:

| State        | Style                                                               |
| ------------ | ------------------------------------------------------------------- |
| **Default**  | Base styling                                                        |
| **Hover**    | Background shifts to `surface-alt`, accent shifts to `accent-hover` |
| **Focus**    | `ring-2 ring-accent ring-offset-2 ring-offset-background` outline   |
| **Active**   | Slight scale down: `active:scale-[0.98]`                            |
| **Disabled** | `opacity-50 cursor-not-allowed`, no hover/focus effects             |

### Buttons

```
Primary:   bg-accent text-white rounded-md px-4 py-2 text-sm font-medium
Secondary: bg-surface border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium
Ghost:     bg-transparent text-muted hover:bg-surface-alt rounded-md px-4 py-2 text-sm font-medium
```

### Transitions

All interactive state changes use:

```
transition-colors duration-150 ease-in-out
```

For transforms (scale, translate): `duration-150 ease-out`.

Do not add transitions to layout properties (width, height, padding) unless animating a deliberate expand/collapse.

---

## Scrollbar

Custom scrollbar styling (WebKit):

- **Width:** `6px`
- **Track:** Transparent
- **Thumb:** `var(--color-border)`, `border-radius: 3px`
- **Thumb hover:** Slightly lighter (dark: `#444` / light: `#ccc`). These are browser-chrome values not exposed as design tokens.

For Firefox, use `scrollbar-width: thin` and `scrollbar-color: var(--color-border) transparent`.

---

## Implementation: Theming

Theme switching is done via CSS custom properties. The recommended approach:

1. Define dark theme tokens as defaults in `@theme` in `globals.css`
2. Override with light theme tokens under `html[data-theme="light"]`
3. Toggle the `data-theme` attribute in a Zustand store action
4. Persist the preference in `localStorage` under key `theme`
5. Respect `prefers-color-scheme` as the default when no preference is stored

```css
/* globals.css structure */
@theme {
  /* Dark theme tokens (default) */
  --color-background: #0c0a14;
  --color-surface: #161225;
  /* ... */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

html[data-theme="light"] {
  --color-background: #f5f3ef;
  --color-surface: #faf8f5;
  /* ... */
}
```

**Note:** This document defines the design tokens and guidelines. Implementing the theme toggle, loading the Inter font, and updating components is separate work.
