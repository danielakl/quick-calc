# WCAG Contrast Primer

Reference for computing and validating color contrast ratios per WCAG 2.1.

---

## Relative Luminance Formula (WCAG 2.1)

Given a hex color `#RRGGBB`:

1. Convert each channel to sRGB (0-1 range): `sRGB = channel / 255`
2. Linearize each channel:
   - IF `sRGB <= 0.04045`: `linear = sRGB / 12.92`
   - IF `sRGB > 0.04045`: `linear = ((sRGB + 0.055) / 1.055) ^ 2.4`
3. Compute luminance: `L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear`

Result is in range [0, 1] where 0 = black and 1 = white.

---

## Contrast Ratio Formula

```
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Where `L_lighter` is the higher luminance value. Result is always >= 1.

---

## WCAG AA Thresholds

| Text Category                        | Minimum Ratio | DESIGN.md Reference            |
| ------------------------------------ | ------------- | ------------------------------ |
| Normal text (< 18px)                 | 4.5:1         | Most calculator text (14px)    |
| Large text (>= 18px or >= 14px bold) | 3:1           | Section headings (18px medium) |
| UI components and graphical objects  | 3:1           | Icons, borders, focus rings    |

WCAG AAA (enhanced) requires 7:1 for normal text and 4.5:1 for large text.
Quick Calc targets AA as the minimum per DESIGN.md Contrast Requirements.

---

## Alpha Blending for rgba Colors

Some tokens use `rgba()` values (e.g., `accent-dim`, `selection`). To compute
effective contrast, blend the foreground onto the background:

```
effective_channel = alpha * fg_channel + (1 - alpha) * bg_channel
```

Apply per-channel, then compute luminance of the blended result.

Example: `rgba(139, 92, 246, 0.45)` on `#0c0a14` (dark background):

- R: 0.45 _ 139 + 0.55 _ 12 = 69.15 (~69)
- G: 0.45 _ 92 + 0.55 _ 10 = 46.90 (~47)
- B: 0.45 _ 246 + 0.55 _ 20 = 121.70 (~122)
- Blended effective color: approximately `#452F7A`

---

## Precomputed Contrast Table: Existing Quick Calc Tokens

These are approximate ratios for the current token set. Recompute from the
formula above when values change.

### Dark Theme (background: `#0c0a14`, L ~ 0.0035)

| Foreground Token | Hex       | Luminance | Ratio vs Background | Ratio vs Surface | AA Normal         |
| ---------------- | --------- | --------- | ------------------- | ---------------- | ----------------- |
| `foreground`     | `#e8e4f0` | 0.7893    | 15.70:1             | 14.63:1          | Pass              |
| `muted`          | `#9890a8` | 0.2945    | 6.44:1              | 6.00:1           | Pass              |
| `accent`         | `#8b5cf6` | 0.1980    | 4.64:1              | 4.32:1           | Pass / Borderline |
| `error`          | `#f87171` | 0.3296    | 7.10:1              | 6.62:1           | Pass              |
| `success`        | `#4ade80` | 0.5526    | 11.27:1             | 10.50:1          | Pass              |
| `warning`        | `#fbbf24` | 0.5790    | 11.77:1             | 10.96:1          | Pass              |

Surface: `#161225` (L ~ 0.0074)

**Note:** `accent` on `surface` is borderline (4.32:1) for normal-sized text.
At `text-sm` (14px regular), this requires 4.5:1. The dark background pairing
(4.64:1) passes, but surface pairing fails. Flag this if accent text ever
appears on a `surface` panel.

### Light Theme (background: `#f5f3ef`, L ~ 0.8975)

| Foreground Token | Hex       | Luminance | Ratio vs Background | Ratio vs Surface | AA Normal |
| ---------------- | --------- | --------- | ------------------- | ---------------- | --------- |
| `foreground`     | `#1c1a17` | 0.0105    | 15.67:1             | 16.38:1          | Pass      |
| `muted`          | `#6e6960` | 0.1426    | 4.92:1              | 5.14:1           | Pass      |
| `accent`         | `#7c3aed` | 0.1343    | 5.14:1              | 5.38:1           | Pass      |
| `error`          | `#cc2626` | 0.1436    | 4.89:1              | 5.12:1           | Pass      |
| `success`        | `#0d7a3a` | 0.1431    | 4.91:1              | 5.13:1           | Pass      |
| `warning`        | `#a84b08` | 0.1337    | 5.16:1              | 5.39:1           | Pass      |

Surface: `#faf8f5` (L ~ 0.935)

---

## Common Background Pairings to Check

When a new color token is proposed, compute its ratio against these backgrounds:

| Context          | Dark Background | Light Background |
| ---------------- | --------------- | ---------------- |
| Page text        | `#0c0a14`       | `#f5f3ef`        |
| Panel/card text  | `#161225`       | `#faf8f5`        |
| Hover state text | `#1e1a30`       | `#edeae4`        |

IF the token is a background color (not text), check that `foreground` and
`muted` tokens maintain their ratios against the new background.

---

## Worked Example: Checking a New Color

Proposed: `--color-info: #3b82f6` (dark theme) used as text on background.

1. Hex `#3b82f6`: R=59, G=130, B=246
2. sRGB: R=0.2314, G=0.5098, B=0.9647
3. Linearize:
   - R: ((0.2314 + 0.055) / 1.055)^2.4 = 0.2716^2.4 ~ 0.0440
   - G: ((0.5098 + 0.055) / 1.055)^2.4 = 0.5353^2.4 ~ 0.2232
   - B: ((0.9647 + 0.055) / 1.055)^2.4 = 0.9663^2.4 ~ 0.9267
4. Luminance: 0.2126(0.0440) + 0.7152(0.2232) + 0.0722(0.9267) = 0.236
5. Contrast vs dark background (L=0.0035):
   (0.236 + 0.05) / (0.0035 + 0.05) = 0.286 / 0.054 = 5.3:1
6. Result: **Pass AA** for normal text (>= 4.5:1)
