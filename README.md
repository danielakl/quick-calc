# Quick Calc

A notepad-style calculator that runs entirely in your browser. Type math expressions — one per line — and see results instantly in a side panel. Supports variables, running totals, and shareable links.

## Features

- **Line-by-line evaluation** — each line is an independent expression, evaluated top to bottom
- **Variables** — assign values with `x = 42` and reference them in later lines
- **Built-in helpers** — `prev` (previous result), `sum` (running total), `average` (running average)
- **Comments** — lines starting with `//` or `#` are ignored
- **Shareable URLs** — your entire notepad is compressed into the URL so you can share or bookmark calculations
- **Dark/light theme** — toggle in the header, respects system preference, persists to localStorage
- **Runs client-side** — nothing is sent to a server; all math happens in your browser

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

### Install and run

```sh
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```sh
pnpm build          # Production build
pnpm start          # Serve production build
pnpm lint           # Run ESLint (fails on warnings)
pnpm lint:fix       # Run ESLint with auto-fix
pnpm typecheck      # Run TypeScript type checking
pnpm format         # Format code with Prettier
pnpm format:check   # Check formatting without writing
```

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) 4 with locked-down design tokens (see [`DESIGN.md`](DESIGN.md))
- [Inter](https://rsms.me/inter/) (UI) + [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (calculator) fonts
- [mathjs](https://mathjs.org/) for expression parsing and evaluation
- [Zustand](https://zustand.docs.pmnd.rs/) for state management
- [lz-string](https://pieroxy.net/blog/pages/lz-string/index.html) for URL compression

## Project structure

```
src/
  app/               Layout, page entry point, global styles, favicon (icon.svg)
  components/        Calculator (main UI), ResultLine, ThemeToggle
  components/icons/  SVG icon components (Logo, SunIcon, MoonIcon)
  lib/               engine (mathjs evaluation logic), formatter (number display)
  stores/            Zustand stores (calc state + URL sync, theme)
public/              Static assets (theme-init.js)
e2e/                 Playwright E2E tests
```

## License

This project is not currently licensed for redistribution. All rights reserved.
