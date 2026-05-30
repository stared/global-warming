import * as d3 from "d3";

/**
 * Diverging blue→white→red scale centered on 0 (the 1951-1980 mean), in the
 * spirit of the warming-stripes palette. Symmetric so 0 is always neutral.
 */
export function makeColor(min: number, max: number): (v: number) => string {
  const m = Math.max(Math.abs(min), Math.abs(max), 0.1);
  const scale = d3
    .scaleDiverging<string>((t) => d3.interpolateRdBu(1 - t))
    .domain([-m, 0, m]);
  return (v: number) => scale(v);
}
