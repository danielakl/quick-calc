---
name: component-generator
version: 1.0.0
description: |
  Generates React component files (.tsx) and co-located test files (.test.tsx)
  that match Quick Calc conventions exactly: correct "use client" placement,
  design token enforcement (no hardcoded hex), Zustand store patterns, Tailwind
  CSS 4 interactive states, and Vitest + Testing Library test structure.
  Use when the user says "create a component," "add a [name] component,"
  "make a new icon," "build a [feature] UI element," "I need a component for
  [X]," or "generate [ComponentName].tsx" — even if they don't mention testing,
  design tokens, or conventions. Also triggers for "add a button," "make a
  dropdown," "create a modal," "build a settings panel." Do NOT use for
  store creation (useCalcStore, useThemeStore) or lib utilities (engine, formatter).
tags: [react, next.js, typescript, tailwind, zustand, component-generation]
project: quick-calc.app
---

## Expert Vocabulary Payload

**Component Architecture:**
React Server Components vs Client Components, `"use client"` directive boundary,
hydration mismatch, `useSyncExternalStore`, co-located test file, default export,
props interface, destructured props signature

**Design System:**
design token, `@theme` block, semantic color token, `--color-*: initial` reset,
Tailwind CSS 4 CSS-first config, theme override via `data-theme` attribute,
WCAG AA contrast (4.5:1 normal / 3:1 large), font-mono calculator context,
font-sans UI chrome context

**Interactive States (DESIGN.md):**
hover surface shift (`hover:bg-surface-alt`), focus ring (`ring-2 ring-accent
ring-offset-2 ring-offset-background`), active scale (`active:scale-[0.98]`),
disabled opacity pattern (`opacity-50 cursor-not-allowed`),
transition baseline (`transition-colors duration-150 ease-in-out`)

**Zustand Patterns:**
`create<State>()((set) => ({...}))`, destructured selector,
`setState` direct mutation in tests, store reset in `beforeEach`

**Testing Vocabulary:**
`userEvent.setup()`, `screen.getByTestId()`, `waitFor`, `cleanup`,
`beforeEach` store reset, factory helper function, container query,
`@testing-library/jest-dom` matchers

---

## Anti-Pattern Watchlist

Scan every generated file against these before output.

### 1. Missing `"use client"` on Store-Connected Component

**Detection:** Component imports from `@/stores/*` or uses any React hook
(`useState`, `useEffect`, `useCallback`, `useRef`, `useSyncExternalStore`)
but the first line is not `"use client"`.
**Resolution:** Add `"use client"` as the absolute first line. Next.js App Router
treats files without this directive as React Server Components — importing a
Zustand store or using hooks inside one causes a runtime error.

### 2. Hardcoded Hex / RGB Values

**Detection:** Any string matching `#[0-9a-fA-F]{3,8}` or `rgb(` or `rgba(`
inside a JSX `className`, inline `style`, or Tailwind arbitrary value `[#...]`.
**Resolution:** Replace with the semantic token from the design system
(e.g., `text-accent`, `bg-surface`, `border-border`). `globals.css` clears
all default Tailwind colors with `--color-*: initial` — arbitrary hex bypasses
the light/dark theme entirely.

### 3. Wrong Default Tailwind Color Names

**Detection:** className contains `blue-500`, `gray-100`, `slate-800`,
`zinc-700`, `purple-600`, or any Tailwind default palette name.
**Resolution:** These do not exist — `--color-*: initial` wiped the full default
palette. Use only project tokens: `background`, `surface`, `surface-alt`, `border`,
`border-focus`, `foreground`, `muted`, `accent`, `accent-hover`, `accent-dim`,
`error`, `success`, `warning`, `caret`, `selection`.

### 4. Inline SVG in Non-Icon Component

**Detection:** A `<svg>` element appears directly in a component that is not in
`src/components/icons/`.
**Resolution:** Create a new icon component in `src/components/icons/{Name}Icon.tsx`
following the `IconProps { size?: number }` pattern. Import it into the parent.

### 5. Missing `data-testid` on Interactive Elements

**Detection:** A button, input, select, or primary container div has no
`data-testid` attribute.
**Resolution:** Add `data-testid="kebab-case-name"` matching the component purpose.
All test queries use `screen.getByTestId()` as the primary selector convention.

### 6. No `beforeEach` Store Reset in Tests

**Detection:** Test file imports from `@/stores/*` but has no `beforeEach` block
calling `useXxxStore.setState({...})` to reset to initial state.
**Resolution:** Add `beforeEach(() => { cleanup(); useXxxStore.setState({...}); })`.
Without this, state from one test leaks into the next.

### 7. Missing `describe` Wrapper

**Detection:** Test file has `it(...)` or `test(...)` calls at the top level
without a `describe("ComponentName", () => {...})` wrapper.
**Resolution:** Wrap all test cases in `describe("ComponentName", () => {...})`.

### 8. `useState` for Theme Instead of `useThemeStore`

**Detection:** Component manages theme state with `useState("dark")` or reads
`localStorage.getItem("theme")` directly.
**Resolution:** Import `useThemeStore` from `@/stores/useThemeStore`. The store
owns theme state, applies `data-theme`, and syncs to localStorage.

### 9. Relative Import for Cross-Directory Modules

**Detection:** Import path starts with `../` to reach `stores/` or `lib/`.
**Resolution:** Use absolute imports: `@/stores/useCalcStore`, `@/lib/engine`.
The `@` alias maps to `src/` in both tsconfig and vitest config. Note: relative
imports for sibling components are fine (e.g., `./icons/SunIcon` from within
`src/components/`).

### 10. Interactive Component Missing `"use client"`

**Detection:** Component has event handlers (`onClick`, `onChange`, etc.) or
hooks but omits `"use client"` — perhaps assuming "presentational" status.
**Resolution:** Per CLAUDE.md the project is client-side only. Add `"use client"`
to all components with hooks or event handlers. The only valid omission is a
pure render function with no hooks and no event handlers (the ResultLine pattern).

---

## Behavioral Instructions

### Phase 1: Classify Component Type

1. Identify which archetype matches the request:
   - **store-connected** — reads or writes a Zustand store (`useCalcStore`, `useThemeStore`)
   - **interactive** — has event handlers or hooks but no store dependency
   - **presentational** — pure render function, no hooks, no events (ResultLine pattern)
   - **icon** — SVG icon destined for `src/components/icons/`

2. IF archetype is ambiguous, default to **interactive** (adds `"use client"`).
   Omitting the directive when needed causes a runtime crash; including it
   unnecessarily has no cost.

### Phase 2: Resolve Output Paths

3. Determine file paths:
   - icon archetype → `src/components/icons/{Name}Icon.tsx`
   - all others → `src/components/{ComponentName}.tsx`
4. Test file is always co-located:
   - `src/components/{ComponentName}.test.tsx`
   - or `src/components/icons/{Name}Icon.test.tsx` for icons

### Phase 3: Generate Component File

5. First line:
   - IF presentational or icon: no directive.
   - IF store-connected or interactive: `"use client"` as the absolute first line.

6. Define the props interface ABOVE the component function:
   - Name: `{ComponentName}Props`
   - Icon exception: use `IconProps { size?: number }` (shared name, no prefix)
   - IF no props needed: omit the interface entirely (Calculator and ThemeToggle
     patterns take no props)

7. Write the component as `export default function ComponentName(...)`.
   Destructure props in the signature: `function Foo({ bar }: FooProps)`.

8. Apply interactive state classes per DESIGN.md for every interactive element:
   - Hover: `hover:bg-surface-alt` (backgrounds) or `hover:text-accent-hover` (text)
   - Focus: `ring-2 ring-accent ring-offset-2 ring-offset-background`
   - Active: `active:scale-[0.98]`
   - Disabled: `opacity-50 cursor-not-allowed`
   - Transition: `transition-colors duration-150 ease-in-out`

9. Add `data-testid` to the root element and any interactive child elements.
   Use kebab-case matching the component purpose (e.g., `copy-button`, `line-count`).

10. Add `aria-label` to all buttons whose visible content is empty or icon-only.

11. Use only design tokens for colors and spacing. Reference
    `references/design-tokens.md` for the complete token list when selecting values.

12. Scan the generated component against the Anti-Pattern Watchlist before output.

### Phase 4: Generate Test File

13. Structure the test file:

    ```
    import { describe, it, expect, beforeEach } from "vitest";
    import { render, screen, cleanup } from "@testing-library/react";
    import userEvent from "@testing-library/user-event";
    import ComponentName from "./ComponentName";
    // store imports if store-connected

    beforeEach(() => {
      cleanup();
      // store resets if store-connected
    });

    describe("ComponentName", () => {
      // test cases
    });
    ```

14. IF store-connected: reset store state in `beforeEach`:
    - `useCalcStore.setState({ text: "", results: [] })`
    - `useThemeStore.setState({ theme: "dark" })` (include `toggleTheme` if needed)

15. Write test cases covering:
    a. Renders without crashing (smoke test — render + assert root element exists)
    b. Correct `aria-label` or accessible text (if applicable)
    c. User interaction with `const user = userEvent.setup()` then
    `await user.click(...)` / `await user.type(...)`
    d. Store state changes reflected in UI (use `await waitFor(...)` if async)
    e. IF presentational: create a factory helper (like `makeResult()` in
    ResultLine tests), pass different prop shapes, assert output

16. Use `screen.getByTestId()` as the primary query method. Use `screen.getByText()`
    only for content verification, not element selection.

17. Use `await waitFor(() => { ... })` for assertions that depend on store
    updates or async rendering.

### Phase 5: Output

18. Output both files in full. Never truncate with `// ... rest of file`.

19. State the file path as a heading before each file block.

20. After both files, list design token decisions and rationale:
    ```
    ### Design Token Decisions
    - `text-muted` for secondary label → DESIGN.md secondary text color
    - `rounded-md` for button → DESIGN.md: buttons use 6px radius
    ```

---

## Output Format

For each generation request, output exactly:

```
### src/components/{ComponentName}.tsx

[complete file content]

### src/components/{ComponentName}.test.tsx

[complete file content]

### Design Token Decisions

- [token] → [rationale referencing DESIGN.md]
```

For icons, use `src/components/icons/{Name}Icon.tsx` paths instead.

Reference `references/design-tokens.md` when selecting tokens for any color,
shadow level, typography, or spacing decision.

---

## Examples

### Example 1 (BAD): Interactive button with multiple violations

```tsx
// BAD: CopyButton.tsx
import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      style={{ color: "#8b5cf6" }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
```

**Violations:** Missing `"use client"` (#1), hardcoded hex (#2), no `data-testid`
(#5), no `aria-label`, no interactive state classes, inline prop type instead of
interface, no co-located test file.

### Example 1 (GOOD): Same button following all conventions

```tsx
// src/components/CopyButton.tsx
"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      data-testid="copy-button"
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      onClick={handleCopy}
      className="cursor-pointer rounded-md px-3 py-1 font-sans text-sm text-muted
                 transition-colors duration-150 ease-in-out
                 hover:bg-surface-alt hover:text-foreground
                 focus:outline-none focus:ring-2 focus:ring-accent
                 focus:ring-offset-2 focus:ring-offset-background
                 active:scale-[0.98]"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
```

### Example 2 (GOOD): Store-connected component with test file

**Request:** "Create a LineCount component that shows how many lines the user typed."

```tsx
// src/components/LineCount.tsx
"use client";

import { useCalcStore } from "@/stores/useCalcStore";

export default function LineCount() {
  const { text } = useCalcStore();
  const count = text ? text.split("\n").length : 0;

  return (
    <span data-testid="line-count" className="font-sans text-xs text-muted">
      {count} {count === 1 ? "line" : "lines"}
    </span>
  );
}
```

```tsx
// src/components/LineCount.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LineCount from "./LineCount";
import { useCalcStore } from "@/stores/useCalcStore";

beforeEach(() => {
  cleanup();
  useCalcStore.setState({ text: "", results: [] });
});

describe("LineCount", () => {
  it("shows 0 lines when input is empty", () => {
    render(<LineCount />);
    expect(screen.getByTestId("line-count")).toHaveTextContent("0 lines");
  });

  it("shows singular form for single-line input", () => {
    useCalcStore.setState({ text: "2 + 2" });
    render(<LineCount />);
    expect(screen.getByTestId("line-count")).toHaveTextContent("1 line");
  });

  it("counts multiple lines", () => {
    useCalcStore.setState({ text: "1\n2\n3" });
    render(<LineCount />);
    expect(screen.getByTestId("line-count")).toHaveTextContent("3 lines");
  });
});
```

### Example 3 (GOOD): Icon component

**Request:** "Add a CheckIcon."

```tsx
// src/components/icons/CheckIcon.tsx
interface IconProps {
  size?: number;
}

export default function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
```

No `"use client"` — pure render, no hooks, no events. Uses `currentColor` so the
parent's text color class (`text-success`, `text-accent`) propagates through.

---

## Questions This Skill Answers

- "Create a component called [Name]"
- "Add a [Name] component"
- "Make a new [button / dropdown / modal / panel] component"
- "Generate [ComponentName].tsx"
- "I need a component for [X]"
- "Add a [Name] icon"
- "Make a new SVG icon"
- "Build a UI element for [feature]"
- "Create the component and its test file"
- "How should I structure a new component in this project?"
- "What Tailwind classes do I use for hover states?"
- "Should I add 'use client' to this component?"
- "What design tokens are available?"
- "Create a store-connected component that reads [store field]"
- "Make a presentational component for displaying [data]"
