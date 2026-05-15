# Quick Calc — Syntax & Capability Audit

**Status:** One-time audit, originally written May 2026 against
`mathjs@15.2.0`. Amended to reflect a follow-up exposure of `tau`,
`phi`, `infinity` (case-insensitive input, lowercase display), `true`,
`false` and a first-class boolean branch in `mapResult`.
Amended again (May 2026) to resolve the §6.1 / §6.2 alignment items:
the bare aggregate identifiers (`sum`, `avg`, `average`, `mean`,
`median`, `mode`, all case-insensitive) are now preprocessed into
calls on the corresponding mathjs functions over the running values,
and `prev` preserves units by storing the raw mathjs result.
`avg` and `average` are also registered as aliases for mathjs `mean`
so the function-call form (`avg(1, 2, 3)`) works directly.
**Scope:** Everything the calculator currently accepts as input, the order in
which it processes a line, and where what's accepted diverges from what's
documented or tested.

This document exists to drive three decisions:

1. **What to surface in the help modal / README** — features that work but
   aren't told to users.
2. **What to disable** — features mathjs supports that aren't useful (or are
   actively confusing) for a notepad calculator.
3. **What to align between custom helpers and mathjs builtins** — historical
   §6.1 / §6.2 items, now resolved.

Symbols used throughout:

- ✅ documented in `HelpModal.tsx` or `README.md`
- ⚠️ works but undocumented
- 🚫 works but probably unwanted
- 🧪 not covered by tests in `src/lib/*.test.ts` or `e2e/`

---

## 1. How the engine is wired

`src/lib/engine.ts:26` instantiates the **full** mathjs surface:

```ts
const math = create(all, {});
```

`all` exports every function, constant, parser, type, and transformer mathjs
ships. There is **no allow-list, no `import.disable`, no AST reject pass** —
anything mathjs's parser recognizes is reachable from a calculator line. The
custom layer on top adds:

- Engine-managed `prev` (raw value, preserves units) plus the bare
  aggregate rewrites for `sum` / `avg` / `average` / `mean` / `median` /
  `mode` (`engine.ts:167-191`, `engine.ts:570-580`,
  `engine.ts:378-398`)
- `avg` / `average` registered as aliases for `math.mean` so the
  function-call form works alongside the bare-line form
  (`engine.ts:30-32`)
- AST-level interception of `derivative` / `derive` / `derivate` and
  `integral` / `integrate` / `antiderivative` (`engine.ts:108-110`,
  `engine.ts:647-672`)
- Custom integral kernel covering the patterns in `src/lib/integral.ts` (the
  built-in `math.derivative()` is reused for differentiation)
- Currency units anchored to USD (`engine.ts:51-90`)
- String pre-processing: `as`→`to`, `sec`→`seconds`, `min`→`minutes`,
  case-insensitive `infinity` and aggregate name normalization, percent
  capture, number→unit-literal rewrite, bare-aggregate rewrite
  (`engine.ts:558-602`)
- Result post-processing: percent multiplier, locale-aware number formatting,
  currency-symbol substitution (`src/lib/formatter.ts`)
- Reserved-name and built-in-function-shadowing guards (`engine.ts:192-197`,
  `engine.ts:606-612`)
- Input sanitization (NFC, bidi/zero-width strip, smart-quote folding,
  control-char strip) — `src/lib/utils/sanitizeString.ts`

Source-of-truth files for everything below:

| File                              | What it owns                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/lib/engine.ts`               | pipeline, `prev` / aggregate rewrites, calculus interception, simplified function assignment, result mapping |
| `src/lib/integral.ts`             | supported integral patterns                                                                                  |
| `src/lib/formatter.ts`            | number / unit / currency-symbol formatting                                                                   |
| `src/lib/currencies.ts`           | ISO + crypto code list, display symbols                                                                      |
| `src/lib/utils/sanitizeString.ts` | input normalization                                                                                          |
| `src/components/HelpModal.tsx`    | what users currently see                                                                                     |

---

## 2. Pipeline — what happens to a single line

The `evaluate()` function (`engine.ts:529-735`) processes each line through
the steps below. Only results whose `LineResult.value` is non-null update
the running totals — that includes plain numbers, `Unit` values (kept raw
so units flow through), coerced BigNumber/Fraction, and booleans (`1`
for `true`, `0` for `false`). Bare aggregate lines (step 4b) are
explicitly excluded from this update so chained aggregates (`sum`
followed by `avg`) don't fold the running totals back into themselves.

| #   | Step                                                                                                                                                                                                                                       | Implementation                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1   | Sanitize (NFC, strip bidi/zero-width/control, fold smart quotes)                                                                                                                                                                           | `sanitizeString.ts:102-170`, called at `engine.ts:533` |
| 2   | Skip blank lines and `//` / `#` comments                                                                                                                                                                                                   | `engine.ts:548-551`                                    |
| 3a  | Capture trailing `to %` / `as %` / `as percent`                                                                                                                                                                                            | `engine.ts:198-205`, `engine.ts:557-559`               |
| 3b  | Replace `as` with `to`                                                                                                                                                                                                                     | `engine.ts:561`                                        |
| 3c  | Rewrite `sec`/`min` to `seconds`/`minutes` (only when not followed by `(`)                                                                                                                                                                 | `engine.ts:562-563`                                    |
| 3d  | Normalize any-case `infinity` token to mathjs's canonical `Infinity` (`/\binfinity\b/gi`)                                                                                                                                                  | `engine.ts:564`                                        |
| 3e  | Lowercase any aggregate identifier (`Sum`, `AVG`, `Average`, …) so mathjs's case-sensitive lookup hits the registered functions                                                                                                            | `engine.ts:182-184`, `engine.ts:565-567`               |
| 4a  | Inject `prev` into scope when a prior numeric/Unit result exists                                                                                                                                                                           | `engine.ts:368-376`, `engine.ts:570`                   |
| 4b  | If the line is a bare aggregate (`sum` / `avg` / `average` / `mean` / `median` / `mode`), rewrite to `<fn>(__qc_running_values)` and stash the values array in scope. With no prior values, emit a silent empty result                     | `engine.ts:378-398`, `engine.ts:573-580`               |
| 4c  | If `<expr> to <unitName>` (or `as <unitName>`) and `<expr>` evaluates to a plain number, rewrite to `(<expr>) <unitName>`                                                                                                                  | `engine.ts:587-600`                                    |
| 5a  | If LHS-of-`=` is a built-in function name → error result                                                                                                                                                                                   | `engine.ts:606-612`                                    |
| 5b  | If LHS-of-`=` is `__proto__`/`constructor`/`prototype` → error (only for calculus and free-var assignments)                                                                                                                                | `engine.ts:652-655`, `engine.ts:682-687`               |
| 6   | `math.parse(processed)` to AST                                                                                                                                                                                                             | `engine.ts:636`                                        |
| 7a  | If node is a calculus call (or `name = calculusCall(...)`), run `processCalculusCall` symbolically; do **not** `evaluate()` first                                                                                                          | `engine.ts:647-674`                                    |
| 7b  | If node is `name = expr` and `expr` has free variables, build a `UserFunc` (simplified function assignment)                                                                                                                                | `engine.ts:679-698`                                    |
| 7c  | Otherwise `node.evaluate(scope)`                                                                                                                                                                                                           | `engine.ts:700`                                        |
| 8   | `mapResult(...)` collapses the result into `{value, display, error, isAssignment}`                                                                                                                                                         | `engine.ts:284-360`                                    |
| 9   | If percent capture (step 3a) was set, multiply value by 100 and append `%`                                                                                                                                                                 | `engine.ts:614-630`                                    |
| 10  | If `value !== null` AND the line wasn't a bare aggregate (step 4b), set `prevValue` and append to `runningValues[]`. The raw mathjs `Unit` is kept when present so unit math flows through; everything else is the formatted numeric value | `engine.ts:665-669`, `engine.ts:716-721`               |
| 11  | On thrown errors: surface only when message matches `/unit/i`; everything else returns an empty result                                                                                                                                     | `engine.ts:723-734`                                    |

`mapResult` (`engine.ts:284-360`) handles eight result shapes:

1. `number` — formatted via `formatNumber()`
2. `Unit` — formatted via `formatUnit()`, magnitude extracted via
   `extractUnitMagnitude()`
3. `BigNumber` / `Fraction` (`isCoercibleNumeric`) — `Number(result)`
4. `MathNode` — `String(result)` as display, `value: null`
5. `UserFunc` — display is the captured expression, `value: null`
6. Bare `function` — error: `"<name> requires N argument(s)"`
7. `boolean` — display `"true"` / `"false"`, value coerced to `1` / `0`
   so booleans participate in `prev` and the running aggregates
8. **Catch-all** — anything else (objects, arrays, complex numbers,
   strings, matrices) falls through to `String(result)` with `value: null`.
   The result is _visible_ but does not feed `prev` or the running
   aggregates.

---

## 3. Built-in mathjs syntax (full reference)

All of the below works in the calculator today. The status column shows
whether the help modal documents it, whether it's tested, and whether the
audit recommends keeping it (recommendations live in §6/§7).

### 3.1 Numeric literals

| Form                    | Example                      | Status |
| ----------------------- | ---------------------------- | ------ |
| Integer                 | `42`                         | ✅     |
| Decimal                 | `1.5`, `.25`                 | ✅     |
| Scientific              | `1.5e3`, `2E-9`              | ⚠️ 🧪  |
| Hexadecimal             | `0xff`, `0xFF`               | ⚠️ 🧪  |
| Binary                  | `0b1010`                     | ⚠️ 🧪  |
| Octal                   | `0o17`                       | ⚠️ 🧪  |
| Implicit multiplication | `2x`, `2(3+4)`, `(1+2)(3+4)` | ⚠️ 🧪  |
| Imaginary               | `3i`, `2 + 3i`               | 🚫 🧪  |

### 3.2 Operators

| Category                   | Operators / forms                                                                |
| -------------------------- | -------------------------------------------------------------------------------- |
| Arithmetic                 | `+`, `-`, `*`, `/`, `%` (mod), `^` (power), unary `-`, unary `+`                 |
| Element-wise (matrix-only) | `.+`, `.-`, `.*`, `./`, `.^`                                                     |
| Assignment                 | `=` (with the engine's free-var detection branching on the RHS)                  |
| Comparison                 | `==`, `!=`, `<`, `>`, `<=`, `>=` (mathjs treats `=` as assignment, not equality) |
| Logical                    | `and`, `or`, `xor`, `not`, plus `&&`, `\|\|`, `!`                                |
| Bitwise                    | `&`, `\|`, `<<`, `>>`, `>>>`, `~` (xor must use `bitXor(...)`)                   |
| Ternary                    | `cond ? a : b`                                                                   |
| Range                      | `a:b`, `a:step:b` (returns a Matrix; see §3.5)                                   |
| Factorial                  | `5!`                                                                             |
| Transpose                  | `m'` (matrix-only)                                                               |
| Unit conversion            | `to`, `in` (and `as`, our alias — see §4.4)                                      |

| Operator                                          | Doc / test status                                |
| ------------------------------------------------- | ------------------------------------------------ |
| `+ - * / ^`                                       | ✅                                               |
| `%` (mod)                                         | ✅ (shown as `17 % 5` in HelpModal `Basic Math`) |
| `==` `!=` `<` `>` `<=` `>=`                       | 🚫 🧪                                            |
| `and` / `or` / `xor` / `not`, `&&` / `\|\|` / `!` | ⚠️ 🧪                                            |
| `&` / `\|` / `<<` / `>>` / `>>>` / `~`            | ⚠️ 🧪                                            |
| `?:` ternary                                      | 🚫 🧪                                            |
| `a:b` range                                       | ⚠️ 🧪 (works; produces a matrix — see §3.5)      |
| `5!` factorial                                    | ⚠️ 🧪                                            |
| `m'` transpose                                    | ⚠️ 🧪 (matrix-only)                              |
| `to` / `in`                                       | ⚠️ (`to` is documented, `in` is not)             |

### 3.3 Identifiers, constants, and Unicode names

The engine supports any Unicode-letter identifier (`engine.ts:164`). mathjs
ships these constants in scope by default:

| Constant                                             | Notes                                                                                                                                                      | Status |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `pi`, `e`                                            | shown in help modal                                                                                                                                        | ✅     |
| `tau`                                                | `2π`; shown in help modal                                                                                                                                  | ✅     |
| `phi`                                                | golden ratio; shown in help modal                                                                                                                          | ✅     |
| `infinity`, `-infinity`                              | case-insensitive on input (rewrite `\binfinity\b/gi → Infinity` at `engine.ts:564`); always rendered lowercase via `formatter.ts:8-13`. `1/0` → `infinity` | ✅     |
| `NaN`                                                | format as themselves (`formatter.ts:7-15`)                                                                                                                 | 🚫 🧪  |
| `null`                                               | rendered via the catch-all branch — `String(result)`                                                                                                       | 🚫 🧪  |
| `true`, `false`                                      | first-class boolean rendering (`engine.ts:341-349`); display `true`/`false`, `value` coerced to `1`/`0` so they feed `prev` and the running aggregates     | ✅     |
| `i`                                                  | imaginary unit, gateway to complex numbers                                                                                                                 | 🚫 🧪  |
| `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2`, `SQRT1_2` | natural-log + sqrt constants                                                                                                                               | 🚫 🧪  |
| `version`                                            | mathjs version string                                                                                                                                      | 🚫 🧪  |

Unicode identifiers tested: `café`, `π` (`engine.test.ts:86,92`).

### 3.4 Function calls and definitions

```text
sqrt(144)
log(1000, 10)
f(x) = x^2 + 1            # traditional
f = x^2 + 1               # simplified — see §4.10
```

mathjs also accepts `chain(value).fn().done()` and method-style calls — they
work in the calculator but are not documented and not tested.

When a user types just a function name (e.g. `sqrt`), mapResult returns an
error showing the required argument count (`engine.ts:331-339`). The
aggregate names `sum` / `avg` / `average` / `mean` / `median` / `mode`
are intercepted earlier (step 4b) and treated as running aggregates over
prior results, so they don't trigger this error.

### 3.5 Containers (likely unwanted — see §7)

| Form                   | Example                | Renders as                        | Status |
| ---------------------- | ---------------------- | --------------------------------- | ------ |
| Array literal          | `[1, 2, 3]`            | `[1, 2, 3]` (catch-all stringify) | 🚫 🧪  |
| Index access (1-based) | `a = [10,20,30]; a[2]` | `20`                              | 🚫 🧪  |
| Matrix (semicolon)     | `[1,2;3,4]`            | `[[1, 2], [3, 4]]`                | 🚫 🧪  |
| Object literal         | `{a: 1, b: 2}`         | `{"a": 1, "b": 2}`                | 🚫 🧪  |
| Property access        | `obj.a`, `obj["a"]`    | numeric value                     | 🚫 🧪  |
| String literal         | `"hello"`              | `"hello"`                         | 🚫 🧪  |
| Range as matrix        | `1:5` → `[1,2,3,4,5]`  | `[1, 2, 3, 4, 5]`                 | 🚫 🧪  |

None of these contribute to `prev` or the running aggregates because
`mapResult` returns `value: null` for them via the `String(result)`
fallback. (Internally a `RangeNode` evaluating to a `Matrix` is also
what mathjs `sum([…])` consumes when the engine rewrites a bare `sum`
line — see §4.2.)

### 3.6 Number-system features

| Feature         | Behavior                                                                                                                                        | Status |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Complex numbers | `2 + 3i`, `complex(2,3)` — render via catch-all                                                                                                 | 🚫 🧪  |
| BigNumber       | `bignumber("1e30")` — coerced back to plain `Number` in `mapResult` (`engine.ts:303-313`); precision past `Number.MAX_SAFE_INTEGER` is **lost** | ⚠️ 🧪  |
| Fraction        | `fraction(1,3)` — same coercion path; user loses the rational form                                                                              | ⚠️ 🧪  |

### 3.7 Standard math functions (categorized index)

Every entry below lives at `math.<name>` (i.e. on the namespace at
`engine.ts:210`). Entries are categorized for the help modal / command
palette — none beyond the modal's six-example set are shipped to users today.

- **Arithmetic & rounding** — `abs`, `sign`, `round`, `ceil`, `floor`,
  `fix`, `mod`, `cbrt`, `nthRoot`, `unaryMinus`, `unaryPlus`, `add`,
  `subtract`, `multiply`, `divide`, `dotMultiply`, `dotDivide`, `dotPow`
- **Powers, roots, logs** — `sqrt`, `cbrt`, `nthRoot`, `pow`, `exp`,
  `expm1`, `log`, `log2`, `log10`, `log1p`
- **Trig (12+)** — `sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `asin`,
  `acos`, `atan`, `atan2`, `asec`, `acsc`, `acot`, plus the hyperbolic
  forms `sinh`, `cosh`, `tanh`, `sech`, `csch`, `coth`, `asinh`, `acosh`,
  `atanh`
- **Statistics** — `mean`, `median`, `mode`, `std`, `variance`,
  `quantileSeq`, `min`, `max`, `sum`, `prod`. The engine registers `avg`
  and `average` as aliases for `mean` (`engine.ts:32`) so all four
  spellings are callable as functions; the bare-line forms (`sum`,
  `avg`, `median`, …) are rewritten to these mathjs functions over the
  running values — see §4.2
- **Combinatorics** — `factorial`, `gamma`, `lgamma`, `multinomial`,
  `combinations`, `permutations`, `bellNumbers`, `catalan`, `composition`,
  `stirlingS2`
- **Probability** — `random`, `randomInt`, `pickRandom`,
  `combinationsWithRep`, `permutationsWithRep`. ⚠️ non-deterministic;
  re-evaluating the line gives a different result each render
- **Bitwise** — `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`,
  `rightArithShift`, `rightLogShift`
- **Number-base formatting** — `format`, `hex`, `bin`, `oct`, `print`,
  `string`, `number`. Already complete for the upcoming hex/bin/oct
  feature — only UX surfaces are missing
- **Type predicates** — `isInteger`, `isNumeric`, `isPositive`,
  `isNegative`, `isPrime`, `isZero`, `isNaN`, `typeOf`. Render via the
  first-class boolean branch in `mapResult` (`engine.ts:341-349`):
  display `"true"` / `"false"`, value coerced to `1` / `0` so they feed
  `prev` and the running aggregates
- **GCD/LCM/etc.** — `gcd`, `lcm`, `xgcd`
- **Matrix / linear algebra** — `det`, `inv`, `transpose`, `trace`,
  `dot`, `cross`, `kron`, `matrix`, `zeros`, `ones`, `eye`, `range`,
  `concat`, `subset`. (Only relevant if §3.5 stays enabled.)
- **Symbolic** — `simplify`, `rationalize`, `derivative`,
  `polynomialRoot`, `parser`. The engine's calculus handlers shadow
  `derivative` (and aliases) at the AST level; everything else here is
  reachable but undocumented and untested

### 3.8 Units

The engine supports any unit mathjs has registered, plus the dynamically
registered currency codes from `src/lib/currencies.ts`.

- Unit literals: `5 m`, `9.81 m/s^2`, `2.5 kg + 300 g`, `30 cm * 3`
- Conversion: `5 ft to m`, `100 USD as EUR`, the percent shortcut `0.5 as %`
- Implicit unit application via the `<number> as|to <unitName>` rewrite
  (`engine.ts:587-600`) — e.g. `150 as usd` is rewritten to `(150) usd`
- The `sec` / `min` rewrite (`engine.ts:562-563`) means `600 sec to min`
  _does_ mean "seconds to minutes"; the `sec(...)` and `min(...)` functions
  are preserved by the negative-lookahead `\b...\b(?!\s*\()`
- All currencies are registered with a lowercase alias, so `100 nok to usd`
  works (`engine.ts:82`)

Built-in units shipped by mathjs (selection): length, mass, time, current,
temperature, amount-of-substance, luminous-intensity, force, energy, power,
pressure, electric, frequency, area, volume, angle, binary (`b`, `B`,
`Kib`, `KB`, …). None of the non-currency unit families are documented in
the help modal beyond a single example each.

### 3.9 Symbolic features beyond derivatives/integrals

mathjs ships these symbolic helpers; all are reachable but untested and
undocumented:

- `simplify(expr)`
- `rationalize(expr)`
- `polynomialRoot(coefficients...)`
- `parser()` — interactive parser instance
- `parse(expr)` — exposes the AST itself (note: `engine.ts:636` calls this
  internally; it's also user-callable)

---

## 4. Custom layer (added by us)

### 4.1 Multi-line evaluation with persistent scope

`engine.ts:529-735` runs every line in input order through a single shared
`scope` object. Variables, custom functions, and `prev` live here. The
running aggregate values live alongside scope as a typed
`runningValues: RunningValue[]` array (`engine.ts:543-544`) and are
exposed to mathjs only when an aggregate line is rewritten (see §4.2).
The scope is fresh on each `evaluate()` call — there is no cross-call
persistence beyond what the caller passes back in.

### 4.2 `prev` and the running aggregates (`sum`, `avg`, `average`, `mean`, `median`, `mode`)

`prev` resolves to a stored value in scope; the aggregate names are
rewritten to mathjs function calls _before_ parsing. Both mechanisms
are reserved in `BUILTIN_NAMES` (`engine.ts:191`) so `collectFreeVars`
won't treat them as user-supplied free variables.

**`prev`**

- Set on every line whose `mapResult` produced a non-null value
  (`engine.ts:665-669`, `engine.ts:716-721`)
- Stored as `RunningValue = number | Unit` (`engine.ts:362-366`). When the
  raw mathjs result is a `Unit`, the unit is preserved verbatim so
  `5 km` followed by `prev + 100 m` evaluates to `5.1 km`. Everything
  else (booleans, BigNumber/Fraction, percent overrides) falls back to
  `lineResult.value` (a plain number)
- Injected into scope by `injectPrev` (`engine.ts:368-376`) once per
  line, only when a prior numeric result exists

**Bare aggregate identifiers**

- `BARE_AGGREGATE_RE` (`engine.ts:181`) matches a whole line that is
  exactly `sum` / `mean` / `avg` / `average` / `median` / `mode`,
  case-insensitive. Step 3e separately lowercases any aggregate name
  appearing anywhere in the input
- `rewriteBareAggregate` (`engine.ts:378-398`) maps the matched name to
  its mathjs function via `AGGREGATE_FN_MAP` (`engine.ts:171-178`),
  stashes `runningValues` under the scope key
  `__qc_running_values` (`AGGREGATE_VALUES_KEY`,
  `engine.ts:187`), and rewrites the line to
  `<fn>(__qc_running_values)`. The line is then evaluated as an
  ordinary mathjs call
- mathjs `sum` / `mean` / `median` accept arrays of `Unit` values
  natively, so unit aggregation works without special-casing (e.g.
  `5 km` then `100 m` then `sum` → `5.1 km`)
- When `runningValues` is empty, `rewriteBareAggregate` returns `null`
  and the engine emits a silent `emptyResult()` instead of letting
  mathjs error
- When the running totals contain incompatible units, mathjs throws
  `"Units do not match"`, which the line-level error handler surfaces
  via the `/unit/i` branch (step 11)
- **Bare aggregate results don't feed back into `runningValues`**
  (`isBareAggregate` flag at `engine.ts:582`). Without this, `sum`
  followed by `avg` would average the inputs plus the sum

**Function-call form**

- mathjs already exposes `sum`, `mean`, `median`, `mode` as functions
- The engine additionally registers `avg` and `average` as aliases for
  `math.mean` (`engine.ts:30-32`) so `avg(1, 2, 3)` and
  `average(1, 2, 3)` work directly
- The function-call form is independent of the running totals — it
  evaluates only its arguments — and contributes its result to
  `runningValues` like any other numeric line

Tested: `engine.test.ts` "builtins: prev, sum, avg" and "aggregate
function-call form" describe blocks.

### 4.3 Comments

Lines matching `/^\s*(\/\/|#)/` are skipped (`engine.ts:166`,
`engine.ts:548`). They occupy the line slot in the result array but render
as empty.

### 4.4 `as` → `to` aliasing

A simple string substitution (`engine.ts:561`):
`processed.replace(/\s+as\s+/g, " to ")`. The mathjs-native `to` and `in`
keywords still work; only `as` is mentioned in the help modal.

### 4.5 Percent conversion and percent literals

The engine recognizes two distinct percent forms via `applyPercent`:

1. **Trailing conversion** — `to %`, `as %`, `to percent`, `as percent`
   captured by `PERCENT_CONVERT_RE`. The suffix is stripped before
   evaluation, then the numeric result is multiplied by 100 and the
   display gets a `%` appended. `0.5 as %` → value `50`, display `"50%"`.
2. **Bare percent literal** — a single numeric literal followed by `%`,
   captured by `TRAILING_PERCENT_RE` (e.g. `50%`, `50 %`, `-0.25%`,
   `1.5e3%`). mathjs already evaluates the trailing `%` itself
   (`50%` → `0.5`), so the engine keeps the fractional value intact and
   only re-formats the display as the original percent form. `50%` →
   value `0.5`, display `"50%"`. The literal regex is restricted to a
   single numeric token so that compound expressions like `2 + 50%` (a
   regular arithmetic result of `2.5`) keep numeric formatting.

Both forms coexist with mathjs's `%` modulo operator: `17 % 5` has a
right-hand operand and matches neither percent regex, so it evaluates
as modulo (`2`).

### 4.6 `<expr> as <unitName>` — number→unit-literal rewrite

mathjs's `to` operator requires a `Unit` LHS; `150 to usd` would error
because `150` is a `Number`. `engine.ts:587-600` probes the LHS, and if it
evaluates to a plain number and the RHS is a known mathjs unit name,
rewrites the line as `(<expr>) <unitName>`. This is what makes `150 as usd`
work end-to-end. But chaining additional expressions fail eg `150 as usd * 10`
results in an error, not `1,500 $`

### 4.7 `sec` / `min` rewrites

`engine.ts:562-563`: `\bsec\b(?!\s*\()` → `seconds`,
`\bmin\b(?!\s*\()` → `minutes`. Without these, `600 sec to min` would
attempt to multiply `600 * sec(min(...))` (the secant of the minimum
function) and fail.

### 4.8 Currency units

`engine.ts:51-90`:

- USD is the base currency unit (`baseName: "currency"`,
  `prefixes: "none"`)
- Each rate gets registered as `code → <rate> USD` with `override: true`
  so daily rate refreshes don't require restart
- `aliases: [code.toLowerCase()]` makes `100 nok to usd` work alongside
  `100 NOK to USD`
- Codes that conflict with built-in mathjs units are skipped silently
- Currency-code → display-symbol substitution happens in
  `formatter.ts:40-54` (`8.9 GBP` displays as `8.9 £`); the symbol table
  lives at `currencies.ts:CURRENCY_SYMBOLS`

### 4.9 Calculus interception

Three derivative aliases (`derivative`, `derive`, `derivate`) and three
integral aliases (`integral`, `integrate`, `antiderivative`) are detected
**before** the AST is evaluated (`engine.ts:108-110`, `engine.ts:647-672`).
Without this, `derivate(x^2)` would default `x` to `1` and pass `1` to
the handler.

The handlers accept three arg shapes:

1. `derivate(expr)` — variable inferred from the unique free symbol
2. `derivate(expr, varName)` — explicit variable
3. `derivate(userFunc)` — operates on a previously-defined `f(x) = ...`

Returns either a numeric result (when no free vars remain) or a callable
`UserFunc` whose `__expr` is the symbolic expression and whose call site
plugs args back into the compiled AST.

Integral support, per `src/lib/integral.ts`:

- **Power rule** (`x^n` → `x^(n+1)/(n+1)`, `x^(-1)` → `log(x)`)
- **Linear-substitution variants** of the above, for `(ax+b)^n`,
  `sin(ax+b)`, `cos(ax+b)`, `tan(ax+b)`, `sec(ax+b)`, `csc(ax+b)`,
  `cot(ax+b)`, `exp(ax+b)`
- **Logarithmic** — `log(x)`, `1/(ax+b)` (constant divided by linear)
- **Sum / difference** — `∫(f ± g) = ∫f ± ∫g`
- **Constant multiple** — `∫(c·f) = c·∫f`
- **Unary minus** — `∫(-f) = -∫f`
- **Constant base, linear exponent** — `c^x`, `c^(ax+b)`
- Anything else (product rule, non-linear arguments, rational functions
  beyond `c/(ax+b)`, `x^x`, etc.) throws an error that propagates through
  the catch in `engine.ts:670-672`. The Beta tag in the help modal
  reflects this.

### 4.10 Simplified function assignment

`engine.ts:679-698`: when a line is `name = expr` and `expr` contains
_free variables_ (symbols not in scope and not in mathjs's namespace), the
engine creates a `UserFunc` instead of evaluating `expr`. Parameters are
the free variables in the order they first appear in the expression. The
function captures the scope at definition time (`engine.ts:265-281`), so
later reassigning a captured variable does **not** retroactively change
the function.

### 4.11 Reserved-name guard

`engine.ts:197`: `__proto__`, `constructor`, `prototype` cannot be used
as assignment targets in the calculus and free-var-function-assignment
branches. Without this, the engine writes directly to the scope object
and could pollute its prototype chain.

### 4.12 Built-in-function-shadowing guard

`engine.ts:606-612` and `engine.ts:639-640`: `sqrt = 5` or `sqrt(x) = x`
yield an error. Constants (`pi`, `e`, etc.) _can_ be shadowed —
`isBuiltinFunction` only checks `typeof === "function"`. Because `avg`
and `average` are imported as functions (§4.2), `avg = 5` is also
rejected.

### 4.13 Result formatting

`src/lib/formatter.ts`:

- **Locale**: hardcoded `"en-US"` at `formatter.ts:18, 26`
- **Integers below `1e15`** — `toLocaleString("en-US")` →
  `1,234,567`
- **Magnitude `≥ 1e15` or non-zero `< 1e-6`** — `toExponential(6)` →
  `1.234000e-6`
- **Otherwise** — `parseFloat(toPrecision(10))` then `toLocaleString`
  with `maximumFractionDigits: 10` → `3.141592654`
- **Units** — `formatUnit(unit)` extracts the leading magnitude with
  `UNIT_MAGNITUDE_RE`, formats it via `formatNumber`, then either appends
  the original unit suffix or substitutes a currency symbol
  (`formatter.ts:40-54`)
- **`infinity` / `-infinity`** — always rendered lowercase regardless of
  the input casing (`formatter.ts:8-13`); input is normalized via
  `\binfinity\b/gi → Infinity` at `engine.ts:564`
- **`NaN`** — formatted as itself (`formatter.ts:14`)
- **Booleans** — `true` / `false` displayed verbatim with numeric value
  `1` / `0` (`engine.ts:341-349`)

---

## 5. Documentation gap matrix

| Feature                                                                                         | In engine | Help modal | README | Tested        |
| ----------------------------------------------------------------------------------------------- | --------- | ---------- | ------ | ------------- |
| `+ - * / ^ %` arithmetic                                                                        | ✅        | ✅         | ✅     | ✅            |
| `// #` comments                                                                                 | ✅        | ✅         | ✅     | ✅            |
| Variable assignment                                                                             | ✅        | ✅         | ✅     | ✅            |
| `pi`, `e`                                                                                       | ✅        | ✅         | ✅     | ✅            |
| `tau`, `phi`                                                                                    | ✅        | ✅         | ✅     | ✅            |
| `infinity` / `-infinity` (case-insensitive input, lowercase out)                                | ✅        | ✅         | ✅     | ✅            |
| `true` / `false` (first-class boolean rendering)                                                | ✅        | ✅         | ✅     | ✅            |
| `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2`, `SQRT1_2`, `version`                                 | ✅        | –          | –      | –             |
| Unicode identifiers (`café`, `π`)                                                               | ✅        | –          | –      | ✅            |
| `prev` (preserves units), bare aggregate `sum` / `avg` / `average` (case-insensitive)           | ✅        | ✅         | ✅     | ✅            |
| Bare aggregate `mean` / `median` / `mode` (case-insensitive)                                    | ✅        | –          | –      | ✅            |
| Aggregate function-call form `sum(...)`, `avg(...)`, `average(...)`, `median(...)`, `mode(...)` | ✅        | –          | –      | ✅            |
| Standard functions (`sqrt`, `sin`, `log`, `round`, `abs`, `max`)                                | ✅        | ✅         | –      | ✅ (subset)   |
| Custom functions `f(x) = …` and `f = x^2+1`                                                     | ✅        | ✅         | ✅     | ✅            |
| Calculus (`derivative` / `integral` aliases)                                                    | ✅        | ✅         | ✅     | ✅            |
| Units `350 cm * 3`, `5 kg + 300 g`                                                              | ✅        | ✅         | ✅     | ✅            |
| Currency conversion                                                                             | ✅        | ✅         | ✅     | ✅            |
| `as` keyword                                                                                    | ✅        | ✅         | ✅     | ✅            |
| `to` keyword (mathjs-native)                                                                    | ✅        | ✅         | ✅     | ✅            |
| `in` keyword (mathjs-native)                                                                    | ✅        | –          | –      | –             |
| Percent conversion `0.5 as %`                                                                   | ✅        | ✅         | ✅     | ✅            |
| Percent literal `50%` / `50 %` (single numeric, display only)                                   | ✅        | –          | –      | ✅            |
| `<number> as <unitName>` rewrite                                                                | ✅        | –          | –      | ✅            |
| `sec` / `min` rewrites                                                                          | ✅        | –          | –      | ✅ (`sec(0)`) |
| Scientific-notation literals `1.5e3`                                                            | ✅        | –          | –      | –             |
| Hex / binary / octal literals `0xff` `0b1010` `0o17`                                            | ✅        | –          | –      | –             |
| Implicit multiplication `2x`, `2(3+4)`                                                          | ✅        | –          | –      | –             |
| Comparison `==` `!=` `<` `>` `<=` `>=`                                                          | ✅        | –          | –      | –             |
| Logical `and` `or` `xor` `not`, `&&` `\|\|` `!`                                                 | ✅        | –          | –      | –             |
| Bitwise `&` `\|` `<<` `>>` `>>>` `~`                                                            | ✅        | –          | –      | –             |
| Ternary `cond ? a : b`                                                                          | ✅        | –          | –      | –             |
| Range `a:b`, `a:step:b` (returns matrix)                                                        | ✅        | –          | –      | –             |
| Factorial `5!`                                                                                  | ✅        | –          | –      | –             |
| Transpose `m'`                                                                                  | ✅        | –          | –      | –             |
| Statistical functions `std` `variance` `quantileSeq` `min` `max` `prod`                         | ✅        | –          | –      | –             |
| Combinatorics `factorial` `gamma` `combinations` `permutations`                                 | ✅        | –          | –      | –             |
| Probability `random` `randomInt` `pickRandom`                                                   | ✅        | –          | –      | –             |
| GCD/LCM (`gcd`, `lcm`, `xgcd`)                                                                  | ✅        | –          | –      | –             |
| Type predicates (`isInteger`, `isPrime`, …)                                                     | ✅        | –          | –      | –             |
| Number-base format helpers (`hex`, `bin`, `oct`, `format`)                                      | ✅        | –          | –      | –             |
| Symbolic helpers (`simplify`, `rationalize`, `polynomialRoot`)                                  | ✅        | –          | –      | –             |
| Array literal `[1,2,3]`, indexing `a[1]`                                                        | ✅        | –          | –      | –             |
| Matrix literal `[1,2;3,4]`, matrix ops                                                          | ✅        | –          | –      | –             |
| Object literal `{a:1}`, property access                                                         | ✅        | –          | –      | –             |
| String literal `"hello"`, string functions                                                      | ✅        | –          | –      | –             |
| Complex numbers `2 + 3i`, `i`, `complex(...)`                                                   | ✅        | –          | –      | –             |
| `BigNumber` / `Fraction` (coerced back to Number)                                               | ✅        | –          | –      | –             |
| `NaN` literal                                                                                   | ✅        | –          | –      | –             |

A "✅" in the tested column means at least one assertion in
`src/lib/*.test.ts` or `e2e/*.spec.ts` exercises that path. A dash means
nothing in the test suite touches it.

---

## 6. Inconsistencies & alignment issues

### 6.1 `sum` / `average` collide with mathjs's `sum()` / `mean()` functions — **RESOLVED (May 2026)**

**Original observation.** mathjs ships `sum(...)` and `mean(...)` as
functions that accept arrays of `Unit` values
(`mean(1 m, 2 m, 3 m) = 2 m`). The previous implementation injected
`sum` and `average` as scope _values_ holding running totals computed
by JS reductions — magnitude-only, ignoring units. The bare-identifier
form and the function-call form had different semantics under the
same name.

**Resolution.** The bare aggregate names (`sum`, `mean`, `avg`,
`average`, `median`, `mode`) are now preprocessed into calls on the
matching mathjs function over the running values (see §4.2).
`avg` / `average` are registered as aliases for `math.mean`
(`engine.ts:30-32`) so the function-call form works directly. There's
only one semantic now — running aggregate over prior values, computed
by mathjs — and unit math flows through naturally.

### 6.2 `prev` doesn't preserve units — **RESOLVED (May 2026)**

**Original observation.** `numericValues` previously stored
`LineResult.value`, which strips units down to magnitude. So `5 km`
followed by `prev + 100 m` evaluated to `5.1 m` rather than `5.1 km`,
and `sum`/`average` inherited the same limitation.

**Resolution.** `runningValues` is now typed
`RunningValue[] = (number | Unit)[]` (`engine.ts:362-366`). When the
raw mathjs result is a `Unit`, the `Unit` is stored verbatim; otherwise
the formatted numeric `lineResult.value` is stored (which preserves
percent-override magnitudes such as `0.5 as %` → `50`). `prev` is
injected directly from this typed value (`engine.ts:368-376`), so unit
arithmetic survives across lines.

### 6.3 `to` and `in` are documented as one keyword; `in` is not mentioned

**Observation.** The help modal (`HelpModal.tsx:165-180`) says "Convert
between units with `to` or `as`." mathjs accepts `5 ft in m` as
equivalent to `5 ft to m`; the engine doesn't intercept it, so it works.
Users who know mathjs may try it and succeed without any documentation.

**Recommendation.** Extend the `as`→`to` rewrite to
also accept `in`, and document `to` / `as` / `in` together.

**Rationale.** What's wrong is the silent
discrepancy. Users discovering `in` works after reading docs that omit
it will reasonably conclude the docs are incomplete in other places too.

### 6.4 Number formatting is locale-locked to `en-US`

**Observation.** `formatter.ts:18, 26` hardcode `toLocaleString("en-US")`.
The output uses `,` for thousands and `.` for the decimal regardless of
the user's locale.

**Recommendation.** Plumb a `locale` option into `formatNumber` and
`formatUnit`. Default to the first supported locale from `navigator.languages`.
Store formatting settings in a store backed by local storage. Let the user
customize number formatting options (thousand separator, fraction separator).

**Rationale.** `de-DE`, `nb-NO`, `fr-FR`, etc. write `1.234,56` instead
of `1,234.56`. A calculator that ignores that is a calculator most of
the world will read incorrectly on first contact.

### 6.6 Error policy is asymmetric

**Observation.** `engine.ts:723-734`: only error messages matching
`/unit/i` are surfaced. Everything else (parse errors, undefined
symbols, division by zero in some shapes, integral failures from
`engine.ts:670-672` surfaced separately) returns an empty result.
The intent is "let users type incrementally," but a typo like
`sin x` (no parens) silently shows nothing — users cannot tell whether
the expression is incomplete, mistyped, or evaluating to `0`.

**Recommendation.** Ship a "mode-aware" classifier:

- _Incomplete-input_ errors (trailing operator, unmatched paren, bare
  function) → empty / dim affordance
- _Definite-typo_ errors (unknown symbol that's not assignable in
  context, mismatched arity on a known function) → render the error
  alongside the empty result, possibly muted

**Rationale.** The current asymmetry was a sensible default when there
was nowhere to put errors. If the planned input overlay (with inline
errors) lands, this distinction needs to exist anyway.

### 6.7 Catch-all stringification masks unwanted result types

**Observation.** `engine.ts:351-358` falls through to
`String(result)` for any value mapResult doesn't recognize. Booleans
were previously caught here too, but now have a first-class branch at
`engine.ts:341-349` (display + numeric value); the catch-all now only
swallows strings ("hello"), arrays ("[1, 2, 3]"), matrices
("[[1, 2], [3, 4]]"), objects (`'{"a": 1}'`), and complex numbers
("2 + 3i"). Each renders as if it were a valid calculator result, but
its `value` is `null` so it doesn't feed `prev` or the running
aggregates. The line _looks_ successful and silently isn't — an
undiscovered footgun.

A noteworthy case: `mode([1, 2, 2, 3])` returns an _array_ (mathjs
returns mode as an array because data can be multimodal), which falls
into this branch and renders as `[2]` rather than `2`. Bare `mode`
lines hit the same path.

**Recommendation.** Replace the catch-all with an explicit error per
type group, keyed off mathjs type predicates (`isMatrix`, `isComplex`,
`isString`, etc.). The error message should match the §7 disable plan
(e.g. "matrix expressions aren't supported").

**Rationale.** Either we support these (then they need help-modal
coverage and `value` semantics) or we don't (then the user should be
told). Catch-all stringify is the worst of both worlds: it looks
supported and isn't.

---

## 7. Unwanted features (decision section)

Each block below proposes removing a mathjs feature that currently
slips through because of `create(all, {})`. The recommendation is the
mechanism we'd use; the rationale explains why disabling beats
documenting.

### 7.1 Array, matrix, and index syntax (`[1,2,3]`, `[1,2;3,4]`, `a[1]`)

**Observation.** Both literals parse and evaluate; both render via the
catch-all stringify branch (§6.7). Index access is 1-based, which would
surprise any developer assuming JavaScript semantics. None of this is
documented or tested.

**Recommendation.** Add an AST reject pass after `math.parse(processed)`
(`engine.ts:636`) that walks the tree and surfaces an error if it sees
`ArrayNode` or `IndexNode`. mathjs doesn't expose a reliable
configuration switch for "no arrays" — the cleanest path is a
post-parse traversal. Note: any reject pass needs to allow the
`__qc_running_values` array exposed by the bare-aggregate rewrite
(§4.2), or the bare `sum` / `avg` / … forms will break.

**Rationale.** Notepad calculators don't need vectors. Disabling closes
the §6.7 footgun for these specific types and reduces surface area for
the upcoming input overlay (no need to syntax-highlight `[`).

### 7.2 Object literals and property access (`{a: 1}`, `obj.a`, `obj["a"]`)

**Observation.** Same parse/evaluate/render path as §7.1; same lack of
documentation and tests.

**Recommendation.** Reject `ObjectNode` and the property-access form of
`AccessorNode` in the same AST reject pass.

**Rationale.** No notepad-calculator UX involves typing a JS-style
object. The presence of `{` / `}` pulls the parser into a syntactic
corner that has no useful follow-up; rejecting it is strictly better
than letting it stringify silently.

### 7.3 Complex numbers (`i`, `2 + 3i`, `complex(2, 3)`)

**Observation.** `i` is in mathjs's namespace as `complex(0, 1)`. Any
expression that evaluates to a `Complex` falls into the catch-all
branch.

**Recommendation.** Two complementary changes:

1. Remove `i` from the user-facing scope — `delete (math as any).i` is
   too blunt; instead, filter it out of the probe scope and
   short-circuit symbol nodes named `i` in the AST reject pass.
2. Reject results where `math.isComplex(result)` is true in
   `mapResult`.

**Rationale.** Engineers may want complex numbers, but quick-calc.app
doesn't market itself there, and `i` shadows variables users actually
want to define (e.g. `i = 5` is currently allowed, but `i + 1` then
returns `6`, not `5 + i`, in confusing ways). Disabling the imaginary
branch removes a class of "WTF" bugs.

### 7.4 String literals and string functions (`"hello"`, `concat`, `split`, …)

**Observation.** mathjs accepts `"a string"`, returns it, and renders
via the catch-all.

**Recommendation.** Reject `ConstantNode` whose `valueType === "string"`
in the AST pass. Also reject calls to mathjs's string-only functions
(`concat` accepting strings, `split`, `format` with non-numeric input,
etc.) by examining the function-name set.

**Rationale.** No calculator workflow needs strings. They exist in
mathjs to support `format(...)` and similar utilities — those are not
part of our help-modal surface.

### 7.5 Range expressions as containers (`1:5`, `1:2:9`)

**Observation.** Mathjs evaluates `a:b` to a Matrix. `1:5` shows
`[1, 2, 3, 4, 5]`. A user who writes `1:5` expecting "1 over 5"
probably won't, but `pace = 1:5` would parse and assign a matrix.

**Recommendation.** Reject `RangeNode` in the same AST pass. Note that
this is the same reject path as §7.1 — `RangeNode` only produces
useful output as a matrix, so once matrices are gone, ranges go too.

**Rationale.** Ranges have no use in a notepad calculator absent
matrices.

### 7.6 Non-deterministic random functions (`random`, `randomInt`, `pickRandom`)

**Observation.** Calling any of these mid-document means re-evaluating
the document on the next keystroke produces a different value, and
`prev`/`sum`/`average` jitter accordingly. The calculator re-runs
`evaluate()` on every input change.

**Recommendation.** Reject calls to `random`, `randomInt`, `pickRandom`
in the AST pass _unless_ a future "evaluate once" mode is added.
Alternatively, seed mathjs's RNG from a stable hash of the document
text so the result is deterministic per-document.

**Rationale.** Stable, reproducible URLs are a documented feature
(README:8-22). Random functions break that contract — a shared URL
would give different recipients different results.

### 7.7 `infinity` / `NaN` as identifier-style literals

**Observation.** Users can write `infinity` (any case — input is
normalized via `\binfinity\b/gi` at `engine.ts:564`) or `NaN` directly.
Both render as themselves and feed `prev` and the running aggregates
with those values, so `infinity` then `prev + 1` returns `infinity`.

**Recommendation.** Keep `infinity`, drop `NaN`.

**Rationale.** Operations that produce `infinity` or `NaN` (e.g.
`1/0`, `log(0)`) need to format somehow; the literals are the same
representation. Removing them creates inconsistency between
"can't type it" and "can produce it accidentally". Results producing
`NaN` should display an error.

---

## 8. Verification

After this report is merged, the team can validate the audit by:

1. **Spot-check the gap matrix.** Open the dev server (`pnpm dev`),
   paste each of these into the calculator, confirm the documented
   behavior (or update the report if reality disagrees):

   ```text
   0xff
   0b1010
   2x + 3
   5!
   1:5
   2 + 3i
   [1, 2, 3]
   {a: 1, b: 2}
   "hello"
   true and false
   3 == 3
   mean(1, 2, 3)
   avg(1, 2, 3)            (mean alias — see §4.2)
   median(1, 2, 3, 4)
   mode(1, 2, 2, 3)        (renders as [2] — see §6.7)
   gcd(12, 18)
   factorial(6)
   simplify("2x + 3x")
   bitAnd(12, 10)
   5 ft in m
   5 km                    (then) prev + 100 m   (expect 5.1 km — §4.2)
   5 km                    (then) 100 m  (then) sum   (expect 5.1 km)
   5 km                    (then) 2 kg   (then) sum   (expect "Units do not match")
   10 (then) 20 (then) 30 (then) Sum (then) AVG (then) Average  (expect 60, 20, 20 — case-insensitive, bare aggregates don't recurse)
   ```

2. **Decide on each §6 / §7 block.** For inconsistencies, accept,
   reject, or schedule the recommendation. For unwanted features,
   choose between disabling (recommended) and documenting.

3. **Open follow-up issues** for every untested ✅-engine row in the
   gap matrix that the team plans to keep, so they get covered before
   the upcoming input-overlay / autocomplete work surfaces them to
   users.

4. **Run the suite.** `pnpm typecheck && pnpm test && pnpm lint` should
   stay green — this report adds no code.
