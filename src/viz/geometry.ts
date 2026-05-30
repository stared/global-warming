import type { Extents, LayoutKind, Point } from "../data/types";

export interface Dims {
  width: number;
  height: number;
}

/** Per-point render geometry. (x, y) is the rect's top-left corner. */
export interface Geom {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  fill: string;
  opacity: number;
}

export const M = { top: 36, right: 28, bottom: 42, left: 56 };
export const DOT = 3.6;
const TWO_PI = Math.PI * 2;

// --- Shared scales (single source of truth for geometry AND overlays) ---

export function timeX(dims: Dims, ext: Extents) {
  const plotW = dims.width - M.left - M.right;
  const [t0, t1] = ext.t;
  const span = t1 - t0 || 1;
  return (t: number) => M.left + ((t - t0) / span) * plotW;
}

export function valueY(dims: Dims, ext: Extents) {
  const pad = (ext.value[1] - ext.value[0]) * 0.08 || 0.1;
  const lo = ext.value[0] - pad;
  const hi = ext.value[1] + pad;
  const span = hi - lo || 1;
  const top = M.top;
  const bottom = dims.height - M.bottom;
  const scale = (v: number) => bottom - ((v - lo) / span) * (bottom - top);
  return { scale, lo, hi };
}

const monthAngle = (month: number) => -Math.PI / 2 + ((month - 1) / 12) * TWO_PI;

export function spiralFns(dims: Dims, ext: Extents) {
  const cx = dims.width / 2;
  const cy = dims.height / 2;
  const maxR = Math.min(dims.width, dims.height) / 2 - 48;
  const innerR = maxR * 0.16;
  const lo = ext.value[0] - 0.05;
  const hi = ext.value[1] + 0.05;
  const span = hi - lo || 1;
  const r = (v: number) => innerR + ((v - lo) / span) * (maxR - innerR);
  return { cx, cy, maxR, innerR, r, angle: monthAngle, valueAt: (rr: number) => lo + ((rr - innerR) / (maxR - innerR)) * span };
}

// --- The morph target: one Geom per point for a given layout ---

export function computeGeometry(
  layout: LayoutKind,
  points: Point[],
  dims: Dims,
  ext: Extents,
  color: (v: number) => string,
  revealT: number,
): Geom[] {
  const vis = (p: Point) => (p.t <= revealT + 1e-9 ? 1 : 0);

  if (layout === "line") {
    const x = timeX(dims, ext);
    const { scale: y } = valueY(dims, ext);
    return points.map((p) => ({
      x: x(p.t) - DOT / 2,
      y: y(p.value) - DOT / 2,
      w: DOT,
      h: DOT,
      rx: DOT / 2,
      fill: color(p.value),
      opacity: vis(p),
    }));
  }

  if (layout === "stripes") {
    const x = timeX(dims, ext);
    const plotW = dims.width - M.left - M.right;
    const bw = Math.max(plotW / Math.max(points.length - 1, 1), 0.8) * 1.08;
    const top = M.top;
    const sh = dims.height - M.top - M.bottom;
    return points.map((p) => ({
      x: x(p.t) - bw / 2,
      y: top,
      w: bw,
      h: sh,
      rx: 0,
      fill: color(p.value),
      opacity: vis(p),
    }));
  }

  // spiral: angle = month, radius = anomaly
  const { cx, cy, r, angle } = spiralFns(dims, ext);
  return points.map((p) => {
    const a = angle(p.month);
    const rr = r(p.value);
    return {
      x: cx + rr * Math.cos(a) - DOT / 2,
      y: cy + rr * Math.sin(a) - DOT / 2,
      w: DOT,
      h: DOT,
      rx: DOT / 2,
      fill: color(p.value),
      opacity: vis(p),
    };
  });
}
