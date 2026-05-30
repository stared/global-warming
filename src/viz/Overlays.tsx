import * as d3 from "d3";
import { motion } from "framer-motion";
import type { Extents, LayoutKind, Point } from "../data/types";
import { circleFns, spiralFns, timeX, valueY, type Dims, M } from "./geometry";

interface Props {
  layout: LayoutKind;
  dims: Dims;
  ext: Extents;
  latest: Point | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°C`;

function group(active: boolean) {
  return {
    initial: false as const,
    animate: { opacity: active ? 1 : 0 },
    transition: { duration: 0.6 },
    style: { pointerEvents: "none" as const },
  };
}

/**
 * Static chrome per layout (axes, gridlines, reference rings, month + center
 * labels). The connecting *line* lives in PointCloud so it morphs with the
 * points; everything here just crossfades on layout change.
 */
export default function Overlays({ layout, dims, ext, latest }: Props) {
  const x = timeX(dims, ext);
  const { scale: y } = valueY(dims, ext);
  const yTicks = d3.ticks(ext.value[0], ext.value[1], 6);
  const xTicks = d3.ticks(ext.t[0], ext.t[1], 8).filter((d) => Number.isInteger(d));

  const sp = spiralFns(dims, ext);
  const ci = circleFns(dims, ext);
  const spiralRefs = [0, 0.5, 1, 1.5, 2].filter((v) => v >= ext.value[0] && v <= ext.value[1]);

  return (
    <>
      {/* ---------- LINE ---------- */}
      <motion.g {...group(layout === "line")}>
        {yTicks.map((v) => (
          <g key={`yl-${v}`}>
            <line className={v === 0 ? "grid grid-zero" : "grid"} x1={M.left} x2={dims.width - M.right} y1={y(v)} y2={y(v)} />
            <text className="axis-label" x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`xl-${t}`} className="axis-label" x={x(t)} y={dims.height - M.bottom + 18} textAnchor="middle">
            {t}
          </text>
        ))}
      </motion.g>

      {/* ---------- STRIPES ---------- */}
      <motion.g {...group(layout === "stripes")}>
        {xTicks.map((t) => (
          <text key={`sx-${t}`} className="axis-label" x={x(t)} y={dims.height - M.bottom + 18} textAnchor="middle">
            {t}
          </text>
        ))}
      </motion.g>

      {/* ---------- SPIRAL ---------- */}
      <motion.g {...group(layout === "spiral")}>
        {spiralRefs.map((v) => (
          <g key={`sr-${v}`}>
            <circle className="ring" cx={sp.cx} cy={sp.cy} r={sp.r(v)} />
            <text className="ring-label" x={sp.cx} y={sp.cy - sp.r(v)} dy="-3" textAnchor="middle">
              {fmt(v)}
            </text>
          </g>
        ))}
        {MONTHS.map((mlabel, i) => {
          const a = sp.angle(i + 1);
          const rr = sp.maxR + 16;
          return (
            <text key={`sm-${i}`} className="month-label" x={sp.cx + rr * Math.cos(a)} y={sp.cy + rr * Math.sin(a)} dy="0.32em" textAnchor="middle">
              {mlabel}
            </text>
          );
        })}
        {latest && (
          <text className="center-year" x={sp.cx} y={sp.cy} dy="0.32em" textAnchor="middle">
            {latest.year}
          </text>
        )}
      </motion.g>

      {/* ---------- MONTHLY CIRCLE ---------- */}
      <motion.g {...group(layout === "circle")}>
        <circle className="ring" cx={ci.cx} cy={ci.cy} r={ci.maxR} />
        <circle className="ring" cx={ci.cx} cy={ci.cy} r={ci.innerR} />
        {MONTHS.map((mlabel, i) => {
          const a = ci.angle(i + 1);
          const rr = ci.maxR + 16;
          return (
            <text key={`cm-${i}`} className="month-label" x={ci.cx + rr * Math.cos(a)} y={ci.cy + rr * Math.sin(a)} dy="0.32em" textAnchor="middle">
              {mlabel}
            </text>
          );
        })}
        <text className="ring-hint" x={ci.cx} y={ci.cy} dy="0.32em" textAnchor="middle">
          rings: {ext.year[0]}→{ext.year[1]}
        </text>
      </motion.g>
    </>
  );
}
