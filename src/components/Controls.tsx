import type { LayoutKind } from "../data/types";

const LAYOUTS: { key: LayoutKind; label: string; hint: string }[] = [
  { key: "spiral", label: "Spiral", hint: "Radial loop per year (Ed Hawkins)" },
  { key: "line", label: "Line", hint: "Anomaly over time" },
  { key: "stripes", label: "Stripes", hint: "One colored bar per month" },
];

interface Props {
  layout: LayoutKind;
  setLayout: (l: LayoutKind) => void;
  sourceKey: string;
  setSourceKey: (k: string) => void;
  sources: { key: string; label: string }[];
  playing: boolean;
  onTogglePlay: () => void;
  revealT: number;
  setRevealT: (t: number) => void;
  tExtent: [number, number];
}

export default function Controls({
  layout,
  setLayout,
  sourceKey,
  setSourceKey,
  sources,
  playing,
  onTogglePlay,
  revealT,
  setRevealT,
  tExtent,
}: Props) {
  return (
    <div className="controls">
      <div className="control-group">
        <span className="control-label">View</span>
        <div className="segmented">
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              className={layout === l.key ? "seg active" : "seg"}
              onClick={() => setLayout(l.key)}
              title={l.hint}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Source</span>
        <div className="segmented">
          {sources.map((s) => (
            <button
              key={s.key}
              className={sourceKey === s.key ? "seg active" : "seg"}
              onClick={() => setSourceKey(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group grow">
        <button className="play" onClick={onTogglePlay}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <input
          className="scrub"
          type="range"
          min={tExtent[0]}
          max={tExtent[1]}
          step={1 / 12}
          value={revealT}
          onChange={(e) => setRevealT(parseFloat(e.target.value))}
          aria-label="Reveal timeline"
        />
        <span className="year-readout">{Math.floor(revealT)}</span>
      </div>
    </div>
  );
}
