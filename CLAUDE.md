# Quick Calc

Notepad-style calculator web app. Users type math expressions (one per line) and see results in a right-hand panel. Supports variables, assignments, `prev`/`sum`/`average` builtins, and shareable URLs via compressed query params.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, JetBrains Mono font
- **State:** Zustand — single store at `src/stores/useCalcStore.ts`
- **Math engine:** mathjs — evaluation in `src/lib/engine.ts`
- **Package manager:** pnpm

## Project structure

```
src/
  app/           # Next.js App Router (layout, page, globals.css)
  components/    # Calculator.tsx (main UI), ResultLine.tsx
  lib/           # engine.ts (mathjs evaluation), formatter.ts (number display)
  stores/        # useCalcStore.ts (Zustand store, URL sync via lz-string)
e2e/             # Playwright E2E tests
```

## Commands

```sh
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
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
