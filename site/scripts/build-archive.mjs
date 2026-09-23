/**
 * Builds the portrait archive: one self-contained HTML file, plus an SVG still
 * per variant. The page carries the generator itself, so the portraits are
 * live in it — the same code the site runs, inlined, with no network calls and
 * no other files to keep track of.
 *
 *   npm run archive
 */
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const outDir = path.resolve(siteRoot, "..", "archive");
const stillsDir = path.join(outDir, "stills");

/* ------------------------------------------- compile the generator to plain JS */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kaijsa-archive-"));
execFileSync(
  process.execPath,
  [
    path.join(siteRoot, "node_modules", "typescript", "bin", "tsc"),
    path.join(siteRoot, "src", "lib", "face.ts"),
    "--outDir",
    tmp,
    "--target",
    "es2020",
    "--module",
    "esnext",
    "--moduleResolution",
    "bundler",
  ],
  { stdio: "inherit" },
);

const faceJsPath = path.join(tmp, "face.js");
const faceModule = fs.readFileSync(faceJsPath, "utf8");
const { buildPortrait, toneColor, VARIANTS } = await import(
  pathToFileURL(faceJsPath).href
);

/** Every variant is shown in both treatments, paired for comparison. */
const STYLES = [
  { id: "classic", label: "original", note: "cream disc iris · three-arc mouth" },
  { id: "open", label: "current", note: "open ring iris · seam mouth" },
];
const CARDS = VARIANTS.flatMap((v) => STYLES.map((st) => ({ v, st })));

// spelled from VARIANTS, so the copy cannot drift when a variant is added or cut
const NUMBER_WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const VARIANT_COUNT = NUMBER_WORDS[VARIANTS.length] ?? String(VARIANTS.length);

/* ----------------------------------------------------------------- SVG stills */

const S = 1000;
const FRAME = 0.052;
const STILL_TIME = 3.2; // eyes open, breath near neutral

fs.mkdirSync(stillsDir, { recursive: true });

// Sweep out stills for variants that no longer exist. Renaming a variant used
// to leave its old files behind, and an orphaned still is worse than no still:
// it looks current.
{
  const keep = new Set(
    CARDS.flatMap(({ v, st }) => [
      `kaijsa-${v.id}-${st.id}.svg`,
      `kaijsa-${v.id}-${st.id}.png`,
    ]),
  );
  for (const f of fs.readdirSync(stillsDir)) {
    if (!keep.has(f)) {
      fs.rmSync(path.join(stillsDir, f));
      console.log(`removed stale still: ${f}`);
    }
  }
}

for (const { v, st } of CARDS) {
  const { dots, lines } = buildPortrait(STILL_TIME, 1, v.id, st.id);
  const p = (n) => (n * S).toFixed(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<defs><radialGradient id="bloom">
<stop offset="0" stop-color="#F9AE33" stop-opacity="0.07"/>
<stop offset="0.55" stop-color="#EC4A25" stop-opacity="0.025"/>
<stop offset="1" stop-color="#000000" stop-opacity="0"/>
</radialGradient></defs>
<rect width="${S}" height="${S}" fill="#050505"/>
<rect x="${p(FRAME)}" y="${p(FRAME)}" width="${p(1 - FRAME * 2)}" height="${p(
    1 - FRAME * 2,
  )}" fill="none" stroke="#F26B22" stroke-opacity="0.55" stroke-width="1.4"/>
<circle cx="${p(0.5)}" cy="${p(0.46)}" r="${p(0.4)}" fill="url(#bloom)"/>
${lines
  .map(
    (l) =>
      `<line x1="${p(l.x1)}" y1="${p(l.y1)}" x2="${p(l.x2)}" y2="${p(
        l.y2,
      )}" stroke="${toneColor(l.tone)}" stroke-opacity="${l.a.toFixed(
        3,
      )}" stroke-width="1.1"/>`,
  )
  .join("\n")}
${dots
  .map(
    (d) =>
      `<circle cx="${p(d.x)}" cy="${p(d.y)}" r="${Math.max(
        0.5,
        d.r * S,
      ).toFixed(2)}" fill="${toneColor(d.tone)}" fill-opacity="${Math.min(
        1,
        d.a,
      ).toFixed(3)}"/>`,
  )
  .join("\n")}
</svg>`;
  fs.writeFileSync(path.join(stillsDir, `kaijsa-${v.id}-${st.id}.svg`), svg);
  console.log(
    `${v.id.padEnd(9)} ${st.label.padEnd(9)} ${dots.length} discs, ${lines.length} hairlines`,
  );
}

/* ------------------------------------------------------------------ the page */

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kaijsa — Portrait Archive</title>
<meta name="theme-color" content="#050505">
<meta name="description" content="Generative portraits of the agent Kaijsa, drawn entirely from filled discs and hairlines.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#050505; --cream:#fdf6e3; --ember:#f9ae33; --flame:#f58c1f; --orange:#f26b22;
  --text:#ece4d6; --dim:#9d958a; --faint:#6b655d;
  --rule:rgba(242,107,34,.22); --rule-soft:rgba(236,228,214,.1);
  --display:"Cormorant Garamond",Georgia,serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
  color-scheme:dark;
}
*,*::before,*::after{box-sizing:border-box}
body{
  margin:0;background:var(--ink);color:var(--text);
  font-family:var(--mono);font-weight:300;line-height:1.7;
  -webkit-font-smoothing:antialiased;
}
body::before{
  content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background:
    radial-gradient(60rem 42rem at 50% 4%,rgba(249,174,51,.06),transparent 62%),
    radial-gradient(48rem 40rem at 88% 92%,rgba(236,74,37,.04),transparent 60%),
    var(--ink);
}
.frame{position:fixed;inset:clamp(8px,1.1vw,16px);border:1px solid var(--rule);pointer-events:none;z-index:60}
.frame i{position:absolute;width:7px;height:7px;border:1px solid var(--orange);background:var(--ink)}
.frame i:nth-child(1){top:-4px;left:-4px} .frame i:nth-child(2){top:-4px;right:-4px}
.frame i:nth-child(3){bottom:-4px;left:-4px} .frame i:nth-child(4){bottom:-4px;right:-4px}
.shell{width:min(100% - clamp(2.5rem,8vw,7rem),1180px);margin-inline:auto}
header.top{padding:clamp(4.5rem,11vh,8rem) 0 clamp(2rem,5vh,3.5rem)}
.eyebrow{
  font-size:.66rem;letter-spacing:.34em;text-transform:uppercase;color:var(--flame);
  margin:0 0 1.2rem;display:flex;align-items:center;gap:.85rem;
}
.eyebrow::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--rule),transparent)}
h1{
  font-family:var(--display);font-weight:400;margin:0;
  font-size:clamp(2.8rem,10vw,5.6rem);line-height:.95;letter-spacing:.16em;text-indent:.16em;
  background:linear-gradient(180deg,var(--cream),var(--ember) 55%,var(--orange));
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.lede{
  font-family:var(--display);font-size:clamp(1.2rem,2.3vw,1.6rem);line-height:1.5;
  color:var(--text);max-width:58ch;margin:2rem 0 0;
}
.bar{
  display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;
  margin-top:2.4rem;padding-top:1.6rem;border-top:1px solid var(--rule-soft);
  font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:var(--faint);
}
.bar button{
  background:none;border:0;font:inherit;letter-spacing:inherit;text-transform:inherit;
  color:var(--faint);cursor:pointer;padding:.35rem .2rem;transition:color .22s;
}
.bar button:hover{color:var(--dim)}
.bar button.on{color:var(--ember)}
.grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  gap:clamp(1rem,2vw,1.6rem) clamp(1rem,2vw,1.6rem);
  padding:clamp(2rem,5vh,3.5rem) 0 clamp(4rem,9vh,7rem);
}
@media (max-width:720px){.grid{grid-template-columns:minmax(0,1fr)}}
.card.is-original{background:linear-gradient(160deg,rgba(236,228,214,.035),transparent 55%)}
.tag{
  font-family:var(--mono);font-size:.55rem;letter-spacing:.22em;text-transform:uppercase;
  color:var(--faint);border:1px solid var(--rule-soft);padding:.18rem .45rem;
  vertical-align:middle;margin-left:.6rem;
}
.card.is-original .tag{color:var(--dim)}
.card{border:1px solid var(--rule-soft);background:linear-gradient(160deg,rgba(249,174,51,.03),transparent 55%);transition:border-color .3s}
.card:hover{border-color:var(--rule)}
.stage{position:relative;aspect-ratio:1;width:100%;border-bottom:1px solid var(--rule-soft)}
.stage canvas,.stage pre{position:absolute;inset:0;width:100%;height:100%;transition:opacity .45s}
.stage pre{
  margin:0;font-family:var(--mono);line-height:1.05;letter-spacing:0;text-align:left;
  overflow:hidden;display:flex;align-items:center;justify-content:center;user-select:none;
}
.stage pre code{display:block;white-space:pre;font:inherit}
.meta{padding:1.15rem 1.3rem 1.3rem}
.meta h2{
  font-family:var(--display);font-weight:400;margin:0;
  font-size:1.9rem;letter-spacing:.06em;color:var(--cream);
}
.meta .sub{font-size:.6rem;letter-spacing:.24em;text-transform:uppercase;color:var(--flame);margin:.35rem 0 0}
.meta p{margin:0;font-size:.82rem;line-height:1.85;color:var(--dim)}
.save{
  display:inline-block;margin-top:1.05rem;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--faint);border:1px solid var(--rule-soft);padding:.45rem .8rem;cursor:pointer;
  background:none;font-family:inherit;transition:color .22s,border-color .22s;
}
.save:hover{color:var(--ember);border-color:var(--rule)}
footer{
  border-top:1px solid var(--rule-soft);padding:2.4rem 0 3.4rem;
  font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);
  display:flex;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;align-items:center;
}
.swatches{display:flex;gap:6px}
.swatches span{width:13px;height:13px;border-radius:50%}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

<div class="shell">
  <header class="top">
    <p class="eyebrow">Portrait archive</p>
    <h1>KAIJSA</h1>
    <p class="lede">
      Every mark here is one of two things: a filled disc, or a hairline between two
      discs. That is the whole vocabulary. These are not images — the page carries the
      generator, so each portrait is being drawn as you watch it, breathing and
      blinking on its own clock.
    </p>
    <p class="lede" style="margin-top:1.4rem;font-size:1.05rem;color:var(--dim)">
      Each of the ${VARIANT_COUNT} is shown twice: the <em>original</em> treatment,
      with a cream disc for the iris and a full three-arc mouth, beside the
      <em>current</em> one, where the iris is an open ring with the pupil left as bare
      ground and the mouth is carried by its seam.
    </p>
    <div class="bar">
      <span>Render</span>
      <button data-mode="dots" class="on">discs</button>
      <span aria-hidden="true">·</span>
      <button data-mode="ascii">ascii</button>
    </div>
  </header>

  <main class="grid" id="grid"></main>

  <footer>
    <span>Kaijsa · every picture here is arithmetic</span>
    <span class="swatches" aria-label="palette"></span>
  </footer>
</div>

<script type="module">
/* ---------------------------------------------------- the generator, inlined */
${faceModule}

/* ------------------------------------------------------------------ renderer */
const RAMP = ".:-=+*#%@";
const ASCII_LINE_HEIGHT = 1.05;
const ASCII_FLOOR = 0.32;
const FRAME_MIN = 0.052, FRAME_MAX = 0.948;

function paintCanvas(ctx, p, w, h, time) {
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w, h), ox = (w - s) / 2, oy = (h - s) / 2;
  const X = (x) => ox + x * s, Y = (y) => oy + y * s;

  ctx.strokeStyle = "rgba(242,107,34,.55)";
  ctx.lineWidth = Math.max(1, s * 0.0014);
  const fo = s * FRAME_MIN;
  ctx.strokeRect(ox + fo, oy + fo, s - fo * 2, s - fo * 2);

  for (const l of p.lines) {
    ctx.strokeStyle = toneColor(l.tone);
    ctx.globalAlpha = l.a;
    ctx.lineWidth = Math.max(0.6, s * 0.0011);
    ctx.beginPath(); ctx.moveTo(X(l.x1), Y(l.y1)); ctx.lineTo(X(l.x2), Y(l.y2)); ctx.stroke();
  }

  const glow = ctx.createRadialGradient(X(0.5), Y(0.46), 0, X(0.5), Y(0.46), s * 0.4);
  const pulse = 0.05 + 0.02 * Math.sin(time * 0.6);
  glow.addColorStop(0, \`rgba(249,174,51,\${pulse})\`);
  glow.addColorStop(0.55, \`rgba(236,74,37,\${pulse * 0.35})\`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 1; ctx.fillStyle = glow; ctx.fillRect(ox, oy, s, s);

  for (const d of p.dots) {
    ctx.globalAlpha = d.a;
    ctx.fillStyle = toneColor(d.tone);
    ctx.beginPath(); ctx.arc(X(d.x), Y(d.y), Math.max(0.5, d.r * s), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const esc = (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);

/* Plain ASCII only: box-drawing glyphs fall back to another font with a
   different advance width, which shears the whole grid. */
function renderAscii(p, cols, rows, cellRatio) {
  const grid = new Array(cols * rows).fill(null);
  const spanW = rows / cellRatio;
  const ox = (cols - spanW) / 2;
  const CXg = (x) => ox + x * spanW, CYg = (y) => y * rows;

  const put = (cx, cy, cell) => {
    const ix = Math.round(cx), iy = Math.round(cy);
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) return;
    const i = iy * cols + ix, prev = grid[i];
    if (!prev || RAMP.indexOf(cell.ch) >= RAMP.indexOf(prev.ch)) grid[i] = cell;
  };

  for (const l of p.lines) {
    if (l.a < 0.3) continue;
    const x1 = CXg(l.x1), y1 = CYg(l.y1), dx = CXg(l.x2) - x1, dy = CYg(l.y2) - y1;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    const ch = Math.abs(dy) < 0.4 ? "-" : Math.abs(dx) < 0.4 ? "|" : dx * dy > 0 ? "\\\\" : "/";
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      put(x1 + dx * t, y1 + dy * t, { ch, tone: l.tone, a: Math.max(ASCII_FLOOR, l.a) });
    }
  }

  for (const d of p.dots) {
    const cx = CXg(d.x), cy = CYg(d.y), rx = d.r * spanW, ry = d.r * rows;
    const a = Math.max(ASCII_FLOOR, d.a);
    if (rx < 0.5) { put(cx, cy, { ch: RAMP[Math.floor(Math.min(0.999, rx / 0.5) * 5)], tone: d.tone, a }); continue; }
    for (let iy = Math.floor(cy - ry); iy <= Math.ceil(cy + ry); iy++) {
      for (let ix = Math.floor(cx - rx); ix <= Math.ceil(cx + rx); ix++) {
        const nx = (ix - cx) / rx, ny = (iy - cy) / ry;
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist > 1) continue;
        put(ix, iy, { ch: RAMP[Math.floor(Math.min(0.999, (1 - dist) * 0.55 + 0.45) * RAMP.length)], tone: d.tone, a });
      }
    }
  }

  const fx0 = Math.round(CXg(FRAME_MIN)), fx1 = Math.round(CXg(FRAME_MAX));
  const fy0 = Math.round(CYg(FRAME_MIN)), fy1 = Math.round(CYg(FRAME_MAX));
  const frame = (ix, iy, ch) => {
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) return;
    const i = iy * cols + ix;
    if (!grid[i]) grid[i] = { ch, tone: 0.55, a: 0.55 };
  };
  for (let ix = fx0; ix <= fx1; ix++) { frame(ix, fy0, "-"); frame(ix, fy1, "-"); }
  for (let iy = fy0; iy <= fy1; iy++) { frame(fx0, iy, "|"); frame(fx1, iy, "|"); }
  for (const [fx, fy] of [[fx0, fy0], [fx1, fy0], [fx0, fy1], [fx1, fy1]]) frame(fx, fy, "+");

  let out = "<code>";
  for (let iy = 0; iy < rows; iy++) {
    let run = "", key = "", color = "";
    for (let ix = 0; ix < cols; ix++) {
      const cell = grid[iy * cols + ix];
      const c = cell ? toneColor(cell.tone) : "";
      const alpha = cell ? Math.round(Math.min(1, cell.a) * 10) / 10 : 0;
      const k = cell ? c + "|" + alpha : "";
      if (k !== key) {
        if (run) out += key ? '<span style="color:' + color + ';opacity:' + key.split("|")[1] + '">' + run + "</span>" : run;
        run = ""; key = k; color = c;
      }
      run += cell ? esc(cell.ch) : " ";
    }
    if (run) out += key ? '<span style="color:' + color + ';opacity:' + key.split("|")[1] + '">' + run + "</span>" : run;
    out += "\\n";
  }
  return out + "</code>";
}

function measureCellRatio(el, fontSize) {
  const probe = document.createElement("span");
  probe.textContent = "0".repeat(100);
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0";
  probe.style.font = fontSize + "px " + getComputedStyle(el).fontFamily;
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return w / (fontSize * ASCII_LINE_HEIGHT);
}

/* ---------------------------------------------------------------- the cards */
const grid = document.getElementById("grid");
let mode = "dots";
const STYLES = ${JSON.stringify(STYLES)};
const PAIRS = VARIANTS.flatMap((v) => STYLES.map((st) => ({ v, st })));

const cards = PAIRS.map(({ v, st }, idx) => {
  const el = document.createElement("article");
  el.className = "card" + (st.id === "classic" ? " is-original" : "");
  el.innerHTML =
    '<div class="stage"><canvas></canvas><pre style="opacity:0"></pre></div>' +
    '<div class="meta"><h2>' + v.label +
    ' <span class="tag">' + st.label + "</span></h2>" +
    '<p class="sub">' + v.blurb + " &middot; " + st.note + "</p>" +
    '<button class="save">save png</button></div>';
  grid.appendChild(el);

  const canvas = el.querySelector("canvas");
  const pre = el.querySelector("pre");
  el.querySelector(".save").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "kaijsa-" + v.id + "-" + st.id + ".png";
    a.click();
  });
  // each portrait keeps its own clock, so they do not blink in unison
  return { v, st, canvas, pre, stage: el.querySelector(".stage"), offset: idx * 1.1, lastAscii: 0, lastFont: 0, cellRatio: 0.6 / ASCII_LINE_HEIGHT };
});

document.querySelectorAll(".bar button").forEach((b) => {
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    document.querySelectorAll(".bar button").forEach((o) => o.classList.toggle("on", o === b));
    for (const c of cards) {
      c.canvas.style.opacity = mode === "dots" ? 1 : 0;
      c.pre.style.opacity = mode === "ascii" ? 1 : 0;
    }
  });
});

const palette = document.querySelector(".swatches");
for (const c of PALETTE) {
  const sp = document.createElement("span");
  sp.style.background = c;
  palette.appendChild(sp);
}

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const start = performance.now();

function tick(now) {
  for (const c of cards) {
    const time = reduced ? 3.2 : (now - start) / 1000 + c.offset;
    const w = c.stage.clientWidth, h = c.stage.clientHeight;
    if (!w || !h) continue;

    if (mode === "dots") {
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (c.canvas.width !== Math.round(w * dpr) || c.canvas.height !== Math.round(h * dpr)) {
        c.canvas.width = Math.round(w * dpr);
        c.canvas.height = Math.round(h * dpr);
        c.canvas.style.width = w + "px";
        c.canvas.style.height = h + "px";
      }
      const ctx = c.canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintCanvas(ctx, buildPortrait(time, 1, c.v.id, c.st.id), w, h, time);
    } else if (now - c.lastAscii > 80) {
      c.lastAscii = now;
      const rows = h < 400 ? 40 : 48;
      const fontSize = h / (rows * ASCII_LINE_HEIGHT);
      if (fontSize !== c.lastFont) {
        c.lastFont = fontSize;
        c.pre.style.fontSize = fontSize + "px";
        c.cellRatio = measureCellRatio(c.pre, fontSize);
      }
      const cols = Math.floor(w / (fontSize * ASCII_LINE_HEIGHT * c.cellRatio));
      c.pre.innerHTML = renderAscii(buildPortrait(time, 0.68, c.v.id, c.st.id), cols, rows, c.cellRatio);
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
</script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
const pagePath = path.join(outDir, "kaijsa-portraits.html");
fs.writeFileSync(pagePath, page);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(
  `\n${pagePath}  (${(Buffer.byteLength(page) / 1024).toFixed(0)} KB, self-contained)`,
);
console.log(`${stillsDir}  (${CARDS.length} SVG stills)`);

/* ------------------------------------------------ raster stills, if we can */

// Vector is the real output; the PNGs are for anywhere that will not take an
// SVG. Rasterising needs a browser, so it is best-effort — the SVGs are
// already written either way.
const BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const browser = BROWSERS.find((b) => fs.existsSync(b));

if (!browser) {
  console.log("\nno Chrome-family browser found — skipping the PNG stills");
} else {
  const shots = fs.mkdtempSync(path.join(os.tmpdir(), "kaijsa-shots-"));
  const jobs = CARDS.map(({ v, st }) => ({
    svg: path.join(stillsDir, `kaijsa-${v.id}-${st.id}.svg`),
    png: path.join(stillsDir, `kaijsa-${v.id}-${st.id}.png`),
  }));

  // Chrome writes the screenshot and then does not exit, so the exit code says
  // nothing. Judge the file instead: a complete PNG ends with an IEND chunk.
  const complete = (file) => {
    try {
      const { size } = fs.statSync(file);
      if (size < 1024) return false;
      const fd = fs.openSync(file, "r");
      const tail = Buffer.alloc(8);
      fs.readSync(fd, tail, 0, 8, size - 8);
      fs.closeSync(fd);
      return tail.subarray(0, 4).toString("latin1") === "IEND";
    } catch {
      return false;
    }
  };

  let next = 0;
  let failed = 0;
  // A fresh profile per JOB, not per worker: reusing one across sequential
  // launches leaves a lock behind and the next launch hangs on it forever.
  const shoot = (i, job, ms) =>
    run(
      browser,
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        `--user-data-dir=${path.join(shots, `j${i}`)}`,
        "--virtual-time-budget=1500",
        "--force-device-scale-factor=2",
        "--window-size=1000,1000",
        `--screenshot=${job.png}`,
        pathToFileURL(job.svg).href,
      ],
      { timeout: ms, killSignal: "SIGKILL" },
    ).catch(() => {});

  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      await shoot(i, job, 15000);
      // one retry with more room, in case it was killed mid-write
      if (!complete(job.png)) await shoot(i + jobs.length, job, 40000);
      if (!complete(job.png)) failed++;
    }
  };
  await Promise.all([0, 1, 2, 3].map(worker));
  fs.rmSync(shots, { recursive: true, force: true });

  const written = jobs.filter((j) => complete(j.png));
  const bytes = written.reduce((n, j) => n + fs.statSync(j.png).size, 0);
  console.log(
    `${stillsDir}  (${written.length} PNG stills, 2000x2000, ${(bytes / 1048576).toFixed(1)} MB)` +
      (failed ? `  — ${failed} failed` : ""),
  );
}
