export interface RawPoint {
  year: number;
  month: number;
  value: number; // °C anomaly vs 1951-1980
}

export interface SourceData {
  label: string;
  url: string;
  homepage: string;
  count: number;
  points: RawPoint[];
}

export interface ClimateData {
  generated: string;
  baseline: string;
  unit: string;
  sourceOrder: string[];
  errors: string[];
  sources: Record<string, SourceData>;
}

export type LayoutKind = "spiral" | "line" | "stripes" | "circle";

/** A monthly datum with a stable id and a decimal-year coordinate. */
export interface Point extends RawPoint {
  id: string; // `${year}-${month}` — stable across sources so DOM nodes are reused
  t: number; // decimal year, e.g. 1880 + (month - 0.5) / 12
}

export interface Extents {
  value: [number, number];
  t: [number, number];
  year: [number, number];
}

export const decimalYear = (year: number, month: number): number =>
  year + (month - 0.5) / 12;

export function toPoints(raw: RawPoint[]): Point[] {
  return raw.map((p) => ({
    ...p,
    id: `${p.year}-${p.month}`,
    t: decimalYear(p.year, p.month),
  }));
}

export function extentsOf(points: Point[]): Extents {
  let vmin = Infinity,
    vmax = -Infinity,
    tmin = Infinity,
    tmax = -Infinity,
    ymin = Infinity,
    ymax = -Infinity;
  for (const p of points) {
    if (p.value < vmin) vmin = p.value;
    if (p.value > vmax) vmax = p.value;
    if (p.t < tmin) tmin = p.t;
    if (p.t > tmax) tmax = p.t;
    if (p.year < ymin) ymin = p.year;
    if (p.year > ymax) ymax = p.year;
  }
  return { value: [vmin, vmax], t: [tmin, tmax], year: [ymin, ymax] };
}
