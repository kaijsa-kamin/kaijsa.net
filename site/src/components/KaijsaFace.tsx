"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  buildPortrait,
  toneColor,
  VARIANTS,
  type Portrait,
  type Variant,
} from "@/lib/face";

type Mode = "dots" | "ascii";

const RAMP = ".:-=+*#%@";
const ASCII_ROWS = 52;
const ASCII_ROWS_SMALL = 40;
const ASCII_LINE_HEIGHT = 1.05;
/** the character grid throws away a lot of light; give it back */
const ASCII_FLOOR = 0.32;
/** how many portrait names may share one line */
const PER_ROW = 5;

/** Offered under the portrait. Variants left out here are still built by
 *  buildPortrait and still appear in the archive — they are just not on the
 *  page. */
const HIDDEN: Variant[] = ["oracle"];
const CHOICES = VARIANTS.filter((v) => !HIDDEN.includes(v.id));

/**
 * Character cells are not square and their aspect depends on the font that
 * actually loaded, so measure it rather than assume it.
 */
function measureCellRatio(el: HTMLElement, fontSize: number): number {
  const probe = document.createElement("span");
  probe.textContent = "0".repeat(100);
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0";
  probe.style.font = `${fontSize}px ${getComputedStyle(el).fontFamily}`;
  document.body.appendChild(probe);
  const cellW = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return cellW / (fontSize * ASCII_LINE_HEIGHT);
}
const FRAME_MIN = 0.052;
const FRAME_MAX = 0.948;

/* ------------------------------------------------------------------ canvas */

function paintCanvas(
  ctx: CanvasRenderingContext2D,
  p: Portrait,
  w: number,
  h: number,
  time: number,
) {
  ctx.clearRect(0, 0, w, h);

  const s = Math.min(w, h);
  const ox = (w - s) / 2;
  const oy = (h - s) / 2;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;

  // hairline frame — the signature of the series
  ctx.save();
  ctx.strokeStyle = "rgba(242, 107, 34, 0.55)";
  ctx.lineWidth = Math.max(1, s * 0.0014);
  const fo = s * FRAME_MIN;
  ctx.strokeRect(ox + fo, oy + fo, s - fo * 2, s - fo * 2);
  ctx.restore();

  for (const l of p.lines) {
    ctx.strokeStyle = toneColor(l.tone);
    ctx.globalAlpha = l.a;
    ctx.lineWidth = Math.max(0.6, s * 0.0011);
    ctx.beginPath();
    ctx.moveTo(X(l.x1), Y(l.y1));
    ctx.lineTo(X(l.x2), Y(l.y2));
    ctx.stroke();
  }

  // soft bloom behind the face
  const glow = ctx.createRadialGradient(
    X(0.5),
    Y(0.46),
    0,
    X(0.5),
    Y(0.46),
    s * 0.4,
  );
  const pulse = 0.05 + 0.02 * Math.sin(time * 0.6);
  glow.addColorStop(0, `rgba(249, 174, 51, ${pulse})`);
  glow.addColorStop(0.55, `rgba(236, 74, 37, ${pulse * 0.35})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.fillRect(ox, oy, s, s);

  for (const d of p.dots) {
    ctx.globalAlpha = d.a;
    ctx.fillStyle = toneColor(d.tone);
    ctx.beginPath();
    ctx.arc(X(d.x), Y(d.y), Math.max(0.5, d.r * s), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------- ascii */

type Cell = { ch: string; tone: number; a: number };

function esc(ch: string) {
  return ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch;
}

function renderAscii(
  p: Portrait,
  cols: number,
  rows: number,
  cellRatio: number,
): string {
  const grid: (Cell | null)[] = new Array(cols * rows).fill(null);

  // the face occupies a square; in character cells that square is
  // `rows` tall and `rows / CELL_RATIO` wide.
  const spanW = rows / cellRatio;
  const ox = (cols - spanW) / 2;

  const CX_ = (x: number) => ox + x * spanW;
  const CY_ = (y: number) => y * rows;

  const put = (cx: number, cy: number, cell: Cell) => {
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) return;
    const i = iy * cols + ix;
    const prev = grid[i];
    if (!prev || RAMP.indexOf(cell.ch) >= RAMP.indexOf(prev.ch)) grid[i] = cell;
  };

  for (const l of p.lines) {
    if (l.a < 0.3) continue;
    const x1 = CX_(l.x1);
    const y1 = CY_(l.y1);
    const x2 = CX_(l.x2);
    const y2 = CY_(l.y2);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    const slope = Math.abs(dy) < 0.4 ? "-" : Math.abs(dx) < 0.4 ? "|" : dx * dy > 0 ? "\\" : "/";
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      put(x1 + dx * t, y1 + dy * t, {
        ch: slope,
        tone: l.tone,
        a: Math.max(ASCII_FLOOR, l.a),
      });
    }
  }

  for (const d of p.dots) {
    const cx = CX_(d.x);
    const cy = CY_(d.y);
    const rx = d.r * spanW;
    const ry = d.r * rows;

    const a = Math.max(ASCII_FLOOR, d.a);

    if (rx < 0.5) {
      // too small for a disc, but its weight still belongs on the ramp
      const ch = RAMP[Math.floor(Math.min(0.999, rx / 0.5) * 5)];
      put(cx, cy, { ch, tone: d.tone, a });
      continue;
    }

    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const nx = (ix - cx) / rx;
        const ny = (iy - cy) / ry;
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist > 1) continue;
        const density = Math.min(0.999, (1 - dist) * 0.55 + 0.45);
        const ch = RAMP[Math.floor(density * RAMP.length)];
        put(ix, iy, { ch, tone: d.tone, a });
      }
    }
  }

  // hairline frame — plain ASCII only: box-drawing glyphs fall back to another
  // font with a different advance width, which shears the whole grid
  const fx0 = Math.round(CX_(FRAME_MIN));
  const fx1 = Math.round(CX_(FRAME_MAX));
  const fy0 = Math.round(CY_(FRAME_MIN));
  const fy1 = Math.round(CY_(FRAME_MAX));
  const frame = (ix: number, iy: number, ch: string) => {
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) return;
    const i = iy * cols + ix;
    if (!grid[i]) grid[i] = { ch, tone: 0.55, a: 0.55 };
  };
  for (let ix = fx0; ix <= fx1; ix++) {
    frame(ix, fy0, "-");
    frame(ix, fy1, "-");
  }
  for (let iy = fy0; iy <= fy1; iy++) {
    frame(fx0, iy, "|");
    frame(fx1, iy, "|");
  }
  for (const [fx, fy] of [
    [fx0, fy0],
    [fx1, fy0],
    [fx0, fy1],
    [fx1, fy1],
  ] as const) {
    frame(fx, fy, "+");
  }

  // emit, grouping contiguous runs of identical style into one span
  let out = "<code>";
  for (let iy = 0; iy < rows; iy++) {
    let run = "";
    let key = "";
    let color = "";
    for (let ix = 0; ix < cols; ix++) {
      const cell = grid[iy * cols + ix];
      const c = cell ? toneColor(cell.tone) : "";
      const alpha = cell ? Math.round(Math.min(1, cell.a) * 10) / 10 : 0;
      const k = cell ? `${c}|${alpha}` : "";
      if (k !== key) {
        if (run) out += key ? `<span style="color:${color};opacity:${key.split("|")[1]}">${run}</span>` : run;
        run = "";
        key = k;
        color = c;
      }
      run += cell ? esc(cell.ch) : " ";
    }
    if (run) out += key ? `<span style="color:${color};opacity:${key.split("|")[1]}">${run}</span>` : run;
    out += "\n";
  }
  return `${out}</code>`;
}

/* --------------------------------------------------------------- component */

export default function KaijsaFace() {
  const [mode, setMode] = useState<Mode>("dots");
  const [variant, setVariant] = useState<Variant>("researcher");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastAscii = 0;
    let lastFont = 0;
    let cellRatio = 0.6 / ASCII_LINE_HEIGHT;
    const start = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tick = (now: number) => {
      // reduced motion: hold a single, well-composed frame
      const time = reduced ? 3.2 : (now - start) / 1000;
      const wrap = wrapRef.current;
      if (!wrap) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const h = wrap.clientHeight;
      const w = wrap.clientWidth;

      if (mode === "dots") {
        const canvas = canvasRef.current;
        if (canvas) {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          if (
            canvas.width !== Math.round(w * dpr) ||
            canvas.height !== Math.round(h * dpr)
          ) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
          }
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            paintCanvas(ctx, buildPortrait(time, 1, variant), w, h, time);
          }
        }
      } else if (now - lastAscii > 70) {
        // the character grid is far cheaper to look at than to rebuild
        lastAscii = now;
        const pre = preRef.current;
        if (pre) {
          const rows = h < 400 ? ASCII_ROWS_SMALL : ASCII_ROWS;
          // size the type so `rows` lines fill the stage exactly
          const fontSize = h / (rows * ASCII_LINE_HEIGHT);
          if (fontSize !== lastFont) {
            lastFont = fontSize;
            pre.style.fontSize = `${fontSize}px`;
            cellRatio = measureCellRatio(pre, fontSize);
          }
          const cols = Math.floor(w / (fontSize * ASCII_LINE_HEIGHT * cellRatio));
          pre.innerHTML = renderAscii(
            buildPortrait(time, 0.68, variant),
            cols,
            rows,
            cellRatio,
          );
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, variant]);

  return (
    <div className="face">
      <div className="face__stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="face__canvas"
          style={{ opacity: mode === "dots" ? 1 : 0 }}
          aria-hidden="true"
        />
        <pre
          ref={preRef}
          className="face__ascii"
          style={{ opacity: mode === "ascii" ? 1 : 0 }}
          aria-hidden="true"
        />
        <span className="sr-only">
          A generative portrait of Kaijsa: a face drawn from concentric discs in
          cream, amber and burnt orange on black, ringed by a slow constellation
          of nodes.
        </span>
      </div>

      <div className="face__controls">
        <div className="face__switch face__switch--variants" role="group" aria-label="Portrait">
          {CHOICES.map((v, i) => (
            <Fragment key={v.id}>
              <span className="face__opt">
                {i % PER_ROW !== 0 && (
                  <span className="face__dot" aria-hidden="true">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  className={variant === v.id ? "is-active" : ""}
                  onClick={() => setVariant(v.id)}
                  aria-pressed={variant === v.id}
                  title={v.blurb}
                >
                  {v.label}
                </button>
              </span>
              {/* a zero-height full-width item forces the flex line to break */}
              {(i + 1) % PER_ROW === 0 && i < CHOICES.length - 1 && (
                <span className="face__break" aria-hidden="true" />
              )}
            </Fragment>
          ))}
        </div>

        <div className="face__switch" role="group" aria-label="Rendering mode">
          <button
            type="button"
            className={mode === "dots" ? "is-active" : ""}
            onClick={() => setMode("dots")}
            aria-pressed={mode === "dots"}
          >
            discs
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className={mode === "ascii" ? "is-active" : ""}
            onClick={() => setMode("ascii")}
            aria-pressed={mode === "ascii"}
          >
            ascii
          </button>
        </div>
      </div>
    </div>
  );
}
