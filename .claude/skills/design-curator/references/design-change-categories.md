# Design Change Categories

Interview question templates for each category of DESIGN.md change.
The skill loads this file during Phase 2 (Interview) and asks only the
questions for the relevant category.

---

## color-new

**DESIGN.md sections:** Color System (dark/light tables), Adding New Colors

**Interview questions:**

1. What is the semantic role of this color? (What does it represent — not what it looks like)
2. What is the proposed dark theme hex value?
3. What is the proposed light theme hex value?
4. What elements will use this token? (text, background, border, icon)
5. Will this color appear as text on a surface? If so, which background token?

**Downstream sync:** design-tokens.md color table row, globals.css `@theme` + light override
**Pitfall:** Theme Asymmetry — always require both dark and light values before writing.
**Pitfall:** One-Off Hex Injection — require a semantic token name, not a bare hex.
**WCAG required:** Yes — compute contrast if token will be used as text or UI component.

---

## color-modify

**DESIGN.md sections:** Color System (dark/light tables)

**Interview questions:**

1. Which existing token is changing? (use the `--color-{name}` identifier)
2. What is the proposed new dark theme value?
3. What is the proposed new light theme value?
4. Is the semantic role changing, or just the color value?
5. IF role is changing: what existing elements use this token that may be affected?

**Downstream sync:** design-tokens.md row update, globals.css value update
**Pitfall:** Contrast-Blind Acceptance — recompute contrast for the new value.
**Pitfall:** Silent Downstream Drift — the component-generator anti-pattern #3 lists token names by name; renaming a token breaks that list.
**WCAG required:** Yes — verify all existing pairings still pass with the new value.

---

## typography

**DESIGN.md sections:** Typography (font families, type scale, font weights)

**Interview questions:**

1. Is this a new type size, a change to an existing size, a font family change, or a weight change?
2. IF new size: what is the pixel value, line height, weight, and intended usage?
3. Does this affect the calculator area? (The `text-sm leading-6` pair is locked for vertical alignment across the input/results divider — changing either side requires changing both.)
4. IF font family: is this replacing Inter or JetBrains Mono, or adding a third family?
5. IF weight: what elements will use this weight?

**Downstream sync:** design-tokens.md typography section, possibly globals.css `--font-*` variables
**Pitfall:** Type Scale Proliferation — new sizes must justify their addition to {12, 14, 16, 18, 20}px.
**Pitfall:** Calculator alignment — `text-sm leading-6` is a locked pair. Changing it misaligns input/output lines.
**WCAG required:** No (unless the size change reclassifies text from normal to large, which changes the contrast threshold).

---

## spacing

**DESIGN.md sections:** Spacing (4px base unit scale, guidelines)

**Interview questions:**

1. Is this a new spacing value or a change to the guidelines?
2. IF new value: what is the proposed pixel value?
3. What spacing context is this for? (within-component, between-components, between-sections, page-level)
4. Which existing scale value is closest to the need?

**Downstream sync:** design-tokens.md spacing section
**Pitfall:** Spacing Scale Drift — value must be a multiple of 4px in the set {4, 8, 12, 16, 20, 24, 32, 48, 64}px. Reject non-conforming values.
**WCAG required:** No.

---

## shadow

**DESIGN.md sections:** Shadows (shadow scale, guidelines)

**Interview questions:**

1. Which shadow level is changing? (sm / md / lg, or adding a new level)
2. What is the proposed dark theme value?
3. What is the proposed light theme value?
4. Should the dark theme `1px` border ring be preserved? (DESIGN.md convention: dark shadows always pair with a border ring)
5. What elevation context is this for? (buttons, dropdowns, modals)

**Downstream sync:** design-tokens.md shadow section, globals.css `--shadow-*` variables
**Pitfall:** Dropping the dark-theme border ring makes shadows invisible on dark backgrounds.
**WCAG required:** No (shadows are decorative).

---

## border-radius

**DESIGN.md sections:** Borders and Radius (radius scale, guidelines)

**Interview questions:**

1. Is this a new radius value or a change to an existing one?
2. IF new: what pixel value, and what Tailwind class name?
3. What elements will use this radius?
4. Does this affect the calculator area? (Calculator textarea and results panel have no border radius — they fill edge to edge.)

**Downstream sync:** design-tokens.md radius section, globals.css `--radius-*` variable
**Pitfall:** The calculator split must remain radiusless. Do not add radius to textarea or results panel.
**WCAG required:** No.

---

## layout

**DESIGN.md sections:** Layout (calculator split, responsive breakpoints, z-index scale)

**Interview questions:**

1. Is this a change to the calculator split ratio, a breakpoint, or the z-index scale?
2. IF split: what ratio is proposed? Does it apply at all breakpoints?
3. IF breakpoint: what pixel width, and what layout change occurs?
4. IF z-index: what layer is being added, and where does it slot into the existing scale?

**Downstream sync:** No design-tokens.md change (layout is guideline-only). Follow-up note for Calculator.tsx if split changes.
**Pitfall:** The 60/40 split is implemented directly in Calculator.tsx with flex basis classes, not via CSS custom properties.
**WCAG required:** No.

---

## component-pattern

**DESIGN.md sections:** Component Patterns (interactive states, buttons, transitions)

**Interview questions:**

1. Which pattern is changing? (hover / focus / active / disabled / all states, button variants, transitions)
2. Is this a change to the universal pattern or an exception for a specific component?
3. What are the proposed new class values?
4. IF button variant: which variant (primary / secondary / ghost), and what changes?

**Downstream sync:** design-tokens.md button variant recipes, component-generator SKILL.md interactive state references (lines 33-36, 170-175)
**Pitfall:** The component-generator skill hardcodes the focus ring pattern (`ring-2 ring-accent ring-offset-2 ring-offset-background`) in its vocabulary and behavioral instructions. Changing this pattern requires updating the component-generator skill too.
**WCAG required:** Focus indicators must meet 3:1 contrast per WCAG 2.4.7.

---

## scrollbar

**DESIGN.md sections:** Scrollbar (custom styling specs)

**Interview questions:**

1. What property is changing? (width, thumb color, track color, border-radius)
2. What is the proposed new value?
3. Should this apply to WebKit, Firefox, or both?

**Downstream sync:** No design-tokens.md change. Follow-up in globals.css scrollbar styles.
**Pitfall:** The input textarea uses `hide-scrollbar` class (scrollbar hidden). Only the results panel shows the custom scrollbar. This asymmetry is intentional.
**WCAG required:** No (scrollbars are browser chrome).

---

## theming

**DESIGN.md sections:** Implementation: Theming

**Interview questions:**

1. What aspect of the theming approach is changing? (CSS custom property strategy, data-attribute convention, localStorage key, prefers-color-scheme handling, FOUC prevention)
2. Is this adding a new theme (beyond dark/light) or changing how existing themes work?
3. IF new theme: what is the theme name and what tokens differ from dark/light?

**Downstream sync:** Potentially all design-tokens.md (if adding a theme). Follow-up in globals.css, useThemeStore.ts, theme-init.js.
**Pitfall:** The `public/theme-init.js` blocking script prevents FOUC. Changes to the data-attribute convention must also update this script.
**WCAG required:** No (theming strategy is structural, not visual).

---

## guideline-text

**DESIGN.md sections:** Any prose section (guidelines, "adding new colors" process, notes)

**Interview questions:**

1. Which section is being updated?
2. What is the intent of the change? (clarify existing guidance, add new guidance, soften/strengthen a rule)
3. Does this change affect any token tables or values? (If yes, reclassify to the appropriate token category.)

**Downstream sync:** None — guideline text is not extracted into design-tokens.md.
**Pitfall:** Ensure guideline changes don't contradict existing token tables or component-generator anti-patterns.
**WCAG required:** No.
