import { useEffect, useMemo, useRef, useState } from "react";
import Controls from "./components/Controls";
import Legend from "./components/Legend";
import {
  extentsOf,
  toPoints,
  type ClimateData,
  type LayoutKind,
  type Point,
} from "./data/types";
import { makeColor } from "./viz/colors";
import type { Dims } from "./viz/geometry";
import Overlays from "./viz/Overlays";
import PointCloud from "./viz/PointCloud";

const PLAY_YEARS_PER_SEC = 10;

const VIEW_CAPTIONS: Record<LayoutKind, string> = {
  spiral:
    "Each loop is one year; the colored line spirals outward as months run warmer than the 1951–1980 average. Ed Hawkins' climate spiral.",
  line: "Monthly temperature anomaly over time — the classic view of the warming trend.",
  stripes:
    "One stripe per month, blue (cooler) to red (warmer). Warming stripes, after Ed Hawkins.",
  circle:
    "A clock of months; each concentric ring is one year (1880 at the centre, today at the edge). The warming shows in the ring color — global anomalies have the seasonal cycle removed, so the month angle carries little signal.",
};

export default function App() {
  const [data, setData] = useState<ClimateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutKind>("spiral");
  const [sourceKey, setSourceKey] = useState<string>("nasa");
  const [revealT, setRevealT] = useState<number>(-1); // -1 = uninitialised
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<{ p: Point; x: number; y: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Dims>({ width: 0, height: 0 });

  // --- Load data ---
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/climate.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ClimateData) => {
        setData(d);
        if (!d.sources[sourceKey]) setSourceKey(d.sourceOrder[0]);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Responsive sizing ---
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setDims({ width: Math.round(cr.width), height: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sources = useMemo(
    () =>
      data
        ? data.sourceOrder.map((k) => ({ key: k, label: data.sources[k].label }))
        : [],
    [data],
  );

  const points = useMemo<Point[]>(() => {
    if (!data || !data.sources[sourceKey]) return [];
    return toPoints(data.sources[sourceKey].points);
  }, [data, sourceKey]);

  const ext = useMemo(() => extentsOf(points), [points]);
  const color = useMemo(() => makeColor(ext.value[0], ext.value[1]), [ext]);

  // Initialise / clamp the reveal cursor when the source (or data) changes.
  useEffect(() => {
    if (points.length === 0) return;
    setRevealT((rt) =>
      rt < 0 ? ext.t[1] : Math.min(Math.max(rt, ext.t[0]), ext.t[1]),
    );
  }, [ext, points.length]);

  // --- Playback ---
  useEffect(() => {
    if (!playing || points.length === 0) return;
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (last === 0) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      setRevealT((rt) => {
        const next = rt + dt * PLAY_YEARS_PER_SEC;
        if (next >= ext.t[1]) {
          setPlaying(false);
          return ext.t[1];
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, ext, points.length]);

  const onTogglePlay = () => {
    if (!playing && revealT >= ext.t[1] - 1e-6) setRevealT(ext.t[0]); // restart
    setPlaying((p) => !p);
  };

  const latest = useMemo(() => {
    let best: Point | null = null;
    for (const p of points) {
      if (p.t <= revealT + 1e-9 && (!best || p.t > best.t)) best = p;
    }
    return best;
  }, [points, revealT]);

  const ready = data && points.length > 0 && dims.width > 0 && revealT >= 0;
  const src = data?.sources[sourceKey];

  return (
    <div className="app">
      <header className="masthead">
        <h1>A Warming World</h1>
        <p className="sub">
          Monthly global surface-temperature anomalies, relative to the 1951–1980
          average. The same data points move between every view.
        </p>
      </header>

      {error && <div className="banner error">Could not load data: {error}</div>}

      {data && (
        <Controls
          layout={layout}
          setLayout={setLayout}
          sourceKey={sourceKey}
          setSourceKey={setSourceKey}
          sources={sources}
          playing={playing}
          onTogglePlay={onTogglePlay}
          revealT={revealT < 0 ? ext.t[1] : revealT}
          setRevealT={(t) => {
            setPlaying(false);
            setRevealT(t);
          }}
          tExtent={ext.t}
        />
      )}

      {data && <p className="view-caption">{VIEW_CAPTIONS[layout]}</p>}

      <div className="stage" ref={stageRef}>
        {ready && (
          <svg width={dims.width} height={dims.height} className="viz">
            <Overlays layout={layout} dims={dims} ext={ext} latest={latest} />
            <PointCloud
              points={points}
              layout={layout}
              dims={dims}
              ext={ext}
              color={color}
              revealT={revealT}
              onHover={(p, x, y) => setHover(p ? { p, x, y } : null)}
            />
          </svg>
        )}
        {!ready && !error && <div className="banner">Loading climate data…</div>}
      </div>

      <div className="footer-row">
        {points.length > 0 && (
          <Legend min={ext.value[0]} max={ext.value[1]} color={color} />
        )}
        {src && (
          <div className="meta">
            <a href={src.homepage} target="_blank" rel="noreferrer">
              {src.label}
            </a>
            {" · "}
            {ext.year[0]}–{ext.year[1]}
            {data && (
              <>
                {" · updated "}
                {data.generated.slice(0, 10)}
              </>
            )}
          </div>
        )}
      </div>

      {hover && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <strong>
            {MONTH_NAMES[hover.p.month - 1]} {hover.p.year}
          </strong>
          <span>
            {hover.p.value > 0 ? "+" : ""}
            {hover.p.value.toFixed(2)} °C
          </span>
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
