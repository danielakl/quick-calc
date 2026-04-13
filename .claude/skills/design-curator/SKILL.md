---
name: design-curator
version: 1.0.0
description: |
  Maintains and evolves the Quick Calc design system by updating DESIGN.md
  through a structured interview workflow. Handles semantic color tokens
  (dark/light theme pairs), WCAG AA contrast validation (4.5:1 normal /
  3:1 large text), type scale changes, 4px-grid spacing additions, shadow
  scale modifications, border radius updates, layout token changes, component
  pattern guidelines, and scrollbar/theming strategy.

  Use when the user wants to change a color, add a new design token, update
  typography, modify spacing, change shadows, adjust radius, update layout
  proportions, revise interactive state patterns, or update design
  documentation — even if they just say "tweak the look," "the muted color
  is hard to read," "add a new color," or "update the design."

  Do NOT use for generating components (use component-generator), editing
  globals.css, writing CSS, modifying .tsx files, or making any code changes.
  This skill updates documentation only: DESIGN.md and optionally
  design-tokens.md.
tags: [design-system, tokens, WCAG, color, typography, spacing, quick-calc.app]
project: quick-calc.app
---

## Expert Vocabulary Payload

**Color Science & Accessibility:**
relative luminance (WCAG 2.1), contrast ratio (WCAG 2.1 SS1.4.3),
sRGB gamma linearization, AA threshold (4.5:1 normal / 3:1 large),
AAA threshold (7:1 / 4.5:1), alpha blending for rgba, color temperature,
perceptual lightness

**Design Token Taxonomy:**
semantic token, primitive token, token aliasing, CSS custom property,
`@theme inline` block, `--color-*: initial` reset (Tailwind 4),
dark/light theme fork, `data-theme` attribute toggle, theming contract,
token naming convention (`--color-{role}`, `--shadow-{level}`, `--radius-{size}`)

**Typography & Spacing Systems:**
modular type scale, baseline grid, 4px base grid, leading (line-height),
tracking (letter-spacing), font loading via `next/font/google`,
monospace context (calculator), proportional UI context (chrome)

**Design Documentation & Governance:**
single source of truth, downstream consumer, sync drift,
design-tokens.md (component-generator extract), breaking change vs
additive change, change propagation path

**Component Patterns:**
interactive state machine (default / hover / focus / active / disabled),
focus ring (`ring-2 ring-accent ring-offset-2 ring-offset-background`),
surface shift (`hover:bg-surface-alt`), active scale (`active:scale-[0.98]`),
transition baseline (`transition-colors duration-150 ease-in-out`),
button variant recipe (primary / secondary / ghost)

---

## Anti-Pattern Watchlist

Scan every proposed change against these before writing to DESIGN.md.

### 1. One-Off Hex Injection

**Detection:** User proposes a raw hex/rgb value for a specific element without
providing a semantic token name (e.g., "use `#3b82f6` for the info text").
**Resolution:** Require a token name (e.g., `--color-info`) and a semantic role
description before proceeding. Remind that `globals.css` uses
`--color-*: initial` — arbitrary hex values bypass the token system entirely.

### 2. Theme Asymmetry

**Detection:** A dark theme value is proposed without a corresponding light theme
value, or vice versa. The interview produces only one side.
**Resolution:** Before writing DESIGN.md, explicitly ask for the missing theme
value. Do not write a partial entry. IF the user is unsure: propose a light
(or dark) counterpart based on the existing palette relationships and explain
the reasoning.

### 3. Contrast-Blind Acceptance

**Detection:** A color change involves a token used as text or a UI component on
a background, but no contrast ratio has been computed.
**Resolution:** Load `references/wcag-contrast-primer.md`. Compute the ratio
using the WCAG relative luminance formula. IF it fails AA: state the computed
ratio, state the threshold, propose an adjusted value, and confirm with user.

### 4. Spacing Scale Drift

**Detection:** A proposed spacing value is not in the set
{4, 8, 12, 16, 20, 24, 32, 48, 64}px.
**Resolution:** Reject the value. Ask which existing scale step is closest to
the need. IF the user insists on a non-standard value, require a justification
and note the deviation explicitly in the DESIGN.md guidelines section.

### 5. Type Scale Proliferation

**Detection:** A proposed font size is not in {12, 14, 16, 18, 20}px.
**Resolution:** Ask which existing size is closest. IF genuinely needed: require
justification for adding to the scale, and note impact on vertical rhythm.
The calculator `text-sm leading-6` pair is locked — any change to 14px
requires updating both input and results panels.

### 6. Silent Downstream Drift

**Detection:** Any change to a token name, value, or semantic role in DESIGN.md
without flagging that `design-tokens.md` and `globals.css` need corresponding
updates.
**Resolution:** Always produce a "Downstream Sync" section. For token value
changes: show the proposed `design-tokens.md` table row update. For token
renames/removals: check component-generator SKILL.md anti-pattern #3 (which
lists token names explicitly) and flag any references that would break.

### 7. Section Deletion Without Audit

**Detection:** User asks to remove or rename a DESIGN.md section heading, token
name, or guideline that downstream consumers reference.
**Resolution:** Before removing, list all known references:

- `CLAUDE.md` lines 9 and 56 (design token references)
- Component-generator SKILL.md lines 29, 33-36, 76-78, 170-175, 182-183
- `design-tokens.md` (full file is derived from DESIGN.md)
  Flag each reference and confirm the user wants to proceed.

---

## Behavioral Instructions

### Phase 1: Classify the Change

1. Read the user's request. Classify into one or more categories:
   `color-new`, `color-modify`, `typography`, `spacing`, `shadow`,
   `border-radius`, `layout`, `component-pattern`, `scrollbar`,
   `theming`, `guideline-text`.

2. IF category is ambiguous: ask one clarifying question. Do not ask
   multiple questions at once.

3. IF change spans multiple categories: handle them sequentially, one
   category at a time. Complete each before starting the next.

4. IF category is `color-new` or `color-modify`: read
   `references/wcag-contrast-primer.md` before proceeding to Phase 2.

### Phase 2: Interview

5. Read `references/design-change-categories.md` for the relevant category.

6. Ask the category-specific interview questions. Ask one question at a
   time unless multiple questions are clearly independent (e.g., dark
   and light values can be asked together).

7. Scan answers against the Anti-Pattern Watchlist. IF a violation is
   detected: name the anti-pattern, explain the issue, and ask the
   user to correct before proceeding.

8. After gathering all required information, summarize the proposed
   change back to the user in plain language. Ask for confirmation
   before proceeding to Phase 3.

### Phase 3: WCAG Validation (Color Changes Only)

9. IF category is `color-new` or `color-modify` AND the token will be
   used as text or a UI component:
   - Identify the background token(s) against which contrast must be met.
     Use the pairing table in `references/wcag-contrast-primer.md`.
   - Compute relative luminance for both the foreground and background
     colors using the sRGB linearization formula.
   - Compute the contrast ratio: `(L_lighter + 0.05) / (L_darker + 0.05)`.
   - Check against the threshold: normal text (<18px) requires 4.5:1;
     large text (>=18px or >=14px bold) and UI components require 3:1.

10. IF the ratio passes: note the computed ratio. It will be included in
    the output summary.

11. IF the ratio fails: state the computed ratio and the threshold.
    Propose an adjusted hex value that passes. Ask the user to confirm
    the adjusted value before writing. Do NOT write a failing value to
    DESIGN.md.

12. IF the token is only used as a background or decorative element (no
    text overlaid): skip contrast validation but note this explicitly.

### Phase 4: Write DESIGN.md

13. Read the current `DESIGN.md` to get the exact content of the
    section being modified.

14. Produce the proposed edit showing:
    - The DESIGN.md section being modified
    - The exact new content (table row, paragraph, code block)
    - Whether any existing content is being removed or replaced

15. IF the change adds, modifies, or removes a token: read the current
    `design-tokens.md` at `.claude/skills/component-generator/references/design-tokens.md`.
    Produce a second block labeled "Downstream Sync: design-tokens.md"
    showing the proposed addition, modification, or removal.

16. Produce a "Follow-Up Work Required" section listing:
    - `globals.css`: exact CSS custom property lines to add/update in
      the `@theme` block and `html[data-theme="light"]` override
    - Component-generator updates: any anti-pattern references that
      mention the changed token by name
    - `CLAUDE.md`: whether lines 9 or 56 need updating
    - Component files: any existing components that use the changed token
      (list file names, do not edit them)

17. Ask the user to confirm the full proposed change set.

18. On confirmation:
    - Write the DESIGN.md update.
    - IF the user confirms the design-tokens.md update: write that too.
    - Do NOT write globals.css or any .tsx file.

### Phase 5: Post-Update Summary

19. Output a structured summary using the Output Format below.

---

## Output Format

Every design-curator session produces this structure:

```
## Design Change Summary

**Category:** [color-new | color-modify | typography | spacing | shadow |
               border-radius | layout | component-pattern | scrollbar |
               theming | guideline-text]
**Section:** [DESIGN.md section name]
**Change type:** [additive | modification | removal]

## Proposed DESIGN.md Change

[Exact content showing the section and the new/modified/removed entry]

## Downstream Sync: design-tokens.md

[The exact table row(s) to add, update, or remove]
— OR —
NOT applicable — this change does not affect token values.

## WCAG Validation

[Token name, background pairing, computed ratio, threshold, pass/fail]
— OR —
NOT applicable — no color changes or token is not used as text/UI.

## Follow-Up Work Required (not done by this skill)

**globals.css:**
- [Exact CSS lines to add/update, or "No changes needed"]

**component-generator:**
- [Anti-pattern references to update, or "No changes needed"]

**CLAUDE.md:**
- [Lines to update, or "No changes needed"]

**Components using changed tokens:**
- [File list, or "None"]
```

---

## Examples

### Example 1 (BAD): Color addition — theme asymmetry + skipped contrast

User: "Add a blue info color, use `#3b82f6`."

**BAD response:** Immediately adds `--color-info: #3b82f6` to the dark theme
table in DESIGN.md. No light theme value asked. No contrast ratio computed.
No downstream sync block. Result: a theme-asymmetric entry that may fail
WCAG, and design-tokens.md is silently stale.

**Violations:** Theme Asymmetry (#2), Contrast-Blind Acceptance (#3),
Silent Downstream Drift (#6).

### Example 1 (GOOD): Same request handled correctly

**Interview flow:**

1. Classify: `color-new`
2. Load `references/wcag-contrast-primer.md`
3. Ask: "What is the semantic role? Informational status alongside
   error/success/warning?" — User confirms.
4. Ask: "Dark theme value is `#3b82f6`. What light theme value?
   For reference, the existing status colors darken in light theme
   (e.g., error goes from `#f87171` to `#dc2626`). A darker blue like
   `#1d4ed8` would follow this pattern." — User accepts suggestion.
5. Ask: "Will this appear as text on the page background?" — User confirms.
6. Compute contrast:
   - Dark: `#3b82f6` on `#0c0a14` = ~5.3:1 (AA pass for normal text)
   - Light: `#1d4ed8` on `#f5f3ef` = ~5.0:1 (AA pass for normal text)
7. Summarize and confirm.

**Output:**

```
## Design Change Summary

**Category:** color-new
**Section:** Color System
**Change type:** additive

## Proposed DESIGN.md Change

Dark Theme table — add row:
| `--color-info` | `#3b82f6` | Informational messages, status indicators |

Light Theme table — add row:
| `--color-info` | `#1d4ed8` | Informational messages, status indicators |

## Downstream Sync: design-tokens.md

Add row to Colors table:
| `info` | `#3b82f6` | `#1d4ed8` | Informational messages, status indicators |

## WCAG Validation

| Token  | Background      | Ratio  | Threshold | Result |
| ------ | --------------- | ------ | --------- | ------ |
| `info` | dark `#0c0a14`  | 5.3:1  | 4.5:1     | Pass   |
| `info` | light `#f5f3ef` | 5.0:1  | 4.5:1     | Pass   |

## Follow-Up Work Required (not done by this skill)

**globals.css:**
- Add `--color-info: #3b82f6;` to the `@theme` block
- Add `--color-info: #1d4ed8;` to `html[data-theme="light"]`

**component-generator:**
- Add `info` to the allowed token list in anti-pattern #3 (line 76-78)

**CLAUDE.md:**
- No changes needed

**Components using changed tokens:**
- None (new token)
```

### Example 2 (GOOD): Spacing addition — 4px grid validation

User: "I need 10px spacing for tight component gaps."

**Interview flow:**

1. Classify: `spacing`
2. Ask: "10px is not on the 4px grid (valid: 4, 8, 12, 16...). The
   closest values are 8px (`p-2`) and 12px (`p-3`). Which fits your
   need, or is there a specific reason 10px is required?"
3. User: "8px is too tight, 12px works."
4. Respond: "12px (`p-3`) is already in the spacing scale. No DESIGN.md
   change needed — you can use it directly."

No output produced — the existing scale already covers the need.

### Example 3 (GOOD): Guideline text edit

User: "Make the spacing guidelines more explicit about preferring gap."

**Interview flow:**

1. Classify: `guideline-text`
2. Ask: "Which guideline in the Spacing section? The current text says
   'Prefer `gap` on flex/grid containers over margin on children.'
   Should I strengthen this to a rule, or add more detail?"
3. User: "Strengthen it — say gap is required, margin only as fallback."
4. Summarize and confirm.

**Output:**

```
## Design Change Summary

**Category:** guideline-text
**Section:** Spacing — Guidelines
**Change type:** modification

## Proposed DESIGN.md Change

Replace in Spacing > Guidelines:
- Old: "Prefer `gap` on flex/grid containers over margin on children."
- New: "Use `gap` on flex/grid containers. Use margin on children only
  when the container does not support `gap` (e.g., absolutely positioned
  elements). Do not mix `gap` and margin in the same container."

## Downstream Sync: design-tokens.md

NOT applicable — this change does not affect token values.

## WCAG Validation

NOT applicable — no color changes.

## Follow-Up Work Required (not done by this skill)

**globals.css:** No changes needed
**component-generator:** No changes needed
**CLAUDE.md:** No changes needed
**Components using changed tokens:** None
```

---

## Questions This Skill Answers

- "Change the accent color"
- "Add a new color token"
- "I want to add an info/blue/warning color"
- "The muted text is hard to read"
- "Update the button radius"
- "Add a new spacing size"
- "Change the font size for headings"
- "Update the shadow values"
- "Modify the hover state pattern"
- "Add a new z-index layer"
- "Change the calculator layout split"
- "Update DESIGN.md"
- "What's the process for adding a design token?"
- "Does this color pass WCAG contrast?"
- "I want to tweak the look of the app"
- "Can we make the focus ring thicker?"
- "Update the design system documentation"
- "Change the scrollbar styling"
- "Add a third theme"
