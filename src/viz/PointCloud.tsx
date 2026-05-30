import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import type { Extents, LayoutKind, Point } from "../data/types";
import { computeGeometry, type Dims, type Geom } from "./geometry";

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
 * Renders one <rect> per monthly datum plus a single connecting <path> through
 * the revealed points. React owns the DOM structure (rects keyed by a
 * source-independent id); D3 owns the *transitions*.
 *
 * The connecting line is morphed in the SAME transition as the points: because
 * it always strings together the same revealed point centers, the source and
 * target path have an identical vertex count, so `interpolateString` bends every
 * vertex smoothly instead of the path snapping/crossfading between layouts.
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
  const pathRef = useRef<SVGPathElement>(null);
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

    // --- points ---
    const sel = d3.select(g).selectAll<SVGRectElement, unknown>("rect.pt");
    const get = (el: SVGRectElement) => geomById.get(el.dataset.id!)!;
    // `any` only to bridge the Selection|Transition union (shared `.attr` API).
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

    // --- connecting line through revealed point centers (same coords as points) ---
    const path = pathRef.current;
    if (path) {
      const centers: [number, number][] = [];
      for (let i = 0; i < points.length; i++) {
        if (points[i].t <= revealT + 1e-9) {
          const ge = geoms[i];
          centers.push([ge.x + ge.w / 2, ge.y + ge.h / 2]);
        }
      }
      const newD = d3.line()(centers) ?? "";
      const op = layout === "stripes" ? 0 : 0.34; // bars don't want a centerline
      const cur = path.getAttribute("d") ?? "";

      // Morph the path only when the vertex count is guaranteed to match
      // (layout change at fixed reveal/source). Otherwise snap to avoid a
      // mismatched-vertex glitch from interpolateString.
      if (dur > 0 && layoutChanged && cur) {
        d3.select(path)
          .transition()
          .duration(dur)
          .ease(d3.easeCubicInOut)
          .attrTween("d", () => d3.interpolateString(cur, newD))
          .attr("opacity", op);
      } else {
        d3.select(path).interrupt();
        path.setAttribute("d", newD);
        path.setAttribute("opacity", String(op));
      }
    }
  }, [layout, points, dims, ext, color, revealT]);

  // Newly-mounted rects start collapsed at the center, then the effect above
  // transitions them out to their target geometry.
  const cx = dims.width / 2;
  const cy = dims.height / 2;

  return (
    <g>
      <path ref={pathRef} className="connect" fill="none" opacity={0} />
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
    </g>
  );
}
