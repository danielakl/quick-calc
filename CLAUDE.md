# Quick Calc

Notepad-style calculator web app. Users type math expressions (one per line) and see results in a right-hand panel. Supports variables, assignments, `prev`/`sum`/`avg` builtins, and shareable URLs via compressed query params.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, Space Grotesk (UI) + Space Mono (calculator) fonts, self-hosted via `next/font/local`
- **Design:** See `DESIGN.md` for colors, typography, spacing, and theming guidelines
- **State:** Zustand — stores at `src/stores/` (useCalcStore.ts, useThemeStore.ts)
- **Math engine:** mathjs — evaluation in `src/lib/engine.ts`
- **Package manager:** pnpm

## Project structure

```
src/
  app/             # Next.js App Router (layout, page, globals.css, icon.svg)
  components/      # Calculator.tsx (main UI), ResultLine.tsx, ThemeToggle.tsx
  components/icons/ # SVG icon components (Logo, SunIcon, MoonIcon)
  lib/             # engine.ts (mathjs evaluation), formatter.ts (number display)
  stores/          # useCalcStore.ts (URL sync via lz-string), useThemeStore.ts (theme)
public/            # Static assets (theme-init.js)
e2e/               # Playwright E2E tests
```

## Commands

```sh
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint (--max-warnings 0)
pnpm lint:fix     # ESLint with auto-fix
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest unit/component tests
pnpm test:unit    # Vitest unit/component tests (alias)
pnpm test:coverage # Vitest with v8 coverage report
pnpm test:e2e     # Playwright E2E tests (Chromium)
pnpm test:watch   # Vitest in watch mode
pnpm format       # Prettier — write
pnpm format:check # Prettier — check
```

## Git hooks (husky)

- **pre-commit:** `lint-staged` (eslint --fix + prettier on staged files)
- **pre-push:** `typecheck` + `test`

## Conventions

- Client-side only — all components use `"use client"`. Keep it this way to minimize hosting costs.
- Use Zustand for state management, not plain localStorage or other state libs.
- Use pnpm, not npm or yarn.
- URL state is compressed with lz-string and stored in the `?q=` query param.
- **Theming:** Dark/light theme via CSS custom properties on `<html data-theme="light">`. Dark is the default. Theme preference is persisted in `localStorage` under key `theme`, falling back to `prefers-color-scheme`. A blocking script (`public/theme-init.js`) prevents FOUC.
- **Design tokens:** All colors, shadows, fonts, and radii are locked down in the Tailwind `@theme` block in `globals.css`. Default Tailwind values are cleared — only tokens from `DESIGN.md` are available. Do not add one-off hex values.
- **Typography:** Inter (proportional, `font-sans`) for UI chrome; JetBrains Mono (`font-mono`) for calculator input/output.
- **Icons:** SVG icon components live in `src/components/icons/`. Do not use inline SVGs in components.
