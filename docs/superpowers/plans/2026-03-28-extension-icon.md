# Extension Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the solid-color placeholder icons with a winking buddy character, served in light (gradient) and dark (navy) variants based on the user's OS theme.

**Architecture:** Rewrite `generate-icons.js` to use the `canvas` npm package for programmatic PNG generation. A single `node generate-icons.js` run produces 6 files (3 sizes × 2 themes) into `src/icons/`. Update `manifest.json` to declare `theme_icons` so Chrome auto-serves the right variant. No webpack changes needed — the existing CopyPlugin already copies all of `src/icons/`.

**Tech Stack:** Node.js, `canvas` npm package (Canvas 2D API), Chrome MV3 `theme_icons`

---

## File Map

| File | Action |
|------|--------|
| `generate-icons.js` | Rewrite — draw buddy character with Canvas 2D |
| `src/icons/icon16.png` | Regenerated (light/gradient variant) |
| `src/icons/icon48.png` | Regenerated (light/gradient variant) |
| `src/icons/icon128.png` | Regenerated (light/gradient variant) |
| `src/icons/icon16-dark.png` | New (dark/navy variant) |
| `src/icons/icon48-dark.png` | New (dark/navy variant) |
| `src/icons/icon128-dark.png` | New (dark/navy variant) |
| `manifest.json` | Add `theme_icons` block to `action` |
| `package.json` | Add `canvas` dev dependency (auto-updated by npm) |

---

## Task 1: Install the canvas dependency

**Files:**
- Modify: `package.json` (auto-updated by npm)

- [ ] **Step 1: Install canvas**

```bash
npm install --save-dev canvas
```

Expected output: `added N packages` with no errors.

> **Windows note:** `canvas` uses native bindings (node-gyp). If this fails with a build error, you need the Windows Build Tools. Run this first, then retry:
> ```bash
> npm install --global windows-build-tools
> ```
> Or install "Desktop development with C++" via Visual Studio Installer.

- [ ] **Step 2: Verify installation**

```bash
node -e "const { createCanvas } = require('canvas'); const c = createCanvas(10,10); console.log('canvas ok', c.width);"
```

Expected: `canvas ok 10`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add canvas dev dependency for icon generation"
```

---

## Task 2: Rewrite generate-icons.js

**Files:**
- Modify: `generate-icons.js`

The script draws the same buddy at three sizes for each of two themes. All coordinates are expressed as fractions of `S` (the canvas size) so they scale automatically.

### Drawing reference (fractions of S)

| Element | Value |
|---------|-------|
| Background corner radius | `S * 0.22` |
| Face center | `(S*0.5, S*0.455)` |
| Face radius | `S * 0.266` |
| Wink arc (left eye) | from `(S*0.37, S*0.40)` to `(S*0.46, S*0.40)`, control point `(S*0.415, S*0.36)` |
| Right eye center | `(S*0.60, S*0.40)`, radius `S*0.047` |
| Right eye shine | offset `+S*0.016, -S*0.016`, radius `S*0.016` |
| Smirk | from `(S*0.39, S*0.52)` to `(S*0.61, S*0.52)`, control point `(S*0.50, S*0.60)` |
| Bracket font size | `S * 0.19` |
| Left bracket x | `S * 0.14` |
| Right bracket x | `S * 0.73` |
| Brackets y | face center y + `S*0.055` |

Brackets are **omitted at 16px** — face only for legibility.

### Theme colours

| Token | Light | Dark |
|-------|-------|------|
| Background | gradient `#8b9ffa` → `#3a54e8` (top-left to bottom-right) | solid `#1a1f2e` |
| Face fill | `#ffffff` | `#4f6ef7` |
| Eye/mouth stroke | `#4f6ef7` | `#ffffff` |
| Right eye fill | `#4f6ef7` | `#ffffff` |
| Right eye shine | `#ffffff` | `#4f6ef7` |
| Bracket colour | `#ffffff` | `#4f6ef7` |

- [ ] **Step 1: Overwrite generate-icons.js with the new implementation**

```js
'use strict';
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 48, 128];

const THEMES = {
  light: {
    suffix: '',
    bg: 'gradient',        // top-left #8b9ffa → bottom-right #3a54e8
    face: '#ffffff',
    eyeStroke: '#4f6ef7',
    eyeFill: '#4f6ef7',
    eyeShine: '#ffffff',
    smirkStroke: '#4f6ef7',
    bracketColor: '#ffffff',
  },
  dark: {
    suffix: '-dark',
    bg: '#1a1f2e',
    face: '#4f6ef7',
    eyeStroke: '#ffffff',
    eyeFill: '#ffffff',
    eyeShine: '#4f6ef7',
    smirkStroke: '#ffffff',
    bracketColor: '#4f6ef7',
  },
};

function drawIcon(S, theme) {
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // --- Background ---
  const r = S * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(S - r, 0);
  ctx.quadraticCurveTo(S, 0, S, r);
  ctx.lineTo(S, S - r);
  ctx.quadraticCurveTo(S, S, S - r, S);
  ctx.lineTo(r, S);
  ctx.quadraticCurveTo(0, S, 0, S - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  if (theme.bg === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, '#8b9ffa');
    grad.addColorStop(1, '#3a54e8');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = theme.bg;
  }
  ctx.fill();

  // --- Face circle ---
  const fx = S * 0.5;
  const fy = S * 0.455;
  const fr = S * 0.266;
  ctx.beginPath();
  ctx.arc(fx, fy, fr, 0, Math.PI * 2);
  ctx.fillStyle = theme.face;
  ctx.fill();

  // --- Wink (left eye) ---
  ctx.beginPath();
  ctx.moveTo(S * 0.37, S * 0.40);
  ctx.quadraticCurveTo(S * 0.415, S * 0.36, S * 0.46, S * 0.40);
  ctx.strokeStyle = theme.eyeStroke;
  ctx.lineWidth = Math.max(1, S * 0.028);
  ctx.lineCap = 'round';
  ctx.stroke();

  // --- Right eye ---
  const ex = S * 0.60;
  const ey = S * 0.40;
  const er = S * 0.047;
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.fillStyle = theme.eyeFill;
  ctx.fill();

  // shine
  ctx.beginPath();
  ctx.arc(ex + S * 0.016, ey - S * 0.016, S * 0.016, 0, Math.PI * 2);
  ctx.fillStyle = theme.eyeShine;
  ctx.fill();

  // --- Smirk ---
  ctx.beginPath();
  ctx.moveTo(S * 0.39, S * 0.52);
  ctx.quadraticCurveTo(S * 0.50, S * 0.60, S * 0.61, S * 0.52);
  ctx.strokeStyle = theme.smirkStroke;
  ctx.lineWidth = Math.max(1, S * 0.028);
  ctx.lineCap = 'round';
  ctx.stroke();

  // --- Code brackets (48px+ only) ---
  if (S >= 48) {
    const fontSize = Math.round(S * 0.19);
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = theme.bracketColor;
    ctx.textBaseline = 'middle';
    const brackY = fy + S * 0.055;
    ctx.fillText('<', S * 0.14, brackY);
    ctx.fillText('>', S * 0.73, brackY);
  }

  return canvas.toBuffer('image/png');
}

const iconsDir = path.join(__dirname, 'src', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const [themeName, theme] of Object.entries(THEMES)) {
  for (const size of SIZES) {
    const buf = drawIcon(size, theme);
    const filename = `icon${size}${theme.suffix}.png`;
    fs.writeFileSync(path.join(iconsDir, filename), buf);
    console.log(`Created ${filename}`);
  }
}
```

- [ ] **Step 2: Run the script and verify output**

```bash
node generate-icons.js
```

Expected output:
```
Created icon16.png
Created icon48.png
Created icon128.png
Created icon16-dark.png
Created icon48-dark.png
Created icon128-dark.png
```

Check that all 6 files exist:
```bash
ls src/icons/
```

Expected: `icon16.png  icon16-dark.png  icon48.png  icon48-dark.png  icon128.png  icon128-dark.png`

- [ ] **Step 3: Do a quick sanity check — verify files are non-trivial PNGs**

```bash
node -e "
const fs = require('fs');
['icon16','icon48','icon128','icon16-dark','icon48-dark','icon128-dark'].forEach(name => {
  const buf = fs.readFileSync('src/icons/' + name + '.png');
  const isPng = buf[0]===137 && buf[1]===80 && buf[2]===78 && buf[3]===71;
  const size = buf.length;
  console.log(name + '.png', isPng ? 'valid PNG' : 'INVALID', size + ' bytes');
});
"
```

Expected: all 6 files print `valid PNG` with size > 500 bytes. The 128px files will be largest (likely 5–20 KB), 16px smallest.

- [ ] **Step 4: Open one icon visually to confirm it looks right**

```bash
# Windows — opens in default image viewer
start src/icons/icon128.png
```

You should see: blue/purple gradient background, white circular face, left eye closed (wink), right eye open, smirk, `<` and `>` brackets on either side.

Then check the dark variant:
```bash
start src/icons/icon128-dark.png
```

You should see: dark navy background, blue circular face, white eye details.

- [ ] **Step 5: Commit**

```bash
git add generate-icons.js src/icons/
git commit -m "feat: generate winking buddy icon in light and dark variants"
```

---

## Task 3: Update manifest.json with theme_icons

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add theme_icons to the action block**

Open `manifest.json`. Replace the `"action"` block:

```json
"action": {
  "default_title": "Developer Buddy",
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

`default_icon` remains unchanged — it's the fallback when Chrome can't determine the theme.

- [ ] **Step 2: Validate the manifest is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest.json is valid JSON');"
```

Expected: `manifest.json is valid JSON`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add theme_icons to serve light/dark icon variants"
```

---

## Task 4: Build and final verification

**Files:**
- Read: `dist/icons/` (verify dark icons are copied)

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 2: Verify dark icons made it into dist**

```bash
ls dist/icons/
```

Expected: all 6 PNG files present (`icon16.png`, `icon16-dark.png`, `icon48.png`, `icon48-dark.png`, `icon128.png`, `icon128-dark.png`).

- [ ] **Step 3: Load the extension in Chrome and verify**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Check the extension icon in the Chrome toolbar — it should show the winking buddy
5. Toggle your OS between light and dark mode and confirm the icon changes variant

- [ ] **Step 4: Final commit**

```bash
git add dist/
git commit -m "chore: rebuild dist with buddy icon"
```

> Note: if `dist/` is in `.gitignore`, skip this step.
