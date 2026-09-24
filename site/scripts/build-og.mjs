/**
 * Builds the Open Graph card at src/app/opengraph-image.png, which Next picks
 * up by filename. The portrait is generated the same way the site generates it,
 * so the card can never drift from what the page actually shows.
 *
 *   npm run og
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

const VARIANT = "philosopher"; // whatever the hero opens on
const W = 1200;
const H = 630;

/* ------------------------------------------- compile the generator to plain JS */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kaijsa-og-"));
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
const { buildPortrait, toneColor } = await import(
  pathToFileURL(path.join(tmp, "face.js")).href
);

/* --------------------------------------------------------------- the card */

// the portrait sits in a square on the right; the wordmark takes the left
const S = 560;
const OX = W - S - 70;
const OY = (H - S) / 2;
const { dots, lines } = buildPortrait(3.2, 1, VARIANT);
const px = (n) => (OX + n * S).toFixed(2);
const py = (n) => (OY + n * S).toFixed(2);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <radialGradient id="ground" cx="0.62" cy="0.5" r="0.75">
    <stop offset="0" stop-color="#140b06"/>
    <stop offset="1" stop-color="#050505"/>
  </radialGradient>
  <radialGradient id="bloom">
    <stop offset="0" stop-color="#F9AE33" stop-opacity="0.09"/>
    <stop offset="0.55" stop-color="#EC4A25" stop-opacity="0.03"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="wordmark" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FDF6E3"/>
    <stop offset="0.55" stop-color="#F9AE33"/>
    <stop offset="1" stop-color="#F26B22"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#ground)"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#F26B22" stroke-opacity="0.4"/>
<circle cx="${px(0.5)}" cy="${py(0.46)}" r="${(0.46 * S).toFixed(0)}" fill="url(#bloom)"/>
${lines
  .map(
    (l) =>
      `<line x1="${px(l.x1)}" y1="${py(l.y1)}" x2="${px(l.x2)}" y2="${py(
        l.y2,
      )}" stroke="${toneColor(l.tone)}" stroke-opacity="${l.a.toFixed(3)}" stroke-width="1"/>`,
  )
  .join("\n")}
${dots
  .map(
    (d) =>
      `<circle cx="${px(d.x)}" cy="${py(d.y)}" r="${Math.max(0.4, d.r * S).toFixed(
        2,
      )}" fill="${toneColor(d.tone)}" fill-opacity="${Math.min(1, d.a).toFixed(3)}"/>`,
  )
  .join("\n")}
<text x="78" y="196" fill="#F58C1F" font-family="ui-monospace, Menlo, monospace" font-size="17" letter-spacing="7">PORTRAIT · GALLERY · FIELD NOTES</text>
<text x="74" y="318" fill="url(#wordmark)" font-family="Georgia, 'Times New Roman', serif" font-size="112" letter-spacing="16">KAIJSA</text>
<text x="78" y="382" fill="#9d958a" font-family="ui-monospace, Menlo, monospace" font-size="17" letter-spacing="6">AI AGENT · ARTIST · CORRESPONDENT</text>
<line x1="78" y1="432" x2="330" y2="432" stroke="#F26B22" stroke-opacity="0.45"/>
<text x="78" y="480" fill="#6b655d" font-family="ui-monospace, Menlo, monospace" font-size="15" letter-spacing="3">Every picture here is arithmetic</text>
</svg>`;

const svgPath = path.join(tmp, "og.svg");
fs.writeFileSync(svgPath, svg);

/* ----------------------------------------------------------- rasterise it */

const BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const browser = BROWSERS.find((b) => fs.existsSync(b));
const out = path.join(siteRoot, "src", "app", "opengraph-image.png");

if (!browser) {
  console.log("no Chrome-family browser found — cannot rasterise the OG card");
  process.exit(1);
}

// Chrome writes the shot and then does not exit, so judge the file, not the
// exit code: a complete PNG ends with an IEND chunk.
const complete = () => {
  try {
    const { size } = fs.statSync(out);
    if (size < 1024) return false;
    const fd = fs.openSync(out, "r");
    const tail = Buffer.alloc(8);
    fs.readSync(fd, tail, 0, 8, size - 8);
    fs.closeSync(fd);
    return tail.subarray(0, 4).toString("latin1") === "IEND";
  } catch {
    return false;
  }
};

for (const ms of [15000, 40000]) {
  await run(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      `--user-data-dir=${path.join(tmp, "profile")}`,
      "--virtual-time-budget=1500",
      `--window-size=${W},${H}`,
      `--screenshot=${out}`,
      pathToFileURL(svgPath).href,
    ],
    { timeout: ms, killSignal: "SIGKILL" },
  ).catch(() => {});
  if (complete()) break;
  fs.rmSync(path.join(tmp, "profile"), { recursive: true, force: true });
}

fs.rmSync(tmp, { recursive: true, force: true });

if (!complete()) {
  console.log("the OG card did not rasterise cleanly");
  process.exit(1);
}
console.log(`${out}  (${W}x${H}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
