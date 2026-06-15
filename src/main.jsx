import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// ---- localStorage wrapper ----
const store = {
  async list(prefix) {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix)).map((k) => ({ key: k }));
    return { keys };
  },
  async get(key) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("not found");
    return { key, value };
  },
  async set(key, value) { localStorage.setItem(key, value); return { key, value }; },
  async delete(key) { localStorage.removeItem(key); return { key, deleted: true }; },
};

const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const styleMouldFactor = { classic: 1, double: 0.7, beveled: 1.6, thin: 0.5 };

// ---- shared layout engine (used by the main preview AND the saved thumbnails) ----
// Takes real-world dimensions and returns panel rectangles in those same units.
function layoutPanels(s) {
  const W = num(s.W), H = num(s.H);
  const g = num(s.gap), n = Math.max(1, Math.round(num(s.count)));
  const mt = num(s.marginTop), mb = num(s.marginBottom);
  const mL = num(s.marginLeft), mR = num(s.marginRight);
  const usableW = W - mL - mR - g * (n - 1);
  const panelW = usableW / n;
  const colX = (i) => mL + i * (panelW + g);
  const mk = (id, x, y, w, h) => ({ id, x, y, w, h });

  let err = "";
  if (W <= 0 || H <= 0) err = "Enter a wall width and height.";
  else if (mL + mR >= W) err = "Side margins are larger than the wall width.";
  else if (panelW <= 0) err = `Panels don't fit — reduce count (${n}) or gap.`;

  const layout = s.layout;
  if (layout === "single-row" || layout === "tall-vertical") {
    const panelH = H - mt - mb;
    if (panelH <= 0 && !err) err = "Top + bottom margins exceed the wall height.";
    const pre = layout === "tall-vertical" ? "v" : "p";
    return { panels: Array.from({ length: n }, (_, i) => mk(`${pre}${i}`, colX(i), mt, panelW, panelH)), err };
  }
  if (layout === "two-row") {
    const lh = num(s.lowerH), rg = num(s.rowGap), upperH = H - mt - mb - lh - rg;
    if (upperH <= 0 && !err) err = "Not enough height for both rows.";
    const upper = Array.from({ length: n }, (_, i) => mk(`u${i}`, colX(i), mt, panelW, upperH));
    const lower = Array.from({ length: n }, (_, i) => mk(`l${i}`, colX(i), mt + upperH + rg, panelW, lh));
    return { panels: [...upper, ...lower], err };
  }
  if (layout === "grid") {
    const r = Math.max(1, Math.round(num(s.rows))), rg = num(s.rowGap);
    const cellH = (H - mt - mb - rg * (r - 1)) / r;
    if (cellH <= 0 && !err) err = "Not enough height for the rows.";
    const out = [];
    for (let ri = 0; ri < r; ri++) for (let ci = 0; ci < n; ci++) out.push(mk(`g${ri}-${ci}`, colX(ci), mt + ri * (cellH + rg), panelW, cellH));
    return { panels: out, err };
  }
  if (layout === "wainscot") {
    const cr = num(s.chairRail), panelH = cr - mb - mt;
    if (panelH <= 0 && !err) err = "Chair rail too low for the margins.";
    return { panels: Array.from({ length: n }, (_, i) => mk(`w${i}`, colX(i), H - cr + mt, panelW, panelH)), err, chairRailY: H - cr };
  }
  if (layout === "framed-feature") {
    const sideW = Math.min(panelW, (W - mL - mR) * 0.18);
    const centerW = W - mL - mR - sideW * 2 - g * 2, panelH = H - mt - mb;
    if (centerW <= 0 && !err) err = "Not enough width for a centre panel.";
    return { panels: [
      mk("f-left", mL, mt, sideW, panelH),
      mk("f-center", mL + sideW + g, mt, centerW, panelH),
      mk("f-right", mL + sideW + g + centerW + g, mt, sideW, panelH),
    ], err };
  }
  return { panels: [], err: err || "Unknown layout" };
}

function WallPanelingPlanner() {
  const [unit, setUnit] = useState("cm");
  const [wallW, setWallW] = useState(400);
  const [wallH, setWallH] = useState(270);
  const [layout, setLayout] = useState("single-row");
  const [style, setStyle] = useState("classic");
  const [count, setCount] = useState(3);
  const [gap, setGap] = useState(15);
  const [marginTop, setMarginTop] = useState(40);
  const [marginBottom, setMarginBottom] = useState(40);
  const [marginSide, setMarginSide] = useState(30);
  const [marginRight, setMarginRight] = useState(30);
  const [lowerH, setLowerH] = useState(80);
  const [rowGap, setRowGap] = useState(15);
  const [rows, setRows] = useState(2);
  const [chairRail, setChairRail] = useState(110);
  const [wallColor, setWallColor] = useState("#e9e2d6");
  const [trimColor, setTrimColor] = useState("#ffffff");
  const [mouldingW, setMouldingW] = useState(3);
  const [symLock, setSymLock] = useState(true);
  const [showArch, setShowArch] = useState(true);
  const [baseboard, setBaseboard] = useState(12);
  const [crown, setCrown] = useState(8);
  const [photo, setPhoto] = useState(null);
  const [photoOpacity, setPhotoOpacity] = useState(0.5);
  const [freeMode, setFreeMode] = useState(false);
  const [snap, setSnap] = useState(5);
  const [panels, setPanels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [guides, setGuides] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [stockLen, setStockLen] = useState(240);
  const [pricePerLen, setPricePerLen] = useState(0);

  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const wallPresets = [
    { c: "#e9e2d6", n: "Warm beige" }, { c: "#d8cdbd", n: "Greige" },
    { c: "#cfc4b3", n: "Taupe" }, { c: "#eae6dd", n: "Off-white" },
    { c: "#d6d8d2", n: "Sage grey" }, { c: "#c2c7c9", n: "Cool grey" },
    { c: "#cdb6a3", n: "Clay" }, { c: "#b8a894", n: "Mushroom" },
    { c: "#3d4a4d", n: "Deep teal" }, { c: "#2f3338", n: "Charcoal" },
  ];
  const trimPresets = ["#ffffff", "#f3ece1", "#e8e0d2", "#cdb6a3", "#3d3833", "#2f3338"];

  const styles = {
    classic: { inset: 0, label: "Classic (single trim)" },
    double: { inset: 0.3, label: "Double trim" },
    beveled: { inset: 0, label: "Bold / beveled" },
    thin: { inset: 0, label: "Thin minimalist" },
  };

  const W = num(wallW), H = num(wallH);
  const svgW = 1600, pad = 46;
  const scale = W > 0 ? (svgW - pad * 2) / W : 1;
  const svgH = H * scale + pad * 2;
  const mw = num(mouldingW) * (styleMouldFactor[style] || 1);
  const marginRightEff = symLock ? num(marginSide) : num(marginRight);

  useEffect(() => {
    (async () => {
      try {
        const res = await store.list("layout:");
        if (res && res.keys && res.keys.length) {
          const items = [];
          for (const k of res.keys) {
            try { const r = await store.get(k.key); if (r) items.push(JSON.parse(r.value)); } catch {}
          }
          items.sort((a, b) => (a.ts || 0) - (b.ts || 0));
          setSaved(items);
        }
      } catch {}
      setLoadingSaved(false);
    })();
  }, []);

  // Switching units converts every length so a 400 cm wall becomes ~157 in, not 400 in.
  const changeUnit = (u) => {
    if (u === unit) return;
    const f = unit === "cm" && u === "in" ? 1 / 2.54 : unit === "in" && u === "cm" ? 2.54 : 1;
    const c = (v) => Math.round(num(v) * f * 100) / 100;
    setWallW(c(wallW)); setWallH(c(wallH)); setGap(c(gap));
    setMarginTop(c(marginTop)); setMarginBottom(c(marginBottom));
    setMarginSide(c(marginSide)); setMarginRight(c(marginRight));
    setLowerH(c(lowerH)); setRowGap(c(rowGap)); setChairRail(c(chairRail));
    setMouldingW(c(mouldingW)); setBaseboard(c(baseboard)); setCrown(c(crown));
    setSnap(c(snap)); setStockLen(c(stockLen));
    setPanels((prev) => prev.map((p) => ({ ...p, x: c(p.x), y: c(p.y), w: c(p.w), h: c(p.h) })));
    setUnit(u);
  };

  const snapshot = () => ({
    unit, wallW, wallH, layout, style, count, gap, marginTop, marginBottom, marginSide, marginRight, symLock,
    lowerH, rowGap, rows, chairRail, wallColor, trimColor, mouldingW, baseboard, crown, freeMode, panels, stockLen, pricePerLen,
  });

  const applySnapshot = (s) => {
    setUnit(s.unit); setWallW(s.wallW); setWallH(s.wallH); setLayout(s.layout); setStyle(s.style);
    setCount(s.count); setGap(s.gap); setMarginTop(s.marginTop); setMarginBottom(s.marginBottom);
    setMarginSide(s.marginSide); setMarginRight(s.marginRight ?? s.marginSide); setSymLock(s.symLock !== false);
    setLowerH(s.lowerH); setRowGap(s.rowGap); setRows(s.rows);
    setChairRail(s.chairRail); setWallColor(s.wallColor); setTrimColor(s.trimColor ?? "#ffffff");
    setMouldingW(s.mouldingW ?? 3); setBaseboard(s.baseboard ?? 12); setCrown(s.crown ?? 8);
    setStockLen(s.stockLen ?? 240); setPricePerLen(s.pricePerLen ?? 0);
    setFreeMode(s.freeMode); setPanels(s.panels || []); setSelected(null);
  };

  const saveLayout = async () => {
    const id = `layout:${Date.now()}`;
    const data = { id, name: `Design ${saved.length + 1}`, ts: Date.now(), state: snapshot() };
    try { await store.set(id, JSON.stringify(data)); } catch {}
    setSaved((p) => [...p, data]);
  };
  const deleteSaved = async (id) => { try { await store.delete(id); } catch {} setSaved((p) => p.filter((x) => x.id !== id)); };

  const autoCalc = useMemo(() => {
    const r = layoutPanels({
      W, H, layout, count, gap, marginTop, marginBottom,
      marginLeft: marginSide, marginRight: marginRightEff,
      lowerH, rowGap, rows, chairRail,
    });
    return { ...r, valid: !r.err };
  }, [W, H, gap, count, marginTop, marginBottom, marginSide, marginRightEff, layout, lowerH, rowGap, rows, chairRail]);

  const activePanels = freeMode ? panels : autoCalc.panels;
  const enterFreeMode = () => { setPanels(autoCalc.panels.map((p) => ({ ...p }))); setFreeMode(true); };
  const resetToAuto = () => { setPanels(autoCalc.panels.map((p) => ({ ...p }))); setSelected(null); };

  const totalMoulding = useMemo(() => {
    let len = activePanels.reduce((s, p) => s + 2 * (p.w + p.h), 0);
    if (!freeMode && layout === "wainscot" && autoCalc.chairRailY != null) len += W;
    return len;
  }, [activePanels, layout, freeMode, autoCalc, W]);

  const buy = useMemo(() => {
    const sl = num(stockLen);
    const sticks = sl > 0 ? Math.ceil(totalMoulding / sl) : 0;
    const purchased = sticks * sl;
    const waste = purchased > 0 ? (purchased - totalMoulding) / purchased : 0;
    const cost = num(pricePerLen) * sticks;
    return { sticks, waste, cost };
  }, [totalMoulding, stockLen, pricePerLen]);

  const eventToUnits = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * svgW;
    const py = ((e.clientY - rect.top) / rect.height) * svgH;
    return { ux: (px - pad) / scale, uy: (py - pad) / scale };
  }, [svgH, scale]);

  const snapVal = (v) => (num(snap) > 0 ? Math.round(v / num(snap)) * num(snap) : v);

  const computeGuides = (moving) => {
    const gl = [];
    const others = panels.filter((p) => p.id !== moving.id);
    const me = { left: moving.x, right: moving.x + moving.w, cx: moving.x + moving.w / 2, top: moving.y, bottom: moving.y + moving.h, cy: moving.y + moving.h / 2 };
    const tol = num(snap) > 0 ? num(snap) : 2;
    const vT = [0, W, W / 2], hT = [0, H, H / 2];
    others.forEach((o) => { vT.push(o.x, o.x + o.w, o.x + o.w / 2); hT.push(o.y, o.y + o.h, o.y + o.h / 2); });
    [me.left, me.right, me.cx].forEach((val) => vT.forEach((t) => { if (Math.abs(val - t) < tol) gl.push({ x: t }); }));
    [me.top, me.bottom, me.cy].forEach((val) => hT.forEach((t) => { if (Math.abs(val - t) < tol) gl.push({ y: t }); }));
    return gl;
  };

  const startDrag = (e, id, mode = "move") => {
    if (!freeMode) return;
    e.preventDefault(); e.stopPropagation();
    setSelected(id);
    const { ux, uy } = eventToUnits(e);
    const p = panels.find((q) => q.id === id);
    dragRef.current = { id, mode, offX: ux - p.x, offY: uy - p.y, startW: p.w, startH: p.h, sx: ux, sy: uy };
    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", endDrag);
  };

  const onDrag = useCallback((e) => {
    const d = dragRef.current; if (!d) return;
    const { ux, uy } = eventToUnits(e);
    const p = panels.find((q) => q.id === d.id); if (!p) return;
    let np = { ...p };
    if (d.mode === "move") {
      np.x = Math.max(0, Math.min(snapVal(ux - d.offX), W - p.w));
      np.y = Math.max(0, Math.min(snapVal(uy - d.offY), H - p.h));
    } else {
      np.w = Math.max(5, Math.min(snapVal(d.startW + (ux - d.sx)), W - p.x));
      np.h = Math.max(5, Math.min(snapVal(d.startH + (uy - d.sy)), H - p.y));
    }
    setPanels((prev) => prev.map((q) => (q.id === d.id ? np : q)));
    setGuides(computeGuides(np));
  }, [eventToUnits, W, H, snap, panels]);

  const endDrag = useCallback(() => {
    dragRef.current = null; setGuides([]);
    window.removeEventListener("pointermove", onDrag);
    window.removeEventListener("pointerup", endDrag);
  }, [onDrag]);

  const addPanel = () => {
    const id = `c${Date.now()}`;
    setPanels((p) => [...p, { id, x: snapVal(W * 0.3), y: snapVal(H * 0.3), w: Math.min(80, W * 0.3), h: Math.min(120, H * 0.3) }]);
    setSelected(id);
  };
  const deleteSel = () => { if (!selected) return; setPanels((p) => p.filter((x) => x.id !== selected)); setSelected(null); };
  const duplicateSel = () => {
    if (!selected) return;
    const s = panels.find((p) => p.id === selected); if (!s) return;
    const id = `c${Date.now()}`;
    setPanels((p) => [...p, { ...s, id, x: Math.min(s.x + 15, W - s.w), y: Math.min(s.y + 15, H - s.h) }]);
    setSelected(id);
  };

  const valid = freeMode ? panels.length > 0 : autoCalc.valid;
  const fmt = (v) => `${Math.round(v * 10) / 10} ${unit}`;
  const bigUnit = unit === "cm" ? "m" : "ft";
  const toBig = (v) => (v / (unit === "cm" ? 100 : 12)).toFixed(2);
  const selPanel = selected ? activePanels.find((p) => p.id === selected) : null;

  const updateSel = (key, val) => {
    setPanels((prev) => prev.map((p) => {
      if (p.id !== selected) return p;
      let v = num(val); const np = { ...p };
      if (key === "w") np.w = Math.max(5, Math.min(v, W - np.x));
      else if (key === "h") np.h = Math.max(5, Math.min(v, H - np.y));
      else if (key === "x") np.x = Math.max(0, Math.min(v, W - np.w));
      else if (key === "y") np.y = Math.max(0, Math.min(v, H - np.h));
      return np;
    }));
  };

  const handlePhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result);
    r.readAsDataURL(f);
  };

  const exportCutList = () => {
    const lines = [];
    lines.push(`Wall Paneling — Cut List`);
    lines.push(`Wall: ${fmt(W)} x ${fmt(H)}  |  Layout: ${layout}  |  Moulding: ${fmt(mw)} wide`);
    lines.push("");
    activePanels.forEach((p, i) => lines.push(`Panel ${i + 1}: ${fmt(p.w)} W x ${fmt(p.h)} H`));
    lines.push("");
    lines.push(`Total panels: ${activePanels.length}`);
    lines.push(`Total moulding length: ${fmt(totalMoulding)} (${toBig(totalMoulding)} ${bigUnit})`);
    lines.push(`Lengths to buy: ${buy.sticks} x ${fmt(num(stockLen))} (${Math.round(buy.waste * 100)}% waste)`);
    if (num(pricePerLen) > 0) lines.push(`Estimated cost: ${buy.cost.toFixed(2)} (${buy.sticks} x ${num(pricePerLen).toFixed(2)})`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cut-list.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const Panel = ({ p, isSel }) => {
    const x = pad + p.x * scale, y = pad + p.y * scale, w = p.w * scale, h = p.h * scale;
    const t = Math.max(2, mw * scale);
    const ins = styles[style].inset > 0 ? t * 2.2 : 0;
    return (
      <g onPointerDown={(e) => startDrag(e, p.id, "move")} style={{ cursor: freeMode ? "move" : "default" }}>
        <rect x={x} y={y} width={w} height={h} fill="transparent" />
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={trimColor} strokeWidth={t} strokeLinejoin="miter" />
        <path d={`M${x - t/2},${y - t/2} H${x + w + t/2} M${x - t/2},${y - t/2} V${y + h + t/2}`} stroke="#ffffff" strokeOpacity="0.55" strokeWidth={Math.max(1, t * 0.3)} fill="none" />
        <path d={`M${x + w + t/2},${y - t/2} V${y + h + t/2} M${x - t/2},${y + h + t/2} H${x + w + t/2}`} stroke="#000000" strokeOpacity="0.18" strokeWidth={Math.max(1, t * 0.3)} fill="none" />
        {ins > 0 && <rect x={x + ins} y={y + ins} width={Math.max(0, w - ins * 2)} height={Math.max(0, h - ins * 2)} fill="none" stroke={trimColor} strokeWidth={Math.max(1.5, t * 0.6)} />}
        {isSel && (<>
          <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} fill="none" stroke="#c9783a" strokeWidth={2} strokeDasharray="8 5" />
          <rect x={x + w - 7} y={y + h - 7} width={14} height={14} rx={3} fill="#c9783a" onPointerDown={(e) => startDrag(e, p.id, "resize")} style={{ cursor: "nwse-resize" }} />
        </>)}
      </g>
    );
  };

  const Field = ({ label, value, set, min = 0, suffix = unit }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#6b6259", fontWeight: 500 }}>{label}</span>
      <div style={{ position: "relative" }}>
        <input type="number" value={value} min={min} onChange={(e) => set(e.target.value)}
          style={{ width: "100%", padding: "8px 36px 8px 10px", borderRadius: 8, border: "1px solid #ddd5cc", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#a89e92", fontSize: 12 }}>{suffix}</span>
      </div>
    </label>
  );

  const Section = ({ title, children }) => (
    <div style={{ borderTop: "1px solid #eee6db", paddingTop: 14, marginTop: 14 }}>
      <span style={{ color: "#6b6259", fontWeight: 600, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</span>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );

  const baseboardPx = num(baseboard) * scale;
  const crownPx = num(crown) * scale;

  return (
    <div className="app-wrap" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#f5f1ea", padding: 20, color: "#3d3833", minHeight: "100vh" }}>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 4px" }}>Wall Paneling Planner</h1>
        <p style={{ margin: "0 0 20px", color: "#8a8076", fontSize: 14 }}>Design your panel layout, see it on your wall, and get an accurate cut list.</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div className="no-print" style={{ flex: "0 0 340px", minWidth: 300, background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {["cm", "in"].map((u) => (
                <button key={u} onClick={() => changeUnit(u)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid #ddd5cc", cursor: "pointer", background: unit === u ? "#3d3833" : "#fff", color: unit === u ? "#fff" : "#3d3833", fontSize: 13, fontWeight: 500 }}>
                  {u === "cm" ? "Centimeters" : "Inches"}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Field label="Wall width" value={wallW} set={setWallW} />
              <Field label="Wall height" value={wallH} set={setWallH} />
            </div>
            <div style={{ background: "#f7f3ec", borderRadius: 10, padding: 12, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#6b6259" }}>Free placement</span>
                <button onClick={() => (freeMode ? setFreeMode(false) : enterFreeMode())} style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: freeMode ? "#c9a98a" : "#ddd5cc", color: freeMode ? "#fff" : "#6b6259" }}>
                  {freeMode ? "On — drag & resize" : "Off"}
                </button>
              </div>
              {freeMode && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 12.5, color: "#8a8076", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span>Snap to grid</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" value={snap} min={0} onChange={(e) => setSnap(e.target.value)} style={{ width: 56, padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd5cc", fontSize: 12.5 }} />{unit}
                    </span>
                  </label>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={addPanel} style={btnSm}>+ Add</button>
                    <button onClick={duplicateSel} disabled={!selected} style={{ ...btnSm, opacity: selected ? 1 : 0.4 }}>Duplicate</button>
                    <button onClick={deleteSel} disabled={!selected} style={{ ...btnSm, opacity: selected ? 1 : 0.4 }}>Delete</button>
                    <button onClick={resetToAuto} style={btnSm}>Even</button>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#a89e92", lineHeight: 1.4 }}>Drag to move, drag the corner handle to resize. Alignment guides appear automatically.</p>
                </div>
              )}
            </div>
            {freeMode && selPanel && (
              <div style={{ background: "#fff8ef", border: "1px solid #ecdcc6", borderRadius: 10, padding: 12, marginTop: 12 }}>
                <span style={{ color: "#a8794f", fontWeight: 600, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5 }}>Selected panel</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                  <Field label="X (from left)" value={Math.round(selPanel.x * 10) / 10} set={(v) => updateSel("x", v)} />
                  <Field label="Y (from top)" value={Math.round(selPanel.y * 10) / 10} set={(v) => updateSel("y", v)} />
                  <Field label="Width" value={Math.round(selPanel.w * 10) / 10} set={(v) => updateSel("w", v)} />
                  <Field label="Height" value={Math.round(selPanel.h * 10) / 10} set={(v) => updateSel("h", v)} />
                </div>
              </div>
            )}
            <div style={{ opacity: freeMode ? 0.5 : 1, pointerEvents: freeMode ? "none" : "auto", marginTop: 14 }}>
              <span style={{ color: "#6b6259", fontWeight: 500, fontSize: 13 }}>Layout</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                {[["single-row", "Single row"], ["two-row", "Tall + base"], ["grid", "Grid"], ["wainscot", "Wainscot"], ["tall-vertical", "Vertical slats"], ["framed-feature", "Feature + sides"]].map(([v, l]) => (
                  <button key={v} onClick={() => setLayout(v)} style={{ padding: "8px 4px", borderRadius: 8, border: "1px solid #ddd5cc", cursor: "pointer", background: layout === v ? "#c9a98a" : "#fff", color: layout === v ? "#fff" : "#3d3833", fontSize: 12, fontWeight: 500 }}>{l}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                <Field label={layout === "grid" ? "Columns" : "Number of panels"} value={count} set={setCount} min={1} suffix="" />
                <Field label="Gap between" value={gap} set={setGap} />
              </div>
              {layout === "grid" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <Field label="Rows" value={rows} set={setRows} min={1} suffix="" />
                  <Field label="Row gap" value={rowGap} set={setRowGap} />
                </div>
              )}
              {layout === "two-row" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <Field label="Base panel height" value={lowerH} set={setLowerH} />
                  <Field label="Row gap" value={rowGap} set={setRowGap} />
                </div>
              )}
              {layout === "wainscot" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <Field label="Chair rail height" value={chairRail} set={setChairRail} />
                </div>
              )}
              <Section title="Margins from wall edge">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Top" value={marginTop} set={setMarginTop} />
                  <Field label="Bottom" value={marginBottom} set={setMarginBottom} />
                  <Field label={symLock ? "Sides" : "Left"} value={marginSide} set={setMarginSide} />
                  {!symLock && <Field label="Right" value={marginRight} set={setMarginRight} />}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, color: "#8a8076", cursor: "pointer" }}>
                  <input type="checkbox" checked={symLock} onChange={(e) => setSymLock(e.target.checked)} /> Keep left/right margins equal
                </label>
              </Section>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, marginTop: 16 }}>
              <span style={{ color: "#6b6259", fontWeight: 500 }}>Moulding style</span>
              <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd5cc", background: "#fff", fontSize: 14 }}>
                {Object.entries(styles).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 }}>
              <Field label="Moulding width (profile)" value={mouldingW} set={setMouldingW} />
            </div>
            <Section title="Wall color">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {wallPresets.map((p) => <button key={p.c} onClick={() => setWallColor(p.c)} title={p.n} aria-label={p.n} style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: p.c, border: wallColor === p.c ? "2px solid #3d3833" : "1px solid #ddd5cc" }} />)}
                <label style={swatchPicker}><input type="color" value={wallColor} onChange={(e) => setWallColor(e.target.value)} style={hiddenColor} /></label>
              </div>
            </Section>
            <Section title="Trim / moulding color">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {trimPresets.map((c) => <button key={c} onClick={() => setTrimColor(c)} title={c} aria-label={`Trim color ${c}`} style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: c, border: trimColor === c ? "2px solid #3d3833" : "1px solid #ddd5cc" }} />)}
                <label style={swatchPicker}><input type="color" value={trimColor} onChange={(e) => setTrimColor(e.target.value)} style={hiddenColor} /></label>
              </div>
            </Section>
            <Section title="Room reference">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#8a8076", cursor: "pointer", marginBottom: 10 }}>
                <input type="checkbox" checked={showArch} onChange={(e) => setShowArch(e.target.checked)} /> Show baseboard, ceiling &amp; crown
              </label>
              {showArch && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Baseboard height" value={baseboard} set={setBaseboard} />
                  <Field label="Crown height" value={crown} set={setCrown} />
                </div>
              )}
            </Section>
            <Section title="Photo overlay">
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "#a89e92", lineHeight: 1.4 }}>Upload a straight-on photo of your wall to preview panels on it.</p>
              <label style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px dashed #b3a896", textAlign: "center", cursor: "pointer", fontSize: 13, color: "#6b6259" }}>
                {photo ? "Change photo" : "Choose photo"}
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
              </label>
              {photo && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 12.5, color: "#8a8076" }}>Photo opacity: {Math.round(photoOpacity * 100)}%</label>
                  <input type="range" min={0} max={1} step={0.05} value={photoOpacity} onChange={(e) => setPhotoOpacity(parseFloat(e.target.value))} style={{ width: "100%" }} />
                  <button onClick={() => setPhoto(null)} style={{ ...btnSm, marginTop: 6 }}>Remove photo</button>
                </div>
              )}
            </Section>
          </div>
          <div className="preview-col" style={{ flex: "1 1 600px", minWidth: 340 }}>
            <div className="card" style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              {valid ? (
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", display: "block", touchAction: "none" }}
                  onPointerDown={(e) => { if (e.target.dataset.wall) setSelected(null); }}>
                  <defs><clipPath id="wallClip"><rect x={pad} y={pad} width={W * scale} height={H * scale} /></clipPath></defs>
                  <rect data-wall="1" x={pad} y={pad} width={W * scale} height={H * scale} fill={wallColor} stroke="#cfc5b6" strokeWidth="1" />
                  {photo && <image href={photo} x={pad} y={pad} width={W * scale} height={H * scale} preserveAspectRatio="xMidYMid slice" opacity={photoOpacity} clipPath="url(#wallClip)" />}
                  {showArch && !photo && (
                    <g>
                      {crownPx > 0 && <rect data-wall="1" x={pad} y={pad} width={W * scale} height={crownPx} fill="#fbfaf7" stroke="#e2dacd" strokeWidth="0.5" />}
                      {baseboardPx > 0 && <rect data-wall="1" x={pad} y={pad + H * scale - baseboardPx} width={W * scale} height={baseboardPx} fill="#fbfaf7" stroke="#e2dacd" strokeWidth="0.5" />}
                      <line x1={pad} y1={pad + 1} x2={pad + W * scale} y2={pad + 1} stroke="#000" strokeOpacity="0.05" strokeWidth="2" />
                    </g>
                  )}
                  {freeMode && num(snap) > 0 && Array.from({ length: Math.floor(W / num(snap)) }, (_, i) => (
                    <line key={`gx${i}`} x1={pad + (i + 1) * num(snap) * scale} y1={pad} x2={pad + (i + 1) * num(snap) * scale} y2={pad + H * scale} stroke="#000" strokeOpacity="0.04" strokeWidth="1" />
                  ))}
                  {!freeMode && layout === "wainscot" && autoCalc.chairRailY != null && (
                    <rect x={pad} y={pad + autoCalc.chairRailY * scale - Math.max(2, mw * scale) / 2} width={W * scale} height={Math.max(2, mw * scale)} fill={trimColor} />
                  )}
                  {guides.map((g, i) => g.x != null
                    ? <line key={i} x1={pad + g.x * scale} y1={pad} x2={pad + g.x * scale} y2={pad + H * scale} stroke="#c9783a" strokeWidth="1" strokeDasharray="4 4" />
                    : <line key={i} x1={pad} y1={pad + g.y * scale} x2={pad + W * scale} y2={pad + g.y * scale} stroke="#c9783a" strokeWidth="1" strokeDasharray="4 4" />)}
                  {activePanels.map((p) => <Panel key={p.id} p={p} isSel={freeMode && selected === p.id} />)}
                  <line x1={pad} y1={svgH - 16} x2={pad + W * scale} y2={svgH - 16} stroke="#a89e92" strokeWidth="1" />
                  <text x={pad + (W * scale) / 2} y={svgH - 20} textAnchor="middle" fontSize="16" fill="#6b6259">{fmt(W)}</text>
                  <line x1={20} y1={pad} x2={20} y2={pad + H * scale} stroke="#a89e92" strokeWidth="1" />
                  <text x={16} y={pad + (H * scale) / 2} textAnchor="middle" fontSize="16" fill="#6b6259" transform={`rotate(-90 16 ${pad + (H * scale) / 2})`}>{fmt(H)}</text>
                </svg>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#b04a3a", fontSize: 14 }}>{autoCalc.err || "Panels don't fit."}</div>
              )}
            </div>
            <div className="card" style={{ background: "#fff", borderRadius: 14, padding: 18, marginTop: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Cut list &amp; materials</h3>
                <span className="no-print" style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => window.print()} style={{ ...btnSm, padding: "6px 14px" }}>Print / PDF</button>
                  <button onClick={exportCutList} style={{ ...btnSm, padding: "6px 14px" }}>Export .txt</button>
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", fontSize: 14, marginBottom: 14 }}>
                <Row k="Total panels" v={`${activePanels.length}`} />
                <Row k="Moulding profile" v={fmt(mw)} />
                <Row k="Total moulding length" v={`${fmt(totalMoulding)} (${toBig(totalMoulding)} ${bigUnit})`} />
                <Row k="Wall area" v={`${(W * H / (unit === "cm" ? 10000 : 144)).toFixed(2)} ${unit === "cm" ? "m²" : "ft²"}`} />
                <Row k="Lengths to buy" v={`${buy.sticks} × ${fmt(num(stockLen))} (${Math.round(buy.waste * 100)}% waste)`} />
                {num(pricePerLen) > 0 && <Row k="Estimated cost" v={buy.cost.toFixed(2)} />}
              </div>
              <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, background: "#f7f3ec", borderRadius: 10, padding: 12 }}>
                <Field label="Stock length per piece" value={stockLen} set={setStockLen} />
                <Field label="Price per length" value={pricePerLen} set={setPricePerLen} suffix="" />
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "6px 16px", color: "#8a8076", fontWeight: 600, paddingBottom: 6, borderBottom: "1px solid #eee6db", fontSize: 13 }}>
                  <span>#</span><span>Width</span><span>Height</span>
                </div>
                {activePanels.map((p, i) => (
                  <div key={p.id} onClick={() => freeMode && setSelected(p.id)} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "6px 16px", padding: "6px 0", borderBottom: "1px solid #f0ebe1", fontSize: 13.5, cursor: freeMode ? "pointer" : "default", background: selected === p.id ? "#fff5e9" : "transparent" }}>
                    <span>{i + 1}</span><span>{fmt(p.w)}</span><span>{fmt(p.h)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="no-print" style={{ background: "#fff", borderRadius: 14, padding: 18, marginTop: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Saved designs</h3>
                <button onClick={saveLayout} style={{ ...btnSm, padding: "6px 14px", background: "#c9a98a", color: "#fff", border: "none" }}>Save current</button>
              </div>
              {loadingSaved ? <p style={{ color: "#a89e92", fontSize: 13 }}>Loading…</p> : saved.length === 0 ? (
                <p style={{ color: "#a89e92", fontSize: 13, margin: 0 }}>No saved designs yet. Save a few to compare them.</p>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {saved.map((s) => (
                    <div key={s.id} style={{ border: "1px solid #eee6db", borderRadius: 10, padding: 10, width: 130 }}>
                      <MiniPreview state={s.state} />
                      <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#a89e92" }}>{s.state.layout}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <button onClick={() => applySnapshot(s.state)} style={{ ...btnSm, flex: 1, padding: "4px 0", fontSize: 11.5 }}>Load</button>
                        <button onClick={() => deleteSaved(s.id)} style={{ ...btnSm, padding: "4px 8px", fontSize: 11.5 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnSm = { padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd5cc", cursor: "pointer", background: "#fff", fontSize: 12.5, fontWeight: 500, color: "#6b6259" };
const swatchPicker = { width: 30, height: 30, borderRadius: 8, cursor: "pointer", border: "1px dashed #b3a896", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" };
const hiddenColor = { opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" };

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0ebe1", paddingBottom: 6 }}>
      <span style={{ color: "#8a8076" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}

function MiniPreview({ state }) {
  const W = num(state.wallW), H = num(state.wallH);
  const vw = 110, vh = W > 0 ? (H / W) * vw : 70, sc = W > 0 ? vw / W : 1;
  let panels = state.panels;
  if (!state.freeMode || !panels || !panels.length) {
    const symL = state.symLock !== false;
    panels = layoutPanels({
      W, H, layout: state.layout, count: state.count, gap: state.gap,
      marginTop: state.marginTop, marginBottom: state.marginBottom,
      marginLeft: state.marginSide, marginRight: symL ? state.marginSide : (state.marginRight ?? state.marginSide),
      lowerH: state.lowerH, rowGap: state.rowGap, rows: state.rows, chairRail: state.chairRail,
    }).panels;
  }
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}>
      <rect x={0} y={0} width={vw} height={vh} fill={state.wallColor} />
      {panels.map((p, i) => <rect key={i} x={p.x * sc} y={p.y * sc} width={p.w * sc} height={p.h * sc} fill="none" stroke={state.trimColor || "#fff"} strokeWidth="1.5" />)}
    </svg>
  );
}

createRoot(document.getElementById("root")).render(<WallPanelingPlanner />);
