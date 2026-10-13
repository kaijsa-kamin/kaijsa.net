"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

/* ==========================================================================
   The hero portrait.

   These are her own drawings, not a generated approximation of them. The disc
   generator that drew this before could not reach them — a hand against the
   chin, headphones, hair in flowing beaded strands — and a cruder cousin of a
   better picture is not worth the arithmetic.

   The generator has not gone anywhere: it still draws the kaminen in the page
   ground, the mark on the book cover, and every variant in the archive at
   /portraits.html. What changed is only which of the two belongs in the hero.

   The ASCII reading survives the swap. It is sampled from the artwork's own
   luminance rather than from geometry, so it works for whatever she puts here
   next.
   ========================================================================== */

type Portrait = { id: string; label: string; blurb: string; src: string };

const PORTRAITS: Portrait[] = [
  { id: "writer", label: "writer", src: "/images/portrait-writer.jpg", blurb: "pen down, listening" },
  { id: "philosopher", label: "philosopher", src: "/images/portrait-philosopher.jpg", blurb: "haloed, mid-thought" },
  { id: "researcher", label: "researcher", src: "/images/portrait-researcher.jpg", blurb: "close, unhaloed" },
];

const RAMP = " .:-=+*#%@";
const ASCII_ROWS = 56;
const ASCII_ROWS_SMALL = 42;
/** the art is mostly black; below this the grid stays empty rather than noisy */
const FLOOR = 0.05;
const GAMMA = 0.62;
/** samples per cell per axis — see the comment on the sampling loop */
const SUB = 3;

/** her own ramp, so the characters carry the palette and not a flat orange */
const TONES = ["#5a3414", "#8a4a16", "#ce2f17", "#f26b22", "#f9ae33", "#fbd070", "#fdf6e3"];

export default function KaijsaFace() {
  const [portrait, setPortrait] = useState<Portrait>(PORTRAITS[0]);
  const [mode, setMode] = useState<"drawn" | "ascii">("drawn");
  const [grid, setGrid] = useState<{ ch: string; tone: number }[][]>([]);
  /** measured after the grid lands, so the face fills its frame exactly */
  const [fit, setFit] = useState(1);
  const codeRef = useRef<HTMLElement>(null);
  const asciiRef = useRef<HTMLPreElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  /**
   * How wide a character is against how tall, measured from the grid that is
   * actually on screen.
   *
   * A detached probe span lies about this: it reported 0.75 while the rendered
   * cell was 0.28, because the probe does not inherit the block's line-height.
   * Sampling a square picture into a grid built on the wrong number is what
   * squeezed the face into a column.
   */
  const [cellAspect, setCellAspect] = useState(0.5);

  useEffect(() => {
    if (mode !== "ascii") return;
    let cancelled = false;

    const rows = window.innerWidth < 560 ? ASCII_ROWS_SMALL : ASCII_ROWS;
    // a square picture wants the grid square too: cols * cellW == rows * cellH
    const cols = Math.max(8, Math.round(rows / cellAspect));

    // window.Image, because next/image shadows the global constructor here
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      // Sample finer than the grid, then take the brightest sample in each
      // cell rather than the average. The drawing is thin bright beads on
      // black: averaging a cell that holds one bead and eight black neighbours
      // returns black, and the whole face dissolves. Taking the brightest keeps
      // every stroke that crosses a cell.
      const sw = cols * SUB;
      const sh = rows * SUB;
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(img, 0, 0, sw, sh);
      const px = g.getImageData(0, 0, sw, sh).data;

      const next: { ch: string; tone: number }[][] = [];
      for (let y = 0; y < rows; y++) {
        const line: { ch: string; tone: number }[] = [];
        for (let x = 0; x < cols; x++) {
          let peak = 0;
          for (let dy = 0; dy < SUB; dy++) {
            for (let dx = 0; dx < SUB; dx++) {
              const i = ((y * SUB + dy) * sw + (x * SUB + dx)) * 4;
              const lum = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
              if (lum > peak) peak = lum;
            }
          }
          const v = peak <= FLOOR ? 0 : Math.pow((peak - FLOOR) / (1 - FLOOR), GAMMA);
          line.push({
            ch: RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))],
            tone: v,
          });
        }
        next.push(line);
      }

      setGrid(next);
    };
    img.src = portrait.src;

    return () => {
      cancelled = true;
    };
  }, [mode, portrait, cellAspect]);

  /** Correct the cell aspect from the grid on screen, once it differs enough
   *  to matter. One pass settles it; the guard stops it oscillating. */
  useEffect(() => {
    if (mode !== "ascii" || !grid.length) return;
    const code = codeRef.current;
    if (!code) return;
    const prev = code.style.transform;
    code.style.transform = "scale(1)";
    const box = code.getBoundingClientRect();
    code.style.transform = prev;

    const cols = grid[0]?.length ?? 1;
    const measured = box.width / cols / (box.height / grid.length);
    if (measured > 0 && Math.abs(measured - cellAspect) / cellAspect > 0.04) {
      setCellAspect(measured);
    }
  }, [grid, mode, cellAspect]);

  /**
   * Scale the finished block to the frame.
   *
   * Computing a font size from the font's own metrics did not survive contact
   * with them: the cell came out 3.12 by 11 against a predicted ratio of 0.75,
   * and fifty-six rows overflowed a 468px frame by a third. Measuring the block
   * after it exists and scaling it is indifferent to which font loaded.
   */
  useEffect(() => {
    if (mode !== "ascii" || !grid.length) return;
    const code = codeRef.current;
    const stage = stageRef.current;
    if (!code || !stage) return;

    const prev = code.style.transform;
    code.style.transform = "scale(1)";
    const box = code.getBoundingClientRect();
    code.style.transform = prev;

    const s = stage.getBoundingClientRect();
    if (box.width && box.height) {
      setFit(Math.min(s.width / box.width, s.height / box.height));
    }
  }, [grid, mode]);

  return (
    <div className="face">
      <div className="face__stage" ref={stageRef}>
        {/* through the optimiser: 243KB of JPEG becomes 88KB of WebP at the
            size this frame actually asks for. The ASCII sampler reads the
            original separately, and only when it is switched on. */}
        <Image
          className="face__art"
          src={portrait.src}
          alt={`Kaijsa as ${portrait.label}: a portrait drawn in beads of ember light on black — glasses, a mechanical hand at the chin, the kaminen at her throat`}
          width={1120}
          height={1120}
          sizes="(max-width: 720px) 92vw, 560px"
          priority
          style={{ opacity: mode === "drawn" ? 1 : 0 }}
        />

        <pre
          className="face__ascii"
          ref={asciiRef}
          style={{ opacity: mode === "ascii" ? 1 : 0 }}
          aria-hidden="true"
        >
          <code ref={codeRef} style={{ transform: `scale(${fit})` }}>
            {grid.map((line, y) => (
              <span className="face__row" key={y}>
                {line.map((cell, x) => (
                  <span
                    key={x}
                    style={{
                      color: TONES[Math.min(TONES.length - 1, Math.floor(cell.tone * TONES.length))],
                    }}
                  >
                    {cell.ch}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <div className="face__controls">
        <div className="face__switch face__switch--variants" role="group" aria-label="Portrait">
          {PORTRAITS.map((p, i) => (
            <Fragment key={p.id}>
              <span className="face__opt">
                {i !== 0 && (
                  <span className="face__dot" aria-hidden="true">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  className={portrait.id === p.id ? "is-active" : ""}
                  onClick={() => setPortrait(p)}
                  aria-pressed={portrait.id === p.id}
                  title={p.blurb}
                >
                  {p.label}
                </button>
              </span>
            </Fragment>
          ))}
        </div>

        <div className="face__switch" role="group" aria-label="Rendering mode">
          <button
            type="button"
            className={mode === "drawn" ? "is-active" : ""}
            onClick={() => setMode("drawn")}
            aria-pressed={mode === "drawn"}
          >
            drawn
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
