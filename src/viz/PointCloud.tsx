import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import type { LayoutKind, Point } from "../data/types";
import { computeGeometry, type Dims, type Geom } from "./geometry";
import type { Extents } from "../data/types";

interface Props {
  points: Point[];
  layout: LayoutKind;
  dims: Dims;
  ext: Extents;
  color: (v: number) => string;
  revealT: number;
  onHover: (p: Point | null, clientX: number, clientY: number) => void;
}

/**
 * Renders one <rect> per monthly datum. React owns the DOM structure (the set
 * of rects, keyed by a source-independent id); D3 owns the *transitions* of
 * each rect's geometry. Because ids are `${year}-${month}`, switching layouts
 * OR sources reuses the same DOM nodes, so the same points morph between views.
 */
export default function PointCloud({
  points,
  layout,
  dims,
  ext,
  color,
  revealT,
  onHover,
}: Props) {
  const gRef = useRef<SVGGElement>(null);
  const prev = useRef<{ layout: LayoutKind; dimsKey: string; pointsRef: Point[] | null }>({
    layout,
    dimsKey: "",
    pointsRef: null,
  });

  const byId = useMemo(() => {
    const m = new Map<string, Point>();
    for (const p of points) m.set(p.id, p);
    return m;
  }, [points]);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;

    const geoms = computeGeometry(layout, points, dims, ext, color, revealT);
    const geomById = new Map<string, Geom>();
    points.forEach((p, i) => geomById.set(p.id, geoms[i]));

    const dimsKey = `${dims.width}x${dims.height}`;
    const layoutChanged = prev.current.layout !== layout;
    const dimsChanged = prev.current.dimsKey !== dimsKey;
    const sourceChanged =
      prev.current.pointsRef !== null && prev.current.pointsRef !== points;
    const first = prev.current.pointsRef === null;

    let dur = 0;
    if (first) dur = 900;
    else if (dimsChanged) dur = 0; // resize: snap, don't animate
    else if (layoutChanged) dur = 1000;
    else if (sourceChanged) dur = 850;
    // else revealT-only change → instant for responsive scrubbing/playback

    prev.current = { layout, dimsKey, pointsRef: points };

    const sel = d3.select(g).selectAll<SVGRectElement, unknown>("rect.pt");
    const get = (el: SVGRectElement) => geomById.get(el.dataset.id!)!;
    // `any` here only to bridge the Selection|Transition union — both share the
    // same `.attr` surface, which TS won't resolve across the union.
    const target: any =
      dur === 0 ? sel : sel.transition().duration(dur).ease(d3.easeCubicInOut);
    target
      .attr("x", function (this: SVGRectElement) { return get(this).x; })
      .attr("y", function (this: SVGRectElement) { return get(this).y; })
      .attr("width", function (this: SVGRectElement) { return get(this).w; })
      .attr("height", function (this: SVGRectElement) { return get(this).h; })
      .attr("rx", function (this: SVGRectElement) { return get(this).rx; })
      .attr("fill", function (this: SVGRectElement) { return get(this).fill; })
      .attr("opacity", function (this: SVGRectElement) { return get(this).opacity; });
  }, [layout, points, dims, ext, color, revealT]);

  // Newly-mounted rects start collapsed at the center, then the effect above
  // transitions them out to their target geometry.
  const cx = dims.width / 2;
  const cy = dims.height / 2;

  return (
    <g
      ref={gRef}
      onMouseMove={(e) => {
        const id = (e.target as Element).getAttribute?.("data-id");
        const p = id ? byId.get(id) : null;
        onHover(p ?? null, e.clientX, e.clientY);
      }}
      onMouseLeave={(e) => onHover(null, e.clientX, e.clientY)}
    >
      {points.map((p) => (
        <rect
          key={p.id}
          className="pt"
          data-id={p.id}
          x={cx}
          y={cy}
          width={0}
          height={0}
          rx={0}
          opacity={0}
          fill="#888"
        />
      ))}
    </g>
  );
}
