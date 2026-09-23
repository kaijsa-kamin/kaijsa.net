/**
 * KAIJSA — generative portraits.
 *
 * Every mark is one of two things: a filled disc, or a hairline between two
 * discs. That is the whole vocabulary, taken from the studies in /images —
 * flat circles, a cream→brick ramp, a thin frame. Three portraits are built
 * from it, and both renderers (canvas and ASCII) consume the same field, so
 * the two modes are literally the same artwork.
 */

/** cream → brick, sampled top-down like the vertical study in /images/2 */
export const PALETTE = [
  "#FDF6E3",
  "#FBE9B0",
  "#FBD070",
  "#F9AE33",
  "#F58C1F",
  "#F26B22",
  "#EC4A25",
  "#CE2F17",
] as const;

/** tone: 0 = cream, 1 = brick. */
export function toneColor(tone: number): string {
  const t = Math.min(0.999, Math.max(0, tone));
  return PALETTE[Math.floor(t * PALETTE.length)];
}

export type Dot = { x: number; y: number; r: number; tone: number; a: number };
export type Line = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone: number;
  a: number;
};
export type Portrait = { dots: Dot[]; lines: Line[] };

/**
 * Two treatments of the same geometry, kept side by side on purpose.
 *
 * "classic" is the original look: a cream disc for the iris and a heavy
 * three-arc mouth at the brick end of the ramp. "open" is the later one: the
 * iris as a ring with the pupil left as bare ground, a seam-led mouth, and a
 * slight lift at the corners.
 */
export type Style = "classic" | "open";

export type Variant =
  | "muse"
  | "oracle"
  | "scholar"
  | "writer"
  | "chronicler"
  | "philosopher"
  | "socratic"
  | "stoic"
  | "analytic"
  | "researcher"
  | "scientist";

export const VARIANTS: { id: Variant; label: string; blurb: string }[] = [
  { id: "muse", label: "muse", blurb: "front · soft" },
  { id: "oracle", label: "oracle", blurb: "front · wired" },
  { id: "scholar", label: "scholar", blurb: "front · archive" },
  { id: "writer", label: "writer", blurb: "front · chronology" },
  { id: "chronicler", label: "chronicler", blurb: "front · braided" },
  { id: "philosopher", label: "philosopher", blurb: "front · the gap" },
  { id: "socratic", label: "socratic", blurb: "front · himation" },
  { id: "stoic", label: "stoic", blurb: "front · toga" },
  { id: "analytic", label: "analytic", blurb: "front · frames" },
  { id: "researcher", label: "researcher", blurb: "front · research" },
  { id: "scientist", label: "scientist", blurb: "front · orbits" },
];

const TAU = Math.PI * 2;
type Pt = [number, number];

/* ------------------------------------------------------------- curve utils */

function quad(t: number, p0: Pt, p1: Pt, p2: Pt): Pt {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

function cubic(t: number, p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3);
  return [axis(p0[0], p1[0], p2[0], p3[0]), axis(p0[1], p1[1], p2[1], p3[1])];
}

/** Smooth a hand-placed control polygon into a dense point path. */
function spline(pts: Pt[], steps: number, closed = false): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const at = (i: number): Pt =>
    closed ? pts[((i % n) + n) % n] : pts[Math.min(n - 1, Math.max(0, i))];
  const segs = closed ? n : n - 1;
  for (let s = 0; s < segs; s++) {
    for (let j = 0; j < steps; j++) {
      out.push(catmull(at(s - 1), at(s), at(s + 1), at(s + 2), j / steps));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/* ----------------------------------------------------------------- emitter */

type Ramp = number | ((t: number) => number);

type Emit = {
  style: Style;
  dot: (x: number, y: number, r: number, tone: number, a?: number) => void;
  line: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tone: number,
    a?: number,
  ) => void;
  /** lay a run of dots along a path, tapering radius, tone and alpha across it */
  path: (pts: Pt[], opts: { r: Ramp; tone: Ramp; a?: Ramp }) => void;
  n: (count: number) => number;
};

const CX = 0.5;

function makeEmitter(
  dots: Dot[],
  lines: Line[],
  detail: number,
  cy: number,
  scale: number,
  sway: number,
  style: Style,
): Emit {
  const dot: Emit["dot"] = (x, y, r, tone, a = 1) => {
    dots.push({
      x: CX + (x - CX) * scale + sway,
      y: cy + (y - cy) * scale,
      r: r * scale,
      tone,
      a,
    });
  };
  const line: Emit["line"] = (x1, y1, x2, y2, tone, a = 1) => {
    lines.push({
      x1: CX + (x1 - CX) * scale + sway,
      y1: cy + (y1 - cy) * scale,
      x2: CX + (x2 - CX) * scale + sway,
      y2: cy + (y2 - cy) * scale,
      tone,
      a,
    });
  };
  const pick = (v: Ramp, t: number) => (typeof v === "function" ? v(t) : v);

  return {
    style,
    dot,
    line,
    n: (count) => Math.max(3, Math.round(count * detail)),
    path: (pts, opts) => {
      for (let i = 0; i < pts.length; i++) {
        const t = pts.length < 2 ? 0 : i / (pts.length - 1);
        dot(pts[i][0], pts[i][1], pick(opts.r, t), pick(opts.tone, t), pick(opts.a ?? 1, t));
      }
    },
  };
}

/* --------------------------------------------------------- shared features */

/**
 * The iris as an open ring of amber, with the pupil left as bare ground.
 *
 * Not a filled disc: a pale one reads as a boiled eyeball, and a dark one has
 * to come out of the bottom of the ramp, which is brick red — and red eyes read
 * as malice. The palette has no neutral to retreat to, so the pupil is simply
 * nothing at all, and the black of the page does the work.
 */
function irisRing(
  em: Emit,
  cx: number,
  cy: number,
  r: number,
  lid: number,
  count = 14,
) {
  const n = em.n(count);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    em.dot(
      cx + Math.cos(th) * r,
      cy + Math.sin(th) * r * 0.92,
      0.0019 * lid,
      0.36 + 0.1 * Math.sin(th * 2),
      0.95,
    );
  }
}

/**
 * An almond eye: two lid curves meeting at the corners, a cream iris with an
 * amber core, a lash flick at the outer corner.
 * `side` is -1 for the viewer's left eye, +1 for the right.
 */
function almondEye(
  em: Emit,
  ex: number,
  ey: number,
  side: number,
  s: number,
  lid: number,
  opts: { lashes?: boolean; tilt?: number } = {},
) {
  const classic = em.style === "classic";
  const hw = 0.041 * s;
  const rise = 0.0185 * s * lid;
  // slightly shallower than neutral: the lower lid rides up when she means it
  const drop = (classic ? 0.0125 : 0.0112) * s * lid;
  const tilt = (opts.tilt ?? 0.006) * s;

  const inner: Pt = [ex - side * hw, ey + tilt];
  const outer: Pt = [ex + side * hw, ey - tilt];

  const upper: Pt[] = [];
  const lower: Pt[] = [];
  const steps = em.n(16);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    upper.push(quad(t, inner, [ex + side * 0.004 * s, ey - rise - tilt * 0.6], outer));
    lower.push(quad(t, inner, [ex + side * 0.002 * s, ey + drop + tilt * 0.4], outer));
  }
  // the upper lash line is the heaviest mark in the face
  em.path(upper, {
    r: (t) => (0.0014 + 0.0015 * Math.sin(t * Math.PI)) * s,
    tone: 0.46,
    a: 0.95,
  });
  em.path(lower, {
    r: (t) => (0.0009 + 0.0008 * Math.sin(t * Math.PI)) * s,
    tone: 0.56,
    a: 0.6,
  });

  if (lid > 0.25) {
    const ix = ex + side * 0.0025 * s;
    const iy = ey + 0.0015 * s;
    if (classic) {
      em.dot(ix, iy, 0.0136 * s * lid, 0.03, 1);
      em.dot(ix, iy, 0.0092 * s * lid, 0.33, 1);
      em.dot(ix, iy, 0.0035 * s * lid, 0.95, 1);
      em.dot(ix - side * 0.0042 * s, iy - 0.0042 * s, 0.0013 * s * lid, 0, 0.95);
    } else {
      irisRing(em, ix, iy, 0.0102 * s, lid);
    }
  }

  if (opts.lashes !== false) {
    const lashes = em.n(4);
    for (let i = 0; i < lashes; i++) {
      const t = lashes < 2 ? 0 : i / (lashes - 1);
      em.dot(
        outer[0] + side * (0.004 + t * 0.011) * s,
        outer[1] - (0.002 + t * 0.006) * s,
        (0.0013 - t * 0.0006) * s,
        0.42,
        0.85 - t * 0.3,
      );
    }
  }
  em.dot(inner[0] - side * 0.003 * s, inner[1] + 0.001 * s, 0.0012 * s, 0.7, 0.65);
}

/** An arched brow: thick at the inner end, tapering past the peak. */
function brow(
  em: Emit,
  ex: number,
  ey: number,
  side: number,
  s: number,
  lift = 0,
  opts: { arch?: number; weight?: number; tilt?: number } = {},
) {
  const arch = opts.arch ?? 1;
  const w = opts.weight ?? 1;
  const tilt = opts.tilt ?? 0;
  const pts: Pt[] = [];
  const steps = em.n(14);
  const p0: Pt = [ex - side * 0.038 * s, ey - (0.043 + lift) * s];
  const p1: Pt = [ex + side * 0.016 * s, ey - (0.043 + lift + 0.016 * arch) * s];
  const p2: Pt = [ex + side * 0.052 * s, ey - (0.041 + lift + tilt) * s];
  for (let i = 0; i <= steps; i++) pts.push(quad(i / steps, p0, p1, p2));
  em.path(pts, {
    // a low, flat brow keeps its weight all the way out
    r: (t) => (0.0026 - t * 0.0016 * arch) * s * w,
    tone: (t) => 0.4 + 0.22 * t,
    a: (t) => 0.9 - 0.25 * t * arch,
  });
}

/** Lips with a real cupid's bow — narrow, defined, the warmest marks present. */
function lips(
  em: Emit,
  cx: number,
  ly: number,
  s: number,
  halfWidth = 0.041,
  opts: {
    bow?: number;
    fullness?: number;
    upperWeight?: number;
    lowerWeight?: number;
    smile?: number;
  } = {},
) {
  const bowAmt = opts.bow ?? 1;
  const full = opts.fullness ?? 1;
  const uw = opts.upperWeight ?? 1;
  const lw = opts.lowerWeight ?? 1;
  const classic = em.style === "classic";
  // the original mouth was neutral, with the corners dropping slightly
  const smile = classic ? 0 : (opts.smile ?? 1);
  const steps = em.n(20);
  const upper: Pt[] = [];
  const seam: Pt[] = [];
  const lower: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps;
    const x = cx + t * halfWidth * s;
    const bell = Math.sqrt(Math.max(0, 1 - t * t));
    const bow = 0.0105 * full * bell * (0.72 + 0.28 * bowAmt * Math.cos(t * Math.PI * 2));
    // positive drops the corners, negative lifts them; a little lift is the
    // whole difference between neutral and pleased
    const corner = (0.004 - 0.008 * smile) * t * t;
    upper.push([x, ly - bow * s + corner * s]);
    seam.push([x, ly + corner * s]);
    lower.push([x, ly + corner * s + 0.0165 * full * lw * Math.pow(bell, 0.7) * s]);
  }
  // The seam carries the mouth; the lips themselves are only suggested. Three
  // heavy arcs of brick red read as lipstick rather than as a mouth.
  if (classic) {
    em.path(upper, {
      r: (t) => (0.0018 + 0.0012 * Math.sin(t * Math.PI)) * s * uw,
      tone: 0.76,
      a: 0.9 * Math.min(1, uw + 0.25),
    });
    em.path(seam, {
      r: (t) => (0.0016 + 0.0018 * Math.sin(t * Math.PI)) * s,
      tone: 0.93,
      a: 1,
    });
    em.path(lower, {
      r: (t) => (0.0019 + 0.0022 * Math.sin(t * Math.PI)) * s * lw,
      tone: 0.84,
      a: 0.92,
    });
  } else {
    em.path(upper, {
      r: (t) => (0.0012 + 0.0009 * Math.sin(t * Math.PI)) * s * uw,
      tone: 0.46,
      a: 0.34 * Math.min(1, uw + 0.3),
    });
    em.path(seam, {
      r: (t) => (0.0015 + 0.0019 * Math.sin(t * Math.PI)) * s,
      tone: 0.64,
      a: 0.9,
    });
    em.path(lower, {
      r: (t) => (0.0012 + 0.0013 * Math.sin(t * Math.PI)) * s * lw,
      tone: 0.56,
      a: 0.42,
    });
  }

  if (smile > 0) {
    const cy = ly + (0.004 - 0.008 * smile) * s;
    for (const side of [-1, 1] as const) {
      em.dot(cx + side * (halfWidth + 0.005) * s, cy - 0.0022 * s, 0.0013 * s, 0.5, 0.55 * smile);
    }
  }
}

/** Bridge, tip and nostrils — suggested, never outlined. */
function nose(
  em: Emit,
  cx: number,
  top: number,
  base: number,
  s: number,
  opts: { spread?: number; bridge?: number; tip?: number; nostril?: number } = {},
) {
  const sp = opts.spread ?? 1;
  const bridge = opts.bridge ?? 1;
  const steps = em.n(9);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = top + (base - top) * t;
    // a flatter bridge casts less shadow, so the sides read lighter
    const spread = (0.008 + 0.006 * t * t) * sp * s;
    const r = (0.0009 + 0.0011 * t) * s;
    em.dot(cx - spread, y, r, 0.3 + 0.2 * t, (0.16 + 0.34 * t) * bridge);
    em.dot(cx + spread, y, r, 0.3 + 0.2 * t, (0.16 + 0.34 * t) * bridge);
  }
  em.dot(cx, base + 0.004 * s, 0.0044 * (opts.tip ?? 1) * s, 0.6, 0.72);
  const nx = 0.0145 * (opts.nostril ?? 1) * s;
  em.dot(cx - nx, base + 0.002 * s, 0.0028 * s, 0.72, 0.8);
  em.dot(cx + nx, base + 0.002 * s, 0.0028 * s, 0.72, 0.8);
}

/** A cheekbone lit from above — the mark that does most of the "model" work. */
function cheekbone(em: Emit, ex: number, ey: number, side: number, s: number) {
  const pts: Pt[] = [];
  const steps = em.n(14);
  const p0: Pt = [ex + side * 0.052 * s, ey + 0.02 * s];
  const p1: Pt = [ex + side * 0.04 * s, ey + 0.06 * s];
  const p2: Pt = [ex - side * 0.006 * s, ey + 0.072 * s];
  for (let i = 0; i <= steps; i++) pts.push(quad(i / steps, p0, p1, p2));
  em.path(pts, {
    r: (t) => (0.0016 - t * 0.0007) * s,
    tone: 0.3,
    a: (t) => 0.5 * (1 - t * 0.6),
  });
}

/** Neck, trapezius and collarbone. Turns a floating head into a portrait. */
function bust(
  em: Emit,
  cx: number,
  jawY: number,
  s: number,
  opts: { neckHalf?: number; shoulder?: number; floor?: number; neckLen?: number } = {},
) {
  const nh = (opts.neckHalf ?? 0.05) * s;
  const shoulder = (opts.shoulder ?? 0.235) * s;
  const floor = opts.floor ?? 0.875;
  const neckBottom = jawY + (opts.neckLen ?? 0.115) * s;

  for (const side of [-1, 1] as const) {
    const neck: Pt[] = [];
    const steps = em.n(13);
    for (let i = 0; i <= steps; i++) {
      neck.push(
        quad(
          i / steps,
          [cx + side * nh * 0.92, jawY],
          [cx + side * nh * 0.84, jawY + 0.06 * s],
          [cx + side * nh * 1.12, neckBottom],
        ),
      );
    }
    em.path(neck, { r: 0.0019 * s, tone: (t) => 0.5 + 0.25 * t, a: 0.55 });

    const arm: Pt[] = [];
    const ss = em.n(26);
    for (let i = 0; i <= ss; i++) {
      arm.push(
        cubic(
          i / ss,
          [cx + side * nh * 1.12, neckBottom],
          [cx + side * (nh + 0.055 * s), neckBottom + 0.016 * s],
          [cx + side * shoulder * 0.62, neckBottom + 0.036 * s],
          [cx + side * shoulder, floor],
        ),
      );
    }
    em.path(arm, {
      r: (t) => (0.0021 + 0.0013 * t) * s,
      tone: (t) => 0.62 + 0.3 * t,
      a: (t) => 0.55 - 0.22 * t,
    });
  }

  const collar: Pt[] = [];
  const cs = em.n(24);
  for (let i = 0; i <= cs; i++) {
    const t = -1 + (2 * i) / cs;
    collar.push([
      cx + t * 0.14 * s,
      neckBottom +
        0.03 * s +
        0.012 * s * Math.pow(Math.abs(t), 1.7) -
        0.006 * s * (1 - t * t),
    ]);
  }
  em.path(collar, {
    r: (t) => (0.0011 + 0.0012 * Math.sin(t * Math.PI)) * s,
    tone: 0.5,
    a: (t) => 0.2 + 0.4 * Math.sin(t * Math.PI),
  });
}

/**
 * Her mark is a stove, so the ground behind her is not neutral ground: a slow
 * drift of embers lifting off the floor of the frame and cooling as they climb,
 * cream by the time they reach the top — the kaminen ramp, read vertically.
 *
 * Deliberately sparse and slow. It should register as warmth in the room, not
 * as weather. Drawn first, so everything else sits in front of it.
 */
function hearth(em: Emit, time: number, phase = 0, count = 34) {
  // The glow off the floor, faked as a stack of very faint wide discs. The
  // palette gives us no gradient, but overlapping low-alpha discs accumulate
  // into one, and the dome is centred below the frame so only its top shows.
  const breathe = 0.5 + 0.5 * Math.sin(time * 0.28 + phase * 1.9);
  // many faint layers rather than a few: seven showed their own edges as rings
  const layers = em.n(18);
  for (let k = 0; k < layers; k++) {
    const f = k / (layers - 1);
    em.dot(
      0.5,
      1.05,
      0.43 - Math.pow(f, 0.85) * 0.31,
      0.93 - f * 0.3,
      (0.011 + f * 0.009) * (0.78 + 0.22 * breathe),
    );
  }

  const n = em.n(count);
  for (let i = 0; i < n; i++) {
    // a stable value per ember, so they never march in step
    const j = i + phase * 7.3;
    const a = Math.sin(j * 12.9898) * 43758.5453;
    const rnd = a - Math.floor(a);
    const b = Math.sin(j * 78.233) * 12345.6789;
    const rnd2 = b - Math.floor(b);

    const speed = 0.015 + rnd * 0.019;
    const t = (time * speed + rnd2) % 1; // 0 at the floor, 1 at the top
    const x = 0.1 + rnd * 0.8 + 0.04 * Math.sin(time * 0.35 + i * 1.7) * t;
    const y = 0.97 - t * 0.86;
    // heaviest just off the floor, gone to sparks by the time they clear her
    const r = (0.0052 - 0.0042 * Math.pow(t, 0.7)) * (0.55 + rnd2 * 0.8);
    const tone = 0.97 - 0.92 * Math.pow(t, 0.75);
    const fade = Math.sin(Math.min(1, t * 5) * Math.PI * 0.5) * (1 - Math.pow(t, 1.7));
    em.dot(x, y, Math.max(0.0008, r), tone, 0.66 * fade);
  }
}

/** Slow constellation, borrowed wholesale from /images/1. */
function halo(
  em: Emit,
  cx: number,
  cy: number,
  time: number,
  opts: { radius?: number; from?: number; span?: number; count?: number; a?: number } = {},
) {
  const count = em.n(opts.count ?? 16);
  const from = opts.from ?? 0;
  const span = opts.span ?? TAU;
  const radius = opts.radius ?? 0.3;
  const alpha = opts.a ?? 1;
  for (let i = 0; i < count; i++) {
    const th = from + (i / count) * span + time * 0.05;
    const wob = 0.013 * Math.sin(time * 0.5 + i * 1.3);
    const rad = radius + 0.045 * Math.sin(i * 2.4) + wob;
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.05 - i * 0.55);
    em.dot(
      cx + Math.cos(th) * rad,
      cy + Math.sin(th) * rad * 0.95,
      0.0017 + 0.0045 * pulse,
      (i % PALETTE.length) / PALETTE.length,
      (0.3 + 0.5 * pulse) * alpha,
    );
  }
}

/**
 * The kaminen mark, after /images/kaminen: a rising fire — a heavy brick base
 * with flanking embers, narrowing into a column that cools to pale sparks.
 * This is her emblem; each portrait wears it somewhere.
 */
function kaminen(em: Emit, cx: number, baseY: number, h: number, time: number, a = 1) {
  const rows = em.n(10);
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1); // 0 at the base, 1 at the tip
    const y = baseY - t * h;
    const r = h * (0.105 * Math.pow(1 - t, 1.35) + 0.014);
    const tone = 0.95 - 0.95 * Math.pow(t, 0.75);
    const lick = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(time * 2 - t * 3.4));
    em.dot(cx + h * 0.012 * Math.sin(t * 5 + time), y, r, tone, a * lick);
    if (t < 0.5) {
      const off = h * 0.17 * (1 - t * 2);
      em.dot(cx - off, y + h * 0.012, r * 0.52, Math.min(0.99, tone + 0.05), a * lick * 0.85);
      em.dot(cx + off, y + h * 0.012, r * 0.52, Math.min(0.99, tone + 0.05), a * lick * 0.85);
    }
  }
  // the two sparks that leave the top
  const flare = 0.5 + 0.5 * Math.sin(time * 1.6);
  em.dot(cx + h * 0.05, baseY - h * 1.08, h * 0.022, 0, a * (0.4 + 0.5 * flare));
  em.dot(cx - h * 0.03, baseY - h * 1.17, h * 0.015, 0, a * (0.3 + 0.5 * (1 - flare)));
}

/**
 * The kaminen mark on its own, in a 0..1 box: the fire fills the height and is
 * centred on x = 0.5. Exported so the page ground can carry her mark without a
 * second copy of the geometry — the logo and the pendant are the same drawing.
 */
export function kaminenMark(time: number, detail = 1): Dot[] {
  const dots: Dot[] = [];
  const em = makeEmitter(dots, [], detail, 0.5, 1, 0, "open");
  kaminen(em, 0.5, 1, 1, time);
  return dots;
}

/**
 * The piece she always wears: a fine chain, and the kaminen hanging from it as
 * the pendant — tip up toward the bail, the heavy embers swinging at the bottom.
 */
function kaminenNecklace(
  em: Emit,
  cx: number,
  restY: number,
  dipY: number,
  halfWidth: number,
  h: number,
  time: number,
) {
  const chain: Pt[] = [];
  const cs = em.n(36);
  // control point placed so the curve's midpoint lands exactly on dipY
  const ctrl: Pt = [cx, 2 * dipY - restY];
  for (let i = 0; i <= cs; i++) {
    chain.push(quad(i / cs, [cx - halfWidth, restY], ctrl, [cx + halfWidth, restY]));
  }
  em.path(chain, {
    r: (t) => 0.0013 + 0.0007 * Math.sin(t * Math.PI),
    tone: (t) => 0.3 + 0.16 * Math.sin(t * Math.PI),
    a: (t) => 0.42 + 0.38 * Math.sin(t * Math.PI),
  });
  em.dot(cx, dipY - 0.005, 0.0027, 0.24, 0.85); // the bail
  kaminen(em, cx, dipY + h, h, time);
}

/* ------------------------------------------------------------------- heads */

/** The shared frontal head: high cheekbones, tapered jaw, soft chin. */
const FRONTAL_HEAD: Pt[] = [
  [0.5, 0.198],
  [0.58, 0.224],
  [0.619, 0.3],
  [0.631, 0.386],
  [0.62, 0.452],
  [0.592, 0.51],
  [0.554, 0.558],
  [0.5, 0.602],
  [0.446, 0.558],
  [0.408, 0.51],
  [0.38, 0.452],
  [0.369, 0.386],
  [0.381, 0.3],
  [0.42, 0.224],
];

const EYE_Y = 0.382;
const EYE_DX = 0.0565;
const LIP_Y = 0.527;
const JAW_Y = 0.575;

function frontalContour(em: Emit, weight = 1) {
  for (const [x, y] of spline(FRONTAL_HEAD, em.n(9), true)) {
    // heavier down the jaw, where the light falls away
    const low = Math.max(0, (y - 0.386) / 0.216);
    em.dot(
      x,
      y,
      (0.0022 + 0.0016 * low) * weight,
      0.22 + 0.42 * low,
      (0.42 + 0.34 * low) * weight,
    );
  }
}

/* ------------------------------------------------------------------- MUSE */

function buildMuse(em: Emit, time: number, lid: number) {
  const s = 1;

  hearth(em, time, 0);
  frontalContour(em);

  // sleek centre-parted hair, falling past the shoulders
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 7; k++) {
      const drift = 0.008 * Math.sin(time * 0.42 + k * 0.8 + (side === 1 ? 1.7 : 0));
      const out = 0.1 + k * 0.0155;
      const pts: Pt[] = [];
      const steps = em.n(28);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          cubic(
            i / steps,
            [CX + side * (0.01 + k * 0.007), 0.2],
            [CX + side * (0.084 + k * 0.016), 0.23],
            [CX + side * (out + drift), 0.45],
            [CX + side * (out * 0.94 + drift * 1.6), 0.7 + k * 0.022],
          ),
        );
      }
      em.path(pts, {
        r: (t) => 0.0019 + 0.0008 * (1 - t),
        tone: (t) => 0.16 + 0.64 * t,
        a: (t) => 0.3 + 0.32 * Math.sin(Math.min(1, t * 2.4) * Math.PI * 0.5) - 0.12 * t,
      });
    }
  }

  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, s, lid);
    brow(em, ex, EYE_Y, side, s);
    cheekbone(em, ex, EYE_Y, side, s);
  }

  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, s);
  lips(em, CX, LIP_Y, s, 0.038);

  // the shadow under the lower lip
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);
  em.dot(CX - 0.012, LIP_Y + 0.029, 0.0016, 0.5, 0.3);
  em.dot(CX + 0.012, LIP_Y + 0.029, 0.0016, 0.5, 0.3);

  bust(em, CX, JAW_Y, s);

  kaminenNecklace(em, CX, 0.706, 0.758, 0.082, 0.078, time);

  // a thin circlet across the forehead
  const band: Pt[] = [];
  const bs = em.n(26);
  for (let i = 0; i <= bs; i++) {
    const t = -1 + (2 * i) / bs;
    band.push([CX + t * 0.108, 0.286 + 0.02 * t * t]);
  }
  em.path(band, {
    r: (t) => 0.0012 + 0.0007 * Math.sin(t * Math.PI),
    tone: 0.24,
    a: (t) => 0.3 + 0.45 * Math.sin(t * Math.PI),
  });
  const gem = 0.5 + 0.5 * Math.sin(time * 1.3);
  em.dot(CX, 0.286, 0.0052 + 0.0018 * gem, 0.04, 0.85);
  em.dot(CX, 0.286, 0.0024, 0.36, 1);
  em.dot(CX - 0.056, 0.292, 0.0022, 0.3, 0.6);
  em.dot(CX + 0.056, 0.292, 0.0022, 0.3, 0.6);

  // one quiet implant at the temple
  const flick = 0.5 + 0.5 * Math.sin(time * 1.9);
  for (let i = 0; i < 3; i++) {
    em.line(
      0.624 + i * 0.011,
      0.344 + i * 0.004,
      0.646 + i * 0.011,
      0.324 + i * 0.004,
      0.42,
      0.12 + 0.3 * flick,
    );
  }
  em.dot(0.652, 0.316, 0.0032, 0.28, 0.55 + 0.4 * flick);

  halo(em, CX, 0.372, time, {
    radius: 0.3,
    from: Math.PI * 1.06,
    span: Math.PI * 0.88,
    count: 15,
  });
}

/* ----------------------------------------------------------------- ORACLE */

function buildOracle(em: Emit, time: number, lid: number) {
  const s = 1;
  const flick = 0.5 + 0.5 * Math.sin(time * 1.7);

  hearth(em, time, 1);
  frontalContour(em, 1.15);

  // hair swept back tight to the skull
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 6; k++) {
      const pts: Pt[] = [];
      const steps = em.n(20);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          quad(
            i / steps,
            [CX + side * (0.004 + k * 0.016), 0.2 + k * 0.004],
            [CX + side * (0.072 + k * 0.016), 0.216 + k * 0.012],
            [CX + side * (0.104 + k * 0.006), 0.322 + k * 0.026],
          ),
        );
      }
      em.path(pts, {
        r: 0.0018,
        tone: (t) => 0.12 + 0.4 * t,
        a: (t) => 0.5 - 0.18 * t,
      });
    }
  }

  // the braid: a single cable falling behind the right shoulder
  const cable: Pt[] = [];
  const cs = em.n(34);
  for (let i = 0; i <= cs; i++) {
    const t = i / cs;
    const wobble = 0.012 * Math.sin(time * 0.6 + t * 4.2);
    cable.push(
      cubic(
        t,
        [CX + 0.098, 0.36],
        [CX + 0.176 + wobble, 0.44],
        [CX + 0.156 + wobble, 0.63],
        [CX + 0.214 + wobble * 1.4, 0.83],
      ),
    );
  }
  em.path(cable, {
    r: (t) => 0.0032 - 0.0012 * t,
    tone: (t) => 0.2 + 0.68 * t,
    a: (t) => 0.7 - 0.2 * t,
  });

  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, s, lid, { lashes: side === -1 });
    brow(em, ex, EYE_Y, side, s, side === 1 ? 0.004 : 0);
    cheekbone(em, ex, EYE_Y, side, s);
  }

  // optical implant: concentric rings and a bracket over the right eye
  const ox = CX + EYE_DX;
  for (const rad of [0.031, 0.039]) {
    const count = em.n(rad > 0.035 ? 20 : 16);
    for (let i = 0; i < count; i++) {
      const th = (i / count) * TAU + time * (rad > 0.035 ? -0.18 : 0.26);
      em.dot(
        ox + Math.cos(th) * rad,
        EYE_Y + Math.sin(th) * rad * 0.86,
        0.0014 + 0.0009 * (0.5 + 0.5 * Math.sin(th * 2 + time * 2)),
        0.3,
        0.4 + 0.35 * flick,
      );
    }
  }
  em.line(ox + 0.044, EYE_Y - 0.024, ox + 0.062, EYE_Y - 0.008, 0.45, 0.45);
  em.line(ox + 0.062, EYE_Y - 0.008, ox + 0.062, EYE_Y + 0.02, 0.45, 0.45);
  em.dot(ox + 0.062, EYE_Y + 0.026, 0.0034, 0.32, 0.5 + 0.4 * flick);

  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, s);
  lips(em, CX, LIP_Y, s, 0.038);

  bust(em, CX, JAW_Y, s, { shoulder: 0.245 });

  // plate seams across the left cheek and jaw
  const nodes: Pt[] = [
    [0.414, 0.352],
    [0.392, 0.418],
    [0.428, 0.462],
    [0.404, 0.512],
    [0.446, 0.546],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 3],
  ];
  for (const [a, b] of edges) {
    em.line(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], 0.55, 0.3 + 0.35 * flick);
  }
  nodes.forEach(([x, y], i) => {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.1 - i * 0.9);
    em.dot(x, y, 0.0032 + 0.0016 * pulse, 0.3 + 0.3 * (i / nodes.length), 0.55 + 0.4 * pulse);
  });
  em.line(0.6, 0.47, 0.628, 0.424, 0.45, 0.4);
  em.line(0.566, 0.532, 0.6, 0.494, 0.45, 0.32);

  // ports along the side of the neck
  for (let i = 0; i < 3; i++) {
    const p = 0.5 + 0.5 * Math.sin(time * 2.6 - i * 1.1);
    em.dot(0.566 + i * 0.013, 0.63 + i * 0.016, 0.0028, 0.34, 0.45 + 0.45 * p);
  }

  // the same necklace, worn over the plating
  kaminenNecklace(em, CX, 0.708, 0.762, 0.084, 0.08, time);

  // the chrome ring behind the head
  const crown = em.n(46);
  for (let i = 0; i < crown; i++) {
    const th = (i / crown) * TAU;
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.4 - i * 0.28);
    em.dot(
      CX + Math.cos(th) * 0.262,
      0.372 + Math.sin(th) * 0.258,
      0.0011 + 0.0016 * pulse,
      0.26,
      0.2 + 0.35 * pulse,
    );
  }

  halo(em, CX, 0.372, time, { radius: 0.335, count: 14, a: 0.8 });
}

/* ---------------------------------------------------------------- PROFILE */

/* ---------------------------------------------------------------- SCHOLAR */

/**
 * The archivist. Same head as the muse and the oracle, but the work shows:
 * round wire spectacles, hair wound into a bun with a stylus through it, a high
 * stand collar — and a halo that is no longer a scattered constellation but an
 * ordered one, two shelves of marks with a read head sweeping them.
 */
function buildScholar(em: Emit, time: number, lid: number) {
  hearth(em, time, 2);
  frontalContour(em);

  /* -------------------------------------------------- hair, taken back up */
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 7; k++) {
      const pts: Pt[] = [];
      const steps = em.n(22);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          quad(
            i / steps,
            [CX + side * (0.004 + k * 0.014), 0.202 + k * 0.004],
            [CX + side * (0.074 + k * 0.014), 0.212 + k * 0.013],
            [CX + side * (0.11 + k * 0.006), 0.318 + k * 0.024],
          ),
        );
      }
      em.path(pts, {
        r: 0.0018,
        tone: (t) => 0.13 + 0.42 * t,
        a: (t) => 0.5 - 0.17 * t,
      });
    }
    // one strand that has escaped, because it always does
    const loose: Pt[] = [];
    const ls = em.n(18);
    for (let i = 0; i <= ls; i++) {
      const sway = 0.007 * Math.sin(time * 0.5 + (side === 1 ? 2.3 : 0));
      loose.push(
        cubic(
          i / ls,
          [CX + side * 0.104, 0.276],
          [CX + side * (0.136 + sway), 0.36],
          [CX + side * (0.118 + sway), 0.45],
          [CX + side * (0.138 + sway * 1.6), 0.53],
        ),
      );
    }
    em.path(loose, {
      r: (t) => 0.0016 - 0.0004 * t,
      tone: (t) => 0.2 + 0.56 * t,
      a: (t) => 0.42 - 0.14 * t,
    });
  }

  // the bun: a coil wound in on itself
  const coil = em.n(56);
  for (let i = 0; i < coil; i++) {
    const t = i / coil;
    const th = t * Math.PI * 5.2 + time * 0.05;
    const rad = 0.057 * (1 - t * 0.74);
    em.dot(
      CX + 0.003 + Math.cos(th) * rad,
      0.177 + Math.sin(th) * rad * 0.86,
      0.0018 + 0.0008 * (1 - t),
      0.16 + 0.5 * t,
      0.56 - 0.16 * t,
    );
  }
  // the stylus holding it
  const rod = em.n(16);
  for (let i = 0; i < rod; i++) {
    const t = i / (rod - 1);
    em.dot(CX - 0.078 + t * 0.148, 0.201 - t * 0.049, 0.0014, 0.44, 0.75);
  }
  em.dot(CX - 0.083, 0.203, 0.0038, 0.62, 0.9); // the cap
  em.dot(CX + 0.073, 0.15, 0.0016, 0.28, 0.8); // the nib

  /* ----------------------------------------------------------- the reader */
  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, 1, lid);
    brow(em, ex, EYE_Y, side, 1, 0.011, { arch: 0.9 });
    cheekbone(em, ex, EYE_Y, side, 1);
  }
  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, 1);
  lips(em, CX, LIP_Y, 1, 0.037);
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);

  /* ------------------------------------------------------- the spectacles */
  const glint = 0.34 + 0.22 * (0.5 + 0.5 * Math.sin(time * 0.8));
  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    const ring = em.n(30);
    for (let i = 0; i < ring; i++) {
      const th = (i / ring) * TAU;
      em.dot(
        ex + Math.cos(th) * 0.047,
        EYE_Y + 0.003 + Math.sin(th) * 0.04,
        0.0015,
        0.26,
        0.78,
      );
    }
    // the reflection across the upper outer quarter of the lens
    const sheen = em.n(8);
    for (let i = 0; i < sheen; i++) {
      const t = i / (sheen - 1);
      const th = Math.PI * (1.1 + t * 0.32);
      em.dot(
        ex + Math.cos(th) * 0.034 * -side,
        EYE_Y + 0.003 + Math.sin(th) * 0.029,
        0.0013,
        0.02,
        glint,
      );
    }
    // the temple arm, running back over the ear
    const arm = em.n(7);
    for (let i = 0; i < arm; i++) {
      const t = i / (arm - 1);
      em.dot(
        ex + side * (0.049 + t * 0.044),
        EYE_Y - 0.004 - t * 0.009,
        0.0014,
        0.3,
        0.62 - 0.22 * t,
      );
    }
  }
  // the bridge
  const bridge = em.n(8);
  for (let i = 0; i < bridge; i++) {
    const t = i / (bridge - 1);
    em.dot(
      CX + (t - 0.5) * 0.024,
      EYE_Y - 0.007 - 0.004 * Math.sin(t * Math.PI),
      0.0014,
      0.28,
      0.72,
    );
  }

  /* ------------------------------------------------ collar, bust, emblem */
  bust(em, CX, JAW_Y, 1, { shoulder: 0.238 });

  for (const side of [-1, 1] as const) {
    const ss = em.n(16);
    const stand: Pt[] = [];
    const placket: Pt[] = [];
    for (let i = 0; i <= ss; i++) {
      const t = i / ss;
      stand.push(quad(t, [CX + side * 0.048, 0.612], [CX + side * 0.07, 0.664], [CX + side * 0.088, 0.72]));
      placket.push(quad(t, [CX + side * 0.088, 0.72], [CX + side * 0.106, 0.762], [CX + side * 0.126, 0.812]));
    }
    em.path(stand, { r: 0.0019, tone: (t) => 0.42 + 0.2 * t, a: 0.62 });
    em.path(placket, { r: 0.0017, tone: (t) => 0.55 + 0.2 * t, a: 0.45 });
  }

  kaminenNecklace(em, CX, 0.706, 0.758, 0.08, 0.076, time);

  /* ------------------------------------------------------ the index above */
  // two shelves of marks, read left to right, over and over
  const shelves = [0.292, 0.324];
  shelves.forEach((rad, si) => {
    const slots = em.n(18);
    const head = ((time * 0.07 + si * 0.5) % 1) * (slots - 1);
    for (let i = 0; i < slots; i++) {
      const th = Math.PI * 1.04 + (i / (slots - 1)) * Math.PI * 0.92;
      const marked = (i + si * 2) % 5 === 0;
      const near = Math.max(0, 1 - Math.abs(i - head) * 0.85);
      em.dot(
        CX + Math.cos(th) * rad,
        0.372 + Math.sin(th) * rad * 0.95,
        0.0021 + (marked ? 0.0016 : 0) + 0.0026 * near,
        marked ? 0.16 : 0.48,
        0.34 + (marked ? 0.28 : 0) + 0.5 * near,
      );
    }
  });
}

/**
 * A braid, which is not a line: three strands weaving over and under. Each
 * rides the spine at its own phase and is offset along the true perpendicular,
 * so the plait holds together wherever the spine turns. Dots swell at the
 * outside of each swing, which is what makes the weave read.
 */
function braid(
  em: Emit,
  spine: Pt[],
  width: number,
  twists: number,
  opts: { tone0?: number; tone1?: number; a?: number } = {},
) {
  const n = spine.length;
  const t0 = opts.tone0 ?? 0.16;
  const t1 = opts.tone1 ?? 0.78;
  const alpha = opts.a ?? 0.58;
  for (let strand = 0; strand < 3; strand++) {
    const phase = (strand / 3) * TAU;
    for (let i = 0; i < n; i++) {
      const t = n < 2 ? 0 : i / (n - 1);
      const a = spine[Math.max(0, i - 1)];
      const b = spine[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const swing = Math.sin(t * twists * TAU + phase);
      const w = width * (1 - 0.34 * t);
      em.dot(
        spine[i][0] + (-dy / len) * swing * w,
        spine[i][1] + (dx / len) * swing * w,
        0.0027 * (0.68 + 0.32 * Math.abs(swing)) * (1 - 0.28 * t),
        t0 + (t1 - t0) * t,
        alpha - 0.12 * t,
      );
    }
  }
}

/**
 * Centre-parted, drawn down over the ears and gathered into a coil that shows
 * at the nape.
 */
function gatheredHair(em: Emit, time: number) {
  // hair: over the ear, then curving back in toward the nape
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 8; k++) {
      const drift = 0.005 * Math.sin(time * 0.36 + k * 0.7 + (side === 1 ? 1.5 : 0));
      const pts: Pt[] = [];
      const steps = em.n(26);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          cubic(
            i / steps,
            [CX + side * (0.008 + k * 0.006), 0.198],
            [CX + side * (0.1 + k * 0.012), 0.24 + k * 0.008],
            [CX + side * (0.135 + k * 0.006 + drift), 0.44 + k * 0.012],
            [CX + side * (0.078 - k * 0.004 + drift), 0.612 + k * 0.011],
          ),
        );
      }
      em.path(pts, {
        r: (t) => 0.002 + 0.0007 * (1 - t),
        tone: (t) => 0.14 + 0.5 * t,
        a: (t) => 0.46 - 0.12 * t,
      });
    }
  }
  // the gathered coil showing at the nape
  const coil = em.n(22);
  for (let i = 0; i < coil; i++) {
    const t = i / (coil - 1);
    const u = -1 + 2 * t;
    em.dot(
      CX + u * 0.104,
      0.626 + 0.03 * (1 - u * u),
      0.0026 - 0.0008 * Math.abs(u),
      0.4 + 0.24 * Math.abs(u),
      0.5,
    );
  }
}

/* ----------------------------------------------------------------- WRITER */

/**
 * Centre-parted hair drawn down over the ears and gathered low at the nape, a
 * pen kept behind one ear, and a mantle over the shoulders. Her halo is a
 * chronology: one arc, marked at uneven intervals, because history is lumpy —
 * clusters where everything happened at once, and long quiet gaps.
 */
function buildWriter(em: Emit, time: number, lid: number) {
  hearth(em, time, 3);
  frontalContour(em);

  gatheredHair(em, time);

  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, 1, lid);
    brow(em, ex, EYE_Y, side, 1, 0.006, { arch: 1.05 });
    cheekbone(em, ex, EYE_Y, side, 1);
  }
  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, 1);
  lips(em, CX, LIP_Y, 1, 0.038);
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);

  // the pen kept behind her ear
  const pen = em.n(16);
  for (let i = 0; i < pen; i++) {
    const t = i / (pen - 1);
    em.dot(0.646 + t * 0.042, 0.428 - t * 0.094, 0.0021, 0.42, 0.85);
  }
  em.dot(0.643, 0.437, 0.0034, 0.7, 0.9); // the nib
  em.dot(0.691, 0.329, 0.0028, 0.28, 0.8); // the cap

  // strata: a short column of ticks at the other temple
  for (let i = 0; i < em.n(6); i++) {
    const t = i / 5;
    em.line(0.352 - t * 0.012, 0.35 + t * 0.03, 0.372 - t * 0.012, 0.35 + t * 0.03, 0.45, 0.22 + 0.12 * t);
  }

  bust(em, CX, JAW_Y, 1, { shoulder: 0.242 });

  // a mantle over the shoulders, with its fold
  for (const side of [-1, 1] as const) {
    for (const off of [0, 0.022]) {
      const drape: Pt[] = [];
      const ds = em.n(20);
      for (let i = 0; i <= ds; i++) {
        drape.push(
          quad(
            i / ds,
            [CX + side * (0.212 - off * 0.4), 0.83],
            [CX + side * (0.13 - off * 0.5), 0.772 + off],
            [CX + side * 0.034, 0.862 + off],
          ),
        );
      }
      em.path(drape, {
        r: off ? 0.0016 : 0.0024,
        tone: (t) => 0.55 + 0.24 * t,
        a: off ? 0.38 : 0.72,
      });
    }
  }

  kaminenNecklace(em, CX, 0.706, 0.758, 0.08, 0.076, time);

  /* ------------------------------------------------------ the chronology */
  // uneven on purpose: dense where things happened, empty where they did not
  const events = [
    0.01, 0.04, 0.06, 0.155, 0.175, 0.19, 0.205, 0.34, 0.455,
    0.485, 0.5, 0.515, 0.63, 0.745, 0.765, 0.78, 0.795, 0.875, 0.96,
  ];
  const from = Math.PI * 1.05;
  const span = Math.PI * 0.9;
  const rad = 0.302;
  const at = (u: number): Pt => {
    const th = from + u * span;
    return [CX + Math.cos(th) * rad, 0.372 + Math.sin(th) * rad * 0.95];
  };
  for (let i = 0; i < events.length - 1; i++) {
    const [x1, y1] = at(events[i]);
    const [x2, y2] = at(events[i + 1]);
    em.line(x1, y1, x2, y2, 0.5, 0.14);
  }
  events.forEach((u, i) => {
    const [x, y] = at(u);
    const epoch = i % 6 === 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.8 - i * 0.7);
    em.dot(x, y, epoch ? 0.0036 : 0.0019, epoch ? 0.18 : 0.5, 0.35 + (epoch ? 0.3 : 0.1) + 0.2 * pulse);
  });
}

/* -------------------------------------------------------------- SCIENTIST */

/**
 * Hair tied back out of the way, a coat with notched lapels, and a graduated
 * scale running up beside her. The halo is three tilted orbits rather than a
 * constellation — they pass in front of her and behind her, which is the point.
 */
function buildScientist(em: Emit, time: number, lid: number) {
  hearth(em, time, 4);

  // the orbits go down first, so she stands inside them
  for (let o = 0; o < 3; o++) {
    const tilt = (o / 3) * Math.PI + 0.22;
    const n = em.n(34);
    const dir = o % 2 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU + time * 0.1 * dir;
      const lx = Math.cos(th) * 0.325;
      const ly = Math.sin(th) * 0.106;
      em.dot(
        CX + lx * Math.cos(tilt) - ly * Math.sin(tilt),
        0.4 + lx * Math.sin(tilt) + ly * Math.cos(tilt),
        0.0018,
        0.3 + 0.16 * o,
        0.3 + 0.28 * (0.5 + 0.5 * Math.sin(th * 2 + time + o)),
      );
    }
  }

  frontalContour(em);

  // hair taken back and tied, with a short tail
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 6; k++) {
      const pts: Pt[] = [];
      const steps = em.n(20);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          quad(
            i / steps,
            [CX + side * (0.004 + k * 0.016), 0.2 + k * 0.004],
            [CX + side * (0.076 + k * 0.016), 0.214 + k * 0.013],
            [CX + side * (0.086 + k * 0.004), 0.33 + k * 0.022],
          ),
        );
      }
      em.path(pts, { r: 0.0018, tone: (t) => 0.12 + 0.42 * t, a: (t) => 0.5 - 0.16 * t });
    }
  }
  const tie = em.n(9);
  for (let i = 0; i < tie; i++) {
    const t = i / (tie - 1);
    em.dot(CX - 0.03 + t * 0.06, 0.612 + 0.012 * Math.sin(t * Math.PI), 0.0024, 0.46, 0.6);
  }
  const tail: Pt[] = [];
  const ts = em.n(20);
  for (let i = 0; i <= ts; i++) {
    const sway = 0.01 * Math.sin(time * 0.5);
    tail.push(quad(i / ts, [CX, 0.626], [CX + 0.026 + sway, 0.69], [CX + 0.012 + sway, 0.752]));
  }
  em.path(tail, { r: (t) => 0.0028 - 0.001 * t, tone: (t) => 0.3 + 0.5 * t, a: 0.5 });

  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, 1, lid);
    brow(em, ex, EYE_Y, side, 1, 0.008, { arch: 0.7, weight: 1.05 });
    cheekbone(em, ex, EYE_Y, side, 1);
  }
  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, 1);
  lips(em, CX, LIP_Y, 1, 0.037);
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);

  bust(em, CX, JAW_Y, 1, { shoulder: 0.246 });

  // the coat: notched lapels and two buttons
  for (const side of [-1, 1] as const) {
    const lapel: Pt[] = [];
    const ls = em.n(18);
    for (let i = 0; i <= ls; i++) {
      lapel.push(quad(i / ls, [CX + side * 0.058, 0.708], [CX + side * 0.112, 0.78], [CX + side * 0.064, 0.872]));
    }
    em.path(lapel, { r: 0.0018, tone: (t) => 0.5 + 0.26 * t, a: 0.55 });
    em.line(CX + side * 0.112, 0.776, CX + side * 0.156, 0.752, 0.5, 0.35);
  }
  em.dot(CX, 0.812, 0.0024, 0.4, 0.6);
  em.dot(CX, 0.858, 0.0024, 0.4, 0.6);

  kaminenNecklace(em, CX, 0.7, 0.754, 0.072, 0.072, time);

  // a graduated scale beside her, longer every fifth
  const ticks = em.n(24);
  for (let i = 0; i < ticks; i++) {
    const t = i / (ticks - 1);
    const major = i % 5 === 0;
    const y = 0.28 + t * 0.38;
    em.line(0.298, y, 0.298 + (major ? 0.026 : 0.014), y, 0.44, major ? 0.42 : 0.24);
  }
  em.line(0.298, 0.28, 0.298, 0.66, 0.44, 0.3);
  // the reading
  const read = 0.28 + ((time * 0.06) % 1) * 0.38;
  em.dot(0.298, read, 0.0032, 0.2, 0.9);
}

/* ------------------------------------------------------------- CHRONICLER */

/**
 * The other one who writes, and the difference is the hair: long loose waves rather
 * than anything gathered, with one thick braid brought forward over the
 * shoulder. Her halo is deep time instead of a timeline — nested strata, coarse
 * bands over fine ones, the way sediment actually stacks.
 */
function buildChronicler(em: Emit, time: number, lid: number) {
  hearth(em, time, 5);
  frontalContour(em);

  // long waves: a smooth fall with an undulation that grows as it descends
  for (const side of [-1, 1] as const) {
    // the braid side is swept back and gathered, so only the free side falls
    const gathered = side === 1;
    const strands = gathered ? 6 : 9;
    for (let k = 0; k < strands; k++) {
      const phase = k * 0.82 + (gathered ? 1.4 : 0);
      const out = gathered ? 0.098 + k * 0.008 : 0.104 + k * 0.014;
      const pts: Pt[] = [];
      const steps = em.n(30);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [bx, by] = cubic(
          t,
          [CX + side * (0.01 + k * 0.006), 0.198],
          [CX + side * (0.086 + k * 0.014), 0.232],
          [CX + side * out, gathered ? 0.38 : 0.46],
          [CX + side * (out * (gathered ? 1.06 : 0.96)), gathered ? 0.5 + k * 0.006 : 0.74 + k * 0.018],
        );
        const wave =
          (gathered ? 0.006 : 0.019) *
          Math.sin(t * 5.1 + phase + time * 0.22) *
          Math.min(1, t * 2.1);
        pts.push([bx + side * wave, by + wave * 0.25]);
      }
      em.path(pts, {
        r: (t) => 0.002 + 0.0008 * (1 - t),
        tone: (t) => 0.14 + 0.64 * t,
        a: (t) => 0.3 + 0.3 * Math.sin(Math.min(1, t * 2.4) * Math.PI * 0.5) - 0.1 * t,
      });
    }
  }

  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, 1, lid);
    brow(em, ex, EYE_Y, side, 1, 0.005, { arch: 1.1 });
    cheekbone(em, ex, EYE_Y, side, 1);
  }
  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, 1);
  lips(em, CX, LIP_Y, 1, 0.038);
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);

  bust(em, CX, JAW_Y, 1, { shoulder: 0.24 });
  kaminenNecklace(em, CX, 0.704, 0.756, 0.078, 0.074, time);

  // the braid, brought forward over her shoulder
  const spine: Pt[] = [];
  const bs = em.n(40);
  for (let i = 0; i <= bs; i++) {
    const t = i / bs;
    const sway = 0.008 * Math.sin(time * 0.3 + t * 2.2);
    spine.push(
      cubic(
        t,
        [CX + 0.118, 0.5],
        [CX + 0.182 + sway, 0.618],
        [CX + 0.158 + sway, 0.772],
        [CX + 0.122 + sway * 1.4, 0.886],
      ),
    );
  }
  braid(em, spine, 0.019, 3.4, { tone0: 0.34, tone1: 0.84, a: 0.8 });
  // the tie
  const tail = spine[spine.length - 1];
  for (let i = 0; i < em.n(5); i++) {
    const t = i / 4;
    em.dot(tail[0] - 0.012 + t * 0.024, tail[1] + 0.006, 0.0022, 0.6, 0.75);
  }

  /* --------------------------------------------------------- deep time */
  // nested strata: coarse bands over fine ones, thickness varying by layer
  const beds = [
    { rad: 0.262, step: 8, r: 0.0042, tone: 0.76, a: 0.66 },
    { rad: 0.29, step: 26, r: 0.0014, tone: 0.5, a: 0.5 },
    { rad: 0.312, step: 12, r: 0.003, tone: 0.34, a: 0.66 },
    { rad: 0.338, step: 34, r: 0.0012, tone: 0.24, a: 0.44 },
    { rad: 0.356, step: 6, r: 0.0046, tone: 0.12, a: 0.6 },
  ];
  const from = Math.PI * 1.23;
  const span = Math.PI * 0.54;
  for (const bed of beds) {
    const marks = em.n(bed.step);
    for (let i = 0; i <= marks; i++) {
      const th = from + (i / marks) * span;
      const shimmer = 0.5 + 0.5 * Math.sin(time * 0.5 + i * 0.6 + bed.rad * 40);
      em.dot(
        CX + Math.cos(th) * bed.rad,
        0.372 + Math.sin(th) * bed.rad * 0.95,
        bed.r,
        bed.tone,
        bed.a * (0.7 + 0.3 * shimmer),
      );
    }
  }
}

/**
 * Cloth: a garment edge with folds hanging off it.
 *
 * The folds must hang *downward* from the edge, not run parallel to it — a run
 * of parallel strokes reads as a fan or a wing, never as wool. Lengths vary so
 * the hem does not come out level.
 */
function drape(
  em: Emit,
  from: Pt,
  to: Pt,
  count: number,
  opts: { bow?: number; drop?: number; tone0?: number; tone1?: number; a?: number } = {},
) {
  const bow = opts.bow ?? 0.02;
  const drop = opts.drop ?? 0.085;
  const t0 = opts.tone0 ?? 0.46;
  const t1 = opts.tone1 ?? 0.84;
  const alpha = opts.a ?? 0.6;
  const mid: Pt = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + bow];

  // the edge itself, the heaviest line in the garment
  const edge: Pt[] = [];
  const es = em.n(30);
  for (let i = 0; i <= es; i++) edge.push(quad(i / es, from, mid, to));
  em.path(edge, {
    r: (t) => 0.0024 * (0.8 + 0.3 * Math.sin(t * Math.PI)),
    tone: (t) => t0 + (t1 - t0) * t,
    a: alpha,
  });

  // folds hanging from it
  for (let f = 0; f < count; f++) {
    const u = (f + 0.5) / count;
    const [ax, ay] = quad(u, from, mid, to);
    const len = drop * (0.45 + 0.55 * Math.sin(u * 2.9 + 0.7) ** 2);
    const lean = 0.018 * Math.sin(u * 4.1);
    const pts: Pt[] = [];
    const steps = em.n(14);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([ax + lean * t + 0.008 * t * t, ay + len * t]);
    }
    em.path(pts, {
      r: (t) => 0.0017 * (1 - 0.3 * t),
      tone: (t) => t0 + 0.16 + (t1 - t0) * t,
      a: (t) => alpha * 0.8 * (1 - 0.55 * t),
    });
  }
}

/** A rectangular lens: four straight runs, which is the whole point of it. */
function rectLens(em: Emit, cx: number, cy: number, w: number, h: number, count: number) {
  const n = em.n(count);
  const per = 2 * (w + h);
  for (let i = 0; i < n; i++) {
    const d = (i / n) * per;
    let x: number;
    let y: number;
    if (d < w) {
      x = cx - w / 2 + d;
      y = cy - h / 2;
    } else if (d < w + h) {
      x = cx + w / 2;
      y = cy - h / 2 + (d - w);
    } else if (d < 2 * w + h) {
      x = cx + w / 2 - (d - w - h);
      y = cy + h / 2;
    } else {
      x = cx - w / 2;
      y = cy + h / 2 - (d - 2 * w - h);
    }
    em.dot(x, y, 0.0015, 0.26, 0.8);
  }
}

/* ------------------------------------------------------------ PHILOSOPHER */

/**
 * Philosopher of mind, and the argument is in how she is drawn rather than in
 * anything she wears.
 *
 * The same contour is rendered two ways down the midline: fine stippling on one
 * side, coarse heavy marks on the other. Identical geometry, two descriptions
 * that will not reduce to each other — which is the problem she works on.
 *
 * Her halo is the explanatory gap: a ring that crowds denser and brighter the
 * closer it gets to the break at the top, and then simply stops. The nearer you
 * come, the more there is to say, and then nothing.
 */
function dualContour(em: Emit) {
  const pts = spline(FRONTAL_HEAD, em.n(17), true);
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const low = Math.max(0, (y - 0.386) / 0.216);
    if (x < CX) {
      em.dot(x, y, 0.0013 + 0.0009 * low, 0.24 + 0.4 * low, 0.46 + 0.3 * low);
    } else if (i % 3 === 0) {
      em.dot(x, y, 0.0029 + 0.0015 * low, 0.24 + 0.4 * low, 0.52 + 0.3 * low);
    }
  }
}

function buildPhilosopher(em: Emit, time: number, lid: number) {
  hearth(em, time, 6);
  dualContour(em);

  // a short crop, and it takes the split too: many fine strands on one side,
  // few heavy ones on the other
  for (const side of [-1, 1] as const) {
    const fine = side === -1;
    const strands = fine ? 13 : 5;
    for (let k = 0; k < strands; k++) {
      const u = strands < 2 ? 0 : k / (strands - 1);
      const tousle = 0.007 * Math.sin(time * 0.4 + k * 1.3 + (fine ? 0 : 2.1));
      const pts: Pt[] = [];
      const steps = em.n(18);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          cubic(
            i / steps,
            [CX + side * (0.006 + u * 0.05), 0.196 + u * 0.006],
            [CX + side * (0.07 + u * 0.05), 0.212 + u * 0.03],
            [CX + side * (0.116 + u * 0.024 + tousle), 0.318 + u * 0.05],
            [CX + side * (0.104 + u * 0.03 + tousle * 1.6), 0.44 + u * 0.03],
          ),
        );
      }
      em.path(pts, {
        r: fine ? 0.0015 : 0.0032,
        tone: (t) => 0.14 + 0.48 * t,
        a: (t) => (fine ? 0.42 : 0.5) - 0.14 * t,
      });
    }
  }

  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, 1, lid);
    brow(em, ex, EYE_Y, side, 1, 0.007, { arch: 0.95 });
    cheekbone(em, ex, EYE_Y, side, 1);
  }
  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, 1);
  lips(em, CX, LIP_Y, 1, 0.037);
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);

  bust(em, CX, JAW_Y, 1, { shoulder: 0.236 });
  kaminenNecklace(em, CX, 0.704, 0.756, 0.078, 0.074, time);

  /* ------------------------------------------------- the explanatory gap */
  const GAP = 0.33; // radians: half the width of the break
  const REACH = Math.PI * 0.86;
  const rad = 0.302;
  const at = (side: number, u: number): Pt => {
    // crowds toward the break rather than spacing evenly around the ring
    const off = GAP + Math.pow(1 - u, 1.7) * (REACH - GAP);
    const th = -Math.PI / 2 + side * off;
    return [CX + Math.cos(th) * rad, 0.372 + Math.sin(th) * rad * 0.95];
  };
  for (const side of [-1, 1] as const) {
    const n = em.n(22);
    let prev: Pt | null = null;
    for (let i = 0; i < n; i++) {
      const u = n < 2 ? 0 : i / (n - 1);
      const [x, y] = at(side, u);
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.7 - u * 4 + side);
      if (prev) em.line(prev[0], prev[1], x, y, 0.5, 0.1 + 0.12 * u);
      em.dot(
        x,
        y,
        0.0012 + 0.0034 * Math.pow(u, 1.4),
        0.62 - 0.46 * u,
        0.26 + 0.5 * u * (0.7 + 0.3 * pulse),
      );
      prev = [x, y];
    }
  }
}

/* ---------------------------------------------------------------- SOCRATIC */

/** Shared face for the three philosophers, so only the argument differs. */
function philosopherFace(em: Emit, lid: number, browLift = 0.007, arch = 0.95) {
  for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    almondEye(em, ex, EYE_Y, side, 1, lid);
    brow(em, ex, EYE_Y, side, 1, browLift, { arch });
    cheekbone(em, ex, EYE_Y, side, 1);
  }
  nose(em, CX, EYE_Y + 0.012, EYE_Y + 0.094, 1);
  lips(em, CX, LIP_Y, 1, 0.037);
  em.dot(CX, LIP_Y + 0.031, 0.0022, 0.55, 0.4);
}

/**
 * A himation worn the old way: over one shoulder, across the chest, gathered
 * under the far arm, leaving the other shoulder bare. Hair in loose classical
 * waves under a taenia — the plain band, not a wreath.
 *
 * Her halo is the ascent: marks that start irregular and dim low down and grow
 * purer and more evenly spaced the higher they go.
 */
function buildSocratic(em: Emit, time: number, lid: number) {
  hearth(em, time, 7);
  frontalContour(em);

  // loose classical waves, shorter than the muse's fall
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 8; k++) {
      const phase = k * 0.9 + (side === 1 ? 1.6 : 0);
      const out = 0.1 + k * 0.012;
      const pts: Pt[] = [];
      const steps = em.n(26);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [bx, by] = cubic(
          t,
          [CX + side * (0.01 + k * 0.006), 0.198],
          [CX + side * (0.084 + k * 0.012), 0.23],
          [CX + side * out, 0.42],
          [CX + side * (out * 0.94), 0.6 + k * 0.012],
        );
        const wave = 0.015 * Math.sin(t * 4.4 + phase + time * 0.2) * Math.min(1, t * 2);
        pts.push([bx + side * wave, by + wave * 0.2]);
      }
      em.path(pts, {
        r: (t) => 0.002 + 0.0007 * (1 - t),
        tone: (t) => 0.15 + 0.6 * t,
        a: (t) => 0.34 + 0.24 * Math.sin(Math.min(1, t * 2.4) * Math.PI * 0.5) - 0.1 * t,
      });
    }
  }

  // the taenia: a plain band round the head
  const band: Pt[] = [];
  const bs = em.n(28);
  for (let i = 0; i <= bs; i++) {
    const t = -1 + (2 * i) / bs;
    band.push([CX + t * 0.118, 0.276 + 0.03 * t * t]);
  }
  em.path(band, {
    r: (t) => 0.0016 + 0.0008 * Math.sin(t * Math.PI),
    tone: 0.28,
    a: (t) => 0.4 + 0.4 * Math.sin(t * Math.PI),
  });

  philosopherFace(em, lid, 0.007, 1.05);
  bust(em, CX, JAW_Y, 1, { shoulder: 0.244 });

  // the himation: bare on one shoulder, gathered under the far arm
  drape(em, [CX - 0.172, 0.698], [CX + 0.176, 0.83], em.n(18), {
    bow: 0.026,
    drop: 0.16,
    tone0: 0.4,
    tone1: 0.84,
    a: 0.88,
  });
  // the gather at the shoulder
  for (let i = 0; i < em.n(7); i++) {
    const t = i / 6;
    em.dot(CX - 0.178 + t * 0.03, 0.69 + t * 0.026, 0.003 - t * 0.0008, 0.38 + t * 0.2, 0.8);
  }

  kaminenNecklace(em, CX, 0.678, 0.724, 0.068, 0.062, time);

  /* ------------------------------------------------------------ the ascent */
  // irregular and dim below, even and pure above
  const rungs = em.n(26);
  for (let i = 0; i < rungs; i++) {
    const u = i / (rungs - 1); // 0 at the bottom of the arc, 1 at the top
    const jitter = (1 - u) * 0.02 * Math.sin(i * 33.7);
    const th = Math.PI * (1.06 + u * 0.88);
    const rad = 0.302 + jitter;
    em.dot(
      CX + Math.cos(th) * rad,
      0.372 + Math.sin(th) * rad * 0.95,
      0.0014 + 0.0022 * u,
      0.72 - 0.66 * u,
      0.22 + 0.6 * u,
    );
  }
}

/* ------------------------------------------------------------------ STOIC */

/**
 * A toga, which is the heavier garment: the sinus swagged across the chest in
 * nested folds and the band carried over the shoulder. Hair cropped short in
 * the Roman way.
 *
 * Her halo is the dichotomy of control — an inner ring, dense and evenly lit,
 * and an outer one that is sparse and dim and has nothing to do with her.
 */
function buildStoic(em: Emit, time: number, lid: number) {
  hearth(em, time, 8);
  frontalContour(em);

  // a short Roman crop
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 10; k++) {
      const u = k / 9;
      const curl = 0.006 * Math.sin(time * 0.35 + k * 1.6 + (side === 1 ? 1.8 : 0));
      const pts: Pt[] = [];
      const steps = em.n(16);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          cubic(
            i / steps,
            [CX + side * (0.002 + u * 0.05), 0.19 + u * 0.006],
            [CX + side * (0.06 + u * 0.056), 0.2 + u * 0.036],
            [CX + side * (0.116 + u * 0.018 + curl), 0.296 + u * 0.046],
            [CX + side * (0.106 + u * 0.022 + curl * 1.5), 0.386 + u * 0.028],
          ),
        );
      }
      em.path(pts, {
        r: 0.0021,
        tone: (t) => 0.13 + 0.44 * t,
        a: (t) => 0.46 - 0.14 * t,
      });
    }
  }

  philosopherFace(em, lid, 0.004, 0.55);
  bust(em, CX, JAW_Y, 1, { shoulder: 0.25 });

  // the sinus: nested swags across the chest
  for (let f = 0; f < 3; f++) {
    const d = f * 0.032;
    const pts: Pt[] = [];
    const steps = em.n(22);
    for (let i = 0; i <= steps; i++) {
      pts.push(
        quad(
          i / steps,
          [CX - 0.172 - d * 0.18, 0.714 + d * 0.28],
          [CX - 0.004, 0.814 + d],
          [CX + 0.172 + d * 0.18, 0.714 + d * 0.28],
        ),
      );
    }
    em.path(pts, {
      r: (t) => (0.0031 - f * 0.0005) * (0.8 + 0.3 * Math.sin(t * Math.PI)),
      tone: (t) => 0.42 + 0.3 * Math.sin(t * Math.PI),
      a: 0.88 - f * 0.22,
    });
  }
  // the fabric falling from under the lowest swag
  const hangs = em.n(16);
  for (let i = 0; i < hangs; i++) {
    const u = (i + 0.5) / hangs;
    const t = -1 + 2 * u;
    const ax = CX + t * 0.196;
    const ay = 0.75 + 0.098 * (1 - t * t) + 0.064;
    const len = 0.1 * (0.5 + 0.5 * Math.sin(u * 5.2 + 0.6) ** 2);
    const pts: Pt[] = [];
    const steps = em.n(12);
    for (let j = 0; j <= steps; j++) {
      const q = j / steps;
      pts.push([ax + t * 0.014 * q, ay + len * q]);
    }
    em.path(pts, {
      r: (q) => 0.0019 * (1 - 0.3 * q),
      tone: (q) => 0.58 + 0.28 * q,
      a: (q) => 0.62 * (1 - 0.5 * q),
    });
  }

  // the band carried over the shoulder
  drape(em, [CX - 0.17, 0.688], [CX - 0.04, 0.796], em.n(5), {
    bow: 0.014,
    drop: 0.062,
    tone0: 0.38,
    tone1: 0.72,
    a: 0.78,
  });

  kaminenNecklace(em, CX, 0.674, 0.718, 0.064, 0.06, time);

  /* ------------------------------------------- what is and is not up to her */
  const inner = em.n(22);
  for (let i = 0; i < inner; i++) {
    const th = (i / inner) * TAU + time * 0.05;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.9 - i * 0.4);
    em.dot(
      CX + Math.cos(th) * 0.212,
      0.372 + Math.sin(th) * 0.212 * 0.95,
      0.0022 + 0.0008 * pulse,
      0.3,
      0.55 + 0.25 * pulse,
    );
  }
  const outer = em.n(16);
  for (let i = 0; i < outer; i++) {
    const th = (i / outer) * TAU - time * 0.02 + 0.2;
    const drift = 0.02 * Math.sin(time * 0.4 + i * 2.1);
    em.dot(
      CX + Math.cos(th) * (0.335 + drift),
      0.372 + Math.sin(th) * (0.335 + drift) * 0.95,
      0.0013,
      0.66,
      0.16,
    );
  }
}

/* --------------------------------------------------------------- ANALYTIC */

/**
 * The contemporary one. Rectangular frames — deliberately not the archivist's
 * round wire — a plain crew-neck, and hair pushed back out of the way.
 *
 * Her halo is a proof: a root that branches down and outward, each node
 * splitting into two, thinning as it descends.
 */
function buildAnalytic(
  em: Emit,
  time: number,
  lid: number,
  opts: { hair?: "own" | "gathered"; glasses?: boolean } = {},
) {
  const glasses = opts.glasses ?? true;
  const gathered = opts.hair === "gathered";
  hearth(em, time, 9);
  frontalContour(em);

  // pushed back, falling to the jaw
  if (gathered) gatheredHair(em, time);
  else for (const side of [-1, 1] as const) {
    for (let k = 0; k < 9; k++) {
      const u = k / 8;
      const drift = 0.005 * Math.sin(time * 0.38 + k * 0.8 + (side === 1 ? 1.3 : 0));
      const pts: Pt[] = [];
      const steps = em.n(22);
      for (let i = 0; i <= steps; i++) {
        pts.push(
          cubic(
            i / steps,
            [CX + side * (0.006 + u * 0.04), 0.196],
            [CX + side * (0.082 + u * 0.04), 0.216 + u * 0.02],
            [CX + side * (0.128 + u * 0.016 + drift), 0.36 + u * 0.04],
            [CX + side * (0.116 + u * 0.026 + drift), 0.56 + u * 0.046],
          ),
        );
      }
      em.path(pts, {
        r: 0.0019,
        tone: (t) => 0.14 + 0.54 * t,
        a: (t) => 0.42 - 0.13 * t,
      });
    }
  }

  philosopherFace(em, lid, glasses ? 0.012 : 0.007, glasses ? 0.8 : 0.95);

  // rectangular frames
  if (glasses) for (const side of [-1, 1] as const) {
    const ex = CX + side * EYE_DX;
    rectLens(em, ex, EYE_Y + 0.001, 0.088, 0.05, 34);
    const arm = em.n(7);
    for (let i = 0; i < arm; i++) {
      const t = i / (arm - 1);
      em.dot(
        ex + side * (0.046 + t * 0.046),
        EYE_Y - 0.022 - t * 0.006,
        0.0015,
        0.3,
        0.6 - 0.2 * t,
      );
    }
  }
  if (glasses) {
    const bridge = em.n(7);
    for (let i = 0; i < bridge; i++) {
      const t = i / (bridge - 1);
      em.dot(CX + (t - 0.5) * 0.026, EYE_Y + 0.001, 0.0015, 0.28, 0.72);
    }
  }

  bust(em, CX, JAW_Y, 1, { shoulder: 0.238 });
  // a plain crew neck
  const neck: Pt[] = [];
  const ns = em.n(24);
  for (let i = 0; i <= ns; i++) {
    const t = -1 + (2 * i) / ns;
    neck.push([CX + t * 0.116, 0.742 + 0.042 * (1 - t * t)]);
  }
  em.path(neck, { r: 0.0019, tone: 0.56, a: (t) => 0.3 + 0.35 * Math.sin(t * Math.PI) });

  kaminenNecklace(em, CX, 0.716, 0.772, 0.074, 0.072, time);

  /* ----------------------------------------------------------- the proof */
  const root: Pt = [CX, 0.1];
  const draw = (p: Pt, depth: number, angle: number, len: number) => {
    if (depth > 3) return;
    const q: Pt = [p[0] + Math.sin(angle) * len, p[1] + Math.cos(angle) * len * 0.62];
    em.line(p[0], p[1], q[0], q[1], 0.5, 0.3 - depth * 0.05);
    const lit = 0.5 + 0.5 * Math.sin(time * 0.8 - depth * 1.2 - angle * 2);
    em.dot(q[0], q[1], 0.0028 - depth * 0.0005, 0.2 + depth * 0.14, 0.4 + 0.3 * lit);
    draw(q, depth + 1, angle - 0.52, len * 0.72);
    draw(q, depth + 1, angle + 0.52, len * 0.72);
  };
  em.dot(root[0], root[1], 0.0034, 0.14, 0.75);
  draw(root, 0, -0.62, 0.115);
  draw(root, 0, 0.62, 0.115);
}

/* ---------------------------------------------------------------- dispatch */

/**
 * Build a portrait for a given moment.
 * @param time seconds
 * @param detail 1 = full canvas density, lower for the coarse ASCII grid
 */
export function buildPortrait(
  time: number,
  detail = 1,
  variant: Variant = "muse",
  style: Style = "open",
): Portrait {
  const dots: Dot[] = [];
  const lines: Line[] = [];

  const breath = 1 + 0.008 * Math.sin(time * 0.62);
  const sway = 0.0035 * Math.sin(time * 0.33);

  // blink: a quick squash roughly every 5.2 seconds
  const phase = (time % 5.2) / 5.2;
  const blink = phase > 0.94 ? Math.abs(Math.sin((phase - 0.94) * (Math.PI / 0.06))) : 0;
  const lid = 1 - 0.94 * blink;

  const em = makeEmitter(dots, lines, detail, 0.41, breath, sway, style);

  if (variant === "oracle") buildOracle(em, time, lid);
  else if (variant === "scholar") buildScholar(em, time, lid);
  else if (variant === "writer") buildWriter(em, time, lid);
  else if (variant === "chronicler") buildChronicler(em, time, lid);
  else if (variant === "philosopher") buildPhilosopher(em, time, lid);
  else if (variant === "socratic") buildSocratic(em, time, lid);
  else if (variant === "stoic") buildStoic(em, time, lid);
  else if (variant === "analytic") buildAnalytic(em, time, lid);
  else if (variant === "researcher")
    buildAnalytic(em, time, lid, { hair: "gathered", glasses: false });
  else if (variant === "scientist") buildScientist(em, time, lid);
  else buildMuse(em, time, lid);

  return { dots, lines };
}
