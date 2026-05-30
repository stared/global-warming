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
 * Renders one <rect> per monthly datum plus one <line> per consecutive pair
 * (the connecting line, colored by temperature like Ed Hawkins' spiral).
 *
 * React owns the DOM structure (rects + segments, keyed by source-independent
 * ids); D3 owns the *transitions*. Each segment's endpoints follow the very
 * same point centers the rects use, so the colored line bends smoothly in lock
 * step with the points on every layout change — no snapping, no crossfade.
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
  const dotsRef = useRef<SVGGElement>(null);
  const segsRef = useRef<SVGGElement>(null);
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
    const dotsG = dotsRef.current;
    const segsG = segsRef.current;
    if (!dotsG || !segsG) return;

    const geoms = computeGeometry(layout, points, dims, ext, color, revealT);
    const geomById = new Map<string, Geom>();
    points.forEach((p, i) => geomById.set(p.id, geoms[i]));
    const cx = (i: number) => geoms[i].x + geoms[i].w / 2;
    const cy = (i: number) => geoms[i].y + geoms[i].h / 2;

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

    const ease = d3.easeCubicInOut;
    const lineDim = layout === "stripes"; // bars don't want a centerline

    // --- points (rects) ---
    const dotSel = d3.select(dotsG).selectAll<SVGRectElement, unknown>("rect.pt");
    const get = (el: SVGRectElement) => geomById.get(el.dataset.id!)!;
    const dotTgt: any = dur === 0 ? dotSel : dotSel.transition().duration(dur).ease(ease);
    dotTgt
      .attr("x", function (this: SVGRectElement) { return get(this).x; })
      .attr("y", function (this: SVGRectElement) { return get(this).y; })
      .attr("width", function (this: SVGRectElement) { return get(this).w; })
      .attr("height", function (this: SVGRectElement) { return get(this).h; })
      .attr("rx", function (this: SVGRectElement) { return get(this).rx; })
      .attr("fill", function (this: SVGRectElement) { return get(this).fill; })
      .attr("opacity", function (this: SVGRectElement) { return get(this).opacity; });

    // --- connecting segments (lines), colored by temperature ---
    const segSel = d3.select(segsG).selectAll<SVGLineElement, unknown>("line.connector");
    const segTgt: any = dur === 0 ? segSel : segSel.transition().duration(dur).ease(ease);
    const idx = (el: SVGLineElement) => +el.dataset.i!;
    segTgt
      .attr("x1", function (this: SVGLineElement) { return cx(idx(this)); })
      .attr("y1", function (this: SVGLineElement) { return cy(idx(this)); })
      .attr("x2", function (this: SVGLineElement) { return cx(idx(this) + 1); })
      .attr("y2", function (this: SVGLineElement) { return cy(idx(this) + 1); })
      .attr("stroke", function (this: SVGLineElement) {
        const i = idx(this);
        return color((points[i].value + points[i + 1].value) / 2);
      })
      .attr("opacity", function (this: SVGLineElement) {
        const i = idx(this);
        const shown = points[i + 1].t <= revealT + 1e-9;
        return lineDim || !shown ? 0 : 0.85;
      });
  }, [layout, points, dims, ext, color, revealT]);

  // New elements mount collapsed at the origin (no dynamic attrs in JSX, so a
  // resize never clobbers D3's positions), then the effect transitions them out.
  return (
    <g>
      <g ref={segsRef} className="segs">
        {points.slice(0, -1).map((p, i) => (
          <line key={p.id} className="connector" data-i={i} opacity={0} />
        ))}
      </g>
      <g
        ref={dotsRef}
        onMouseMove={(e) => {
          const id = (e.target as Element).getAttribute?.("data-id");
          const p = id ? byId.get(id) : null;
          onHover(p ?? null, e.clientX, e.clientY);
        }}
        onMouseLeave={(e) => onHover(null, e.clientX, e.clientY)}
      >
        {points.map((p) => (
          <rect key={p.id} className="pt" data-id={p.id} width={0} height={0} opacity={0} fill="#888" />
        ))}
      </g>
    </g>
  );
}
