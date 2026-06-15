# Wall Paneling Planner

A single-file, browser-based tool for designing decorative wall paneling (wainscoting, picture-frame moulding, board-and-batten, grids, and feature walls). Enter your wall dimensions, pick a layout and style, preview it on a scaled drawing of your wall — or on a photo of the real wall — and get an accurate cut list and total moulding length to take to the shop.

No build step, no backend, no dependencies to install. It's one `index.html` file that runs entirely in the browser.

---

## Live demo / hosting

This is designed to run on **GitHub Pages** (or any static host).

1. Create a GitHub repository.
2. Add the `index.html` file to the root of the repo and commit.
3. Go to **Settings → Pages**.
4. Set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`, and save.
5. After ~1 minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

It also works by simply opening `index.html` directly in any modern browser — no server required.

---

## How it works

The wall is drawn to scale as an SVG. Everything you change in the left-hand controls updates the preview live. Two modes are available:

- **Auto layout** (default) — you choose a layout type and a few numbers, and panels are placed and sized automatically and symmetrically.
- **Free placement** — panels become individually draggable and resizable so you can position them by hand.

Below the preview you get a **cut list** (the exact width and height of every panel) and a **materials summary** (panel count, total moulding length, wall area). You can save multiple designs and reload or compare them later.

---

## Controls

### Units
Switch between **Centimeters** and **Inches**. Every measurement in the tool, the cut list, and the export use the selected unit. Totals are also shown in meters (cm mode) or feet (inches mode).

### Wall dimensions
- **Wall width** — the full width of the wall.
- **Wall height** — the full height, floor to ceiling.

These define the scale of the drawing and bound where panels can go.

### Free placement
A toggle that switches between auto layout and hand placement.

- **Off** — panels are generated automatically from the layout settings below.
- **On** — the current auto layout is "frozen" into individual panels you can drag and resize. The auto-layout controls are disabled while this is on.

When Free placement is on you also get:
- **Snap to grid** — movement and resizing snap to this interval (e.g. every 5 cm). Set it to `0` to move freely. A faint grid appears on the wall as a guide.
- **+ Add** — adds a new panel to the wall.
- **Duplicate** — copies the currently selected panel.
- **Delete** — removes the selected panel.
- **Even** — re-distributes all panels back into the calculated symmetric layout.
- **Alignment guides** — while dragging, dashed orange lines appear when a panel's edge or center lines up with another panel, the wall edges, or the wall midline.
- **Selected panel** fields — type exact **X**, **Y**, **Width**, and **Height** values for pixel-perfect placement. Drag the orange corner handle to resize visually.

### Layout
Six preset arrangements (used in auto mode):

| Layout | Description |
|---|---|
| **Single row** | One row of equal panels across the wall. |
| **Tall + base** | A row of tall upper panels above a row of shorter base panels — the classic two-tier wainscot look. |
| **Grid** | A full grid of equal panels; you set both columns and rows. |
| **Wainscot** | Panels only on the lower portion of the wall, below an adjustable chair-rail line. |
| **Vertical slats** | Narrow vertical panels spanning the height — increase the count for a slatted/board-and-batten effect. |
| **Feature + sides** | One large central panel flanked by two tall, narrow side panels. |

### Panel / spacing settings
These appear depending on the chosen layout:

- **Number of panels** (or **Columns** in Grid mode) — how many panels across.
- **Gap between** — horizontal spacing between adjacent panels.
- **Rows** + **Row gap** (Grid) — number of rows and the vertical spacing between them.
- **Base panel height** + **Row gap** (Tall + base) — height of the lower row and the gap above it.
- **Chair rail height** (Wainscot) — how high up the wall the chair rail sits; panels fill below it.

### Margins from wall edge
The empty border between the panel block and the wall edges:

- **Top** — space from the ceiling to the top of the panels.
- **Bottom** — space from the floor to the bottom of the panels.
- **Sides** — space from each side wall to the outermost panels.
- **Keep left/right margins equal** — keeps the layout symmetrical (recommended).

### Moulding style
The visual profile of the trim:

- **Classic (single trim)** — a standard single moulding frame.
- **Double trim** — a frame with a second inner line.
- **Bold / beveled** — a chunkier, heavier profile.
- **Thin minimalist** — a slim, subtle profile.

The style also affects the visual thickness of the moulding relative to the width you set below.

### Moulding width (profile)
The real-world width of your moulding stock (e.g. 3 cm). This feeds both the visual thickness in the preview **and** the materials math, so the total length reflects the actual trim you'll buy.

### Wall color
Ten presets covering common interior tones (beige, greige, taupe, off-white, sage, clay, charcoal, etc.) plus a custom color picker (the rainbow swatch) for any exact shade.

### Trim / moulding color
A separate color for the moulding itself, so you can do white trim on a dark wall, tone-on-tone, or an accent color. Includes a custom picker.

### Room reference
- **Show baseboard, ceiling & crown** — draws the baseboard, ceiling line, and crown moulding as visual context so panels are framed the way they'll look on a real wall.
- **Baseboard height** / **Crown height** — adjust those reference bands. (Hidden automatically when a photo overlay is loaded.)

### Photo overlay
- **Choose photo** — upload a straight-on photo of your actual wall.
- **Photo opacity** — blend between the photo and the flat preview so you can see panels against the real wall.
- **Remove photo** — clears it.

The photo stays on your device only; it is not uploaded anywhere.

---

## Preview

The main drawing shows your wall to scale, with:

- A **width ruler** along the bottom and a **height ruler** down the left, both labeled in your chosen unit.
- **3D-shaded moulding** — a light highlight on the top/left edges and a soft shadow on the bottom/right, so panels read as raised rather than flat outlines.
- The **chair rail line** drawn across the wall in Wainscot mode.
- Helpful **error messages** when a layout doesn't fit (e.g. "Top + bottom margins exceed the wall height") instead of a blank screen.

---

## Cut list & materials

Beneath the preview:

- **Total panels** — how many panels in the current design.
- **Moulding profile** — the moulding width in use.
- **Total moulding length** — the sum of every panel's perimeter (plus the chair-rail run in Wainscot mode), shown in your unit and in meters/feet. Use this to estimate how much trim to purchase.
- **Wall area** — total wall area in m² or ft².
- A scrollable **per-panel table** listing the exact width and height of each panel. In Free placement mode, clicking a row selects that panel.
- **Export .txt** — downloads the full cut list (wall size, layout, moulding width, every panel dimension, and totals) as a plain text file.

---

## Saved designs

- **Save current** — stores the entire current design (dimensions, layout, colors, moulding, panels, everything) with a thumbnail preview.
- **Load** — restores a saved design back into the editor.
- **✕** — deletes a saved design.

Saved designs are stored in your browser's `localStorage`. This means:

- They persist on the same browser/device between visits.
- They are **not** synced across devices or browsers.
- Clearing your browser data will remove them.

This is the trade-off for a tool that needs no server or account.

---

## Technical notes

- Built as a single HTML file using **React 18** and **Babel Standalone** loaded from a CDN, so the JSX compiles in the browser. This means a one-time internet connection is needed to load those libraries, and there's a brief (~1 second) compile delay on first load.
- All state is held in the browser; the only persistence is `localStorage` for saved designs.
- No data ever leaves your device — photos, dimensions, and designs are all local.

### Want faster loading?
For an instant-loading, CDN-free version, the same component can be built with **Vite** (`npm create vite`), which compiles everything into static files ahead of time. That also deploys to GitHub Pages — just set Vite's `base` option to `/<repo-name>/`.

---

## License

Free to use and modify for personal projects. Add your own license here if you plan to share it publicly.
