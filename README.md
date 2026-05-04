# Quick Calc

[![CI](https://github.com/danielakl/quick-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/danielakl/quick-calc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/danielakl/quick-calc/graph/badge.svg)](https://codecov.io/gh/danielakl/quick-calc)

A notepad-style calculator that runs entirely in your browser. Type math expressions — one per line — and see results instantly in a side panel. Supports variables, running totals, and shareable links.

## Features

- **Line-by-line evaluation** — each line is an independent expression, evaluated top to bottom
- **Variables** — assign values with `x = 42` and reference them in later lines
- **Constants** — `pi`, `e`, `tau`, `phi`, `infinity` (case-insensitive on input, displayed lowercase), `true`, `false`
- **Built-in helpers** — `prev` (previous result), `sum` (running total), `avg` (running average)
- **Custom functions** — define with `f = x^2 + 1` or `f(x) = x^2 + 1`, then call `f(3)`
- **Derivatives** — `derivate(f)`, `derive(f)`, or `derivative(f)` for symbolic differentiation
- **Integrals** — `integrate(f)`, `integral(f)`, or `antiderivative(f)` for symbolic integration
- **Units** — mathjs units in expressions, e.g. `350 cm * 3`, `volume = 30 m^2 * 15 m`
- **Unit conversion** — convert with `to` or `as`, e.g. `600 sec to min`, `0.5 as %`
- **Currencies** — currency codes work as units; convert with `to`/`as`, e.g. `100 USD to EUR`, `salary = 65000 USD`, `salary as NOK`. Live rates refresh daily and are cached locally.
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

MIT — see [LICENSE](LICENSE) for details.
