interface Props {
  min: number;
  max: number;
  color: (v: number) => string;
}

/** Horizontal color-scale legend with a few labeled ticks. */
export default function Legend({ min, max, color }: Props) {
  const steps = 40;
  const stops = Array.from({ length: steps }, (_, i) => {
    const v = min + ((max - min) * i) / (steps - 1);
    return { offset: (i / (steps - 1)) * 100, c: color(v) };
  });
  const ticks = [min, (min + max) / 2 < 0 ? min / 2 : 0, max].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <div className="legend">
      <svg width="220" height="40" role="img" aria-label="Temperature anomaly color scale">
        <defs>
          <linearGradient id="legendGrad" x1="0" x2="1" y1="0" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={`${s.offset}%`} stopColor={s.c} />
            ))}
          </linearGradient>
        </defs>
        <rect x="0" y="4" width="220" height="12" rx="2" fill="url(#legendGrad)" />
        {ticks.map((v) => {
          const px = ((v - min) / (max - min)) * 220;
          return (
            <g key={v}>
              <line x1={px} x2={px} y1="4" y2="20" stroke="rgba(255,255,255,0.5)" />
              <text x={px} y="32" textAnchor="middle" className="legend-tick">
                {v > 0 ? "+" : ""}
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
      <span className="legend-caption">°C vs 1951–1980</span>
    </div>
  );
}
