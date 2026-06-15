# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based tool for designing decorative wall paneling (wainscoting, picture-frame moulding, board-and-batten, grids). It's a Vite + React app that **builds to a single self-contained `dist/index.html`** (all JS/CSS inlined via `vite-plugin-singlefile`) — no CDN, works offline, deployable to any static host.

The app source is `src/main.jsx` (one big component plus a module-scope layout engine). `index.html` is the Vite entry template (meta tags, favicon, `#root`); `src/styles.css` holds the base + print styles.

## Running / building / deploying

- `npm install` then `npm run dev` — local dev server with HMR.
- `npm run build` — emits the self-contained `dist/index.html`. `npm run preview` serves the built file.
- **No tests, no linter.** Verification is manual: build (or dev) and exercise the UI in a browser. esbuild/Vite catches syntax errors but not runtime React errors.
- **Deploy**: pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. Pages **Source must be set to "GitHub Actions"** (not "Deploy from a branch"). Because everything is inlined, the Pages base path doesn't matter and `dist/index.html` also works opened directly from disk. Live site: https://gusdeboer.github.io/wall-paneling-planner/.

## Architecture

The app is one React component, `WallPanelingPlanner`, in `src/main.jsx`. Key structural pieces:

- **`layoutPanels(s)`** — module-scope **pure layout engine**. Given wall size + layout params (with explicit `marginLeft`/`marginRight`), it returns `{ panels, err, chairRailY? }`. This is the single source of truth, shared by both the live preview (`autoCalc`) and the saved-design thumbnails (`MiniPreview`) — keep them using it rather than re-deriving panel math.

- **`store`** — a thin `localStorage` wrapper that mimics an async key/value API (`list`/`get`/`set`/`delete`). It's the only persistence; saved designs (with thumbnails) live under a key prefix. Nothing is ever sent off-device.
- **State** — a large flat set of `useState` hooks at the top of the component (wall dimensions, layout type, margins, colors, moulding, photo overlay, free-placement panels, etc.). `snapshot()` / `applySnapshot()` serialize all of it for save/load.
- **`autoCalc` (`useMemo`)** — thin wrapper that calls `layoutPanels` with the current state (passing `marginRightEff`, which equals the left margin when `symLock` is on) and adds `valid: !err`. Layout validation errors (e.g. margins exceeding wall size) surface as `err` strings shown in the preview instead of crashing. Layout keys: `single-row`, `two-row`, `grid`, `wainscot`, `tall-vertical`, `framed-feature`.
- **Two modes**: auto layout (panels derive from `autoCalc`) and **free placement** (`freeMode`). Entering free mode freezes `autoCalc.panels` into editable `panels` state; `activePanels` is whichever set is live. Free mode adds drag/resize via pointer handlers (`startDrag`/`onDrag`/`endDrag`), grid snapping (`snapVal`), and alignment guides (`computeGuides`).
- **Coordinate system**: all model values are in real-world units (cm or inches). `scale` converts units → SVG pixels (`px = pad + value * scale`); `eventToUnits` inverts pointer coordinates back to units. The wall is one SVG; panels, rulers, baseboard/crown, and photo overlay are all drawn into it.
- **Derived outputs**: `totalMoulding` (`useMemo`) sums panel perimeters (plus chair-rail run in wainscot); `buy` (`useMemo`) turns that into stock-piece count, waste %, and optional cost from `stockLen`/`pricePerLen`. The cut list, `.txt` export, and print view all read from `activePanels` + these derived values.

### Things to know when editing

- **Units**: all stored numbers are in the active `unit`. Switching units runs `changeUnit`, which **multiplies every length-valued state (and free-mode panels) by 2.54 or 1/2.54** so physical dimensions are preserved, not just relabeled. When adding a new length-valued state, add it to `changeUnit`, `snapshot`, and `applySnapshot`. Totals also show m/ft via `toBig`.
- Adding a new layout means extending the `layoutPanels` branch list and the layout button list; keep the `{ panels, err }` contract so both the preview and thumbnails work.
- Print uses `window.print()` + `@media print` rules in `src/styles.css`. Anything that shouldn't print (controls, saved designs, buttons, the buy-list inputs) is marked `className="no-print"`; the preview and cut-list cards are `className="card"`.
- The README documents every control in user-facing detail — consult it before changing UI behavior.
