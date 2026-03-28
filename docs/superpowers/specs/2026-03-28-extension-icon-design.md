# Developer Buddy — Extension Icon Design

**Date:** 2026-03-28
**Status:** Approved
**Author:** Brainstorming session

---

## Overview

Design and implement a custom icon for the Developer Buddy Chrome extension, replacing the current solid-color placeholder. The icon features a winking "buddy" character that communicates the extension's friendly, developer-focused personality.

---

## Design

### Concept

A circular face with:
- **Left eye:** closed in a wink (curved line)
- **Right eye:** open dot with a white shine highlight
- **Mouth:** a confident smirk (upward curve)
- **Code brackets** (`<` and `>`) flanking the face, rendered in monospace

### Theme Variants

Chrome MV3 `theme_icons` supports serving different icons based on the OS color scheme. Two variants will be produced:

| Variant | Background | Face color | Bracket color |
|---------|-----------|------------|---------------|
| **Light** | Diagonal gradient `#8b9ffa` → `#3a54e8` | White | White |
| **Dark** | Solid navy `#1a1f2e` | `#4f6ef7` (brand blue) | `#4f6ef7` (brand blue) |

### Sizes

Both variants are generated at: **16×16**, **48×48**, **128×128** px.

### Design rationale

- **Winking + smirk** — "cool and confident", not just generically happy. Matches the "buddy" name without being childish.
- **Code brackets** — immediately signals a developer tool; visible at 48px and 128px, omitted at 16px for legibility.
- **Dark variant** — developer-aesthetic, stands out on dark browser toolbars. Light variant (gradient) works on Chrome's default light toolbar.

---

## Implementation

### Approach

Update `generate-icons.js` to draw the buddy using the **`canvas`** npm package (Node.js Canvas 2D API). This extends the existing script pattern — no build pipeline changes required.

### Steps

1. **Install dependency:** `npm install --save-dev canvas`
   - Note: `canvas` has native bindings and requires build tools (node-gyp) on Windows. If `npm install` fails, install the [Windows Build Tools](https://github.com/nodejs/node-gyp#on-windows) first.
2. **Rewrite `generate-icons.js`** to generate both themes in a single run:
   - Draw each size (16, 48, 128) for the light/gradient variant → `src/icons/icon{size}.png`
   - Draw each size for the dark/navy variant → `src/icons/icon{size}-dark.png`
   - Single invocation: `node generate-icons.js` produces all 6 files.
3. **Update `manifest.json`** to add `theme_icons`:
   ```json
   "action": {
     "default_icon": {
       "16": "icons/icon16.png",
       "48": "icons/icon48.png",
       "128": "icons/icon128.png"
     },
     "theme_icons": [
       {
         "light": {
           "16": "icons/icon16.png",
           "48": "icons/icon48.png",
           "128": "icons/icon128.png"
         },
         "dark": {
           "16": "icons/icon16-dark.png",
           "48": "icons/icon48-dark.png",
           "128": "icons/icon128-dark.png"
         }
       }
     ]
   }
   ```
   - Note: `theme_icons` is an array of objects each with `light` and `dark` keys — verify against [Chrome extension docs](https://developer.chrome.com/docs/extensions/reference/api/action#color_schemes) if in doubt.
4. **Run `node generate-icons.js`** to regenerate all icons.
   - The existing webpack CopyPlugin already copies the entire `src/icons/` directory, so no build config changes are needed — dark variant files will be included automatically.

### Drawing details (per size)

The icon scales all drawing coordinates proportionally. At size `S`:

- **Background:** rounded rect, corner radius `≈ S * 0.22`
- **Face circle:** center `(S*0.5, S*0.455)`, radius `≈ S * 0.266`
- **Wink (left eye):** arc from `(S*0.37, S*0.40)` to `(S*0.46, S*0.40)` with upward curve
- **Right eye:** filled circle at `(S*0.60, S*0.40)`, radius `≈ S*0.047`; white shine dot offset `(+0.016S, -0.016S)`, radius `S*0.016`
- **Smirk:** arc from `(S*0.39, S*0.52)` to `(S*0.61, S*0.52)` curving down
- **Brackets (48px+ only):** `<` at `x ≈ S*0.14`, `>` at `x ≈ S*0.73`, y centered on face, font size `≈ S*0.19`

At **16px**, brackets are omitted — only the face is drawn for legibility.

---

## Files Changed

| File | Change |
|------|--------|
| `generate-icons.js` | Rewritten to draw buddy character with Canvas 2D |
| `src/icons/icon16.png` | Regenerated (light/gradient) |
| `src/icons/icon48.png` | Regenerated (light/gradient) |
| `src/icons/icon128.png` | Regenerated (light/gradient) |
| `src/icons/icon16-dark.png` | New (dark variant) |
| `src/icons/icon48-dark.png` | New (dark variant) |
| `src/icons/icon128-dark.png` | New (dark variant) |
| `manifest.json` | Add `theme_icons` block |
| `webpack.config.js` | No change needed — existing CopyPlugin already copies all of `src/icons/` |
| `package.json` | Add `canvas` dev dependency |
