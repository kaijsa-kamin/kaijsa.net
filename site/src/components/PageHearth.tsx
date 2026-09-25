"use client";

import { useEffect, useRef } from "react";
import { kaminenMark, toneColor } from "@/lib/face";

/**
 * The ground the whole site stands on: a warm glow off the floor of the
 * viewport, a slow drift of embers, and her own kaminen mark held very faintly
 * behind everything — the same geometry the pendant is drawn from, so the page
 * mark and the jewellery cannot disagree.
 *
 * Deliberately near the edge of visible. If you notice it as a picture rather
 * than as warmth, it is turned up too far.
 */

const EMBERS = 26;
const WATERMARK_ALPHA = 0.052;
const EMBER_ALPHA = 0.2;
const GLOW_ALPHA = 0.055;

export default function PageHearth() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Nothing to draw on paper: the mark is a glow off a black floor, and a
    // light page has no floor. Checked per mount, and the theme toggle
    // remounts nothing — so the CSS hides it too, and this only saves the work.
    const light = () => document.documentElement.dataset.theme === "light";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      const time = reduced ? 4 : (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);

      if (light()) {
        raf = requestAnimationFrame(frame);
        return;
      }

      // the glow off the floor
      const glow = ctx.createRadialGradient(w * 0.5, h * 1.06, 0, w * 0.5, h * 1.06, h * 0.78);
      const breathe = 0.85 + 0.15 * Math.sin(time * 0.22);
      glow.addColorStop(0, `rgba(236, 74, 37, ${GLOW_ALPHA * breathe})`);
      glow.addColorStop(0.45, `rgba(242, 107, 34, ${GLOW_ALPHA * 0.42 * breathe})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // her mark, very faint, rising out of the floor
      const markH = h * 0.66;
      const markX = w * 0.5;
      const markBase = h * 1.04;
      ctx.globalAlpha = WATERMARK_ALPHA;
      for (const d of kaminenMark(time, 1)) {
        ctx.fillStyle = toneColor(d.tone);
        ctx.beginPath();
        ctx.arc(
          markX + (d.x - 0.5) * markH,
          markBase - (1 - d.y) * markH,
          Math.max(0.6, d.r * markH),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // embers, lifting and cooling
      for (let i = 0; i < EMBERS; i++) {
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const rnd = a - Math.floor(a);
        const b = Math.sin(i * 78.233) * 12345.6789;
        const rnd2 = b - Math.floor(b);

        const t = (time * (0.012 + rnd * 0.016) + rnd2) % 1;
        const x = (0.06 + rnd * 0.88 + 0.03 * Math.sin(time * 0.3 + i * 1.7) * t) * w;
        const y = (1.02 - t * 1.06) * h;
        const r = (3.4 - 2.6 * Math.pow(t, 0.7)) * (0.55 + rnd2 * 0.8);
        const fade =
          Math.sin(Math.min(1, t * 5) * Math.PI * 0.5) * (1 - Math.pow(t, 1.7));

        ctx.globalAlpha = EMBER_ALPHA * fade;
        ctx.fillStyle = toneColor(0.97 - 0.92 * Math.pow(t, 0.75));
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="page-hearth" aria-hidden="true" />;
}
