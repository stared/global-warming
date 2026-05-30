# A Warming World

Interactive visualizations of global surface-temperature anomalies, with the
**same data points morphing between every view**:

- 🌀 **Spiral** — Ed Hawkins-style radial loop (angle = month, radius = anomaly)
- 📈 **Line** — anomaly over time
- 🟥 **Stripes** — one colored bar per month (warming stripes)
- 🕐 **Monthly clock** — months around the circle, years as concentric rings

Data is fetched automatically from three trusted sources and **re-baselined to a
common 1951–1980 period** so they are directly comparable:

| Source | Series |
| --- | --- |
| [NASA GISTEMP v4](https://data.giss.nasa.gov/gistemp/) | Land-ocean global means |
| [HadCRUT5](https://www.metoffice.gov.uk/hadobs/hadcrut5/) | Met Office / UEA CRU analysis |
| [Berkeley Earth](https://berkeleyearth.org/data/) | Land + ocean (air temp above sea ice) |

## How the morph works

Every monthly datum is one `<rect>` keyed by `year-month`. React owns the set of
rects; **D3 owns the transitions** of each rect's position/size/color. Because
the key is source-independent, switching either the *view* or the *data source*
reuses the same DOM nodes — so the points slide to their new home instead of
redrawing. See `src/viz/PointCloud.tsx` and `src/viz/geometry.ts`.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm data         # re-fetch climate.json from the sources (uv)
pnpm build        # type-check + production build to dist/
```

The committed `public/data/climate.json` is a seed for local development; the
deployed site regenerates it fresh on every CI run.

## Data pipeline

`scripts/fetch_data.py` (stdlib only, run via `uv`) downloads each source,
parses its format, re-baselines to 1951–1980, and writes a single compact JSON.
A failing source is skipped rather than breaking the build.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs on push to `main`, **weekly on a schedule**,
and on manual dispatch. Each run: refreshes the data → commits it for history →
builds → publishes to Pages.

One-time setup: in the repo, **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The Vite `base` is relative (`./`), so it works at
`https://<user>.github.io/<repo>/` without further config.

## Stack

React + TypeScript + Vite · D3 (scales + transitions) · Framer Motion (overlay
crossfades) · Python/uv (data) · pnpm.
