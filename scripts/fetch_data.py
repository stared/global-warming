# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Fetch global temperature anomaly series from trusted sources, re-baseline
them to a common 1951-1980 period, and emit a single JSON the web app reads.

Sources:
  - NASA GISTEMP v4 (land-ocean global means)
  - HadCRUT5 (Met Office / UEA CRU, analysis summary series)
  - Berkeley Earth (land + ocean, air temp above sea ice)

Each source publishes anomalies against its own baseline, so we recompute every
series relative to the 1951-1980 mean before writing, making them comparable.

Run with:  uv run scripts/fetch_data.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

BASELINE_START, BASELINE_END = 1951, 1980

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "climate.json"

USER_AGENT = "global-warming-viz/0.1 (+https://github.com)"


@dataclass
class Source:
    key: str
    label: str
    url: str
    homepage: str
    points: list[dict] = field(default_factory=list)  # {year, month, value}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _f(token: str) -> float | None:
    token = token.strip()
    if not token or token in ("***", "NaN", "nan", "NA", "-999.000", "-999.9"):
        return None
    try:
        return float(token)
    except ValueError:
        return None


def parse_nasa(text: str) -> list[dict]:
    """Year,Jan..Dec,... — skip title + repeated header lines. Missing = ***."""
    out: list[dict] = []
    for line in text.splitlines():
        parts = line.split(",")
        if len(parts) < 13:
            continue
        try:
            year = int(parts[0])
        except ValueError:
            continue  # title / header / blank
        for month in range(1, 13):
            v = _f(parts[month])
            if v is not None:
                out.append({"year": year, "month": month, "value": v})
    return out


def parse_hadcrut(text: str) -> list[dict]:
    """Time(YYYY-MM),Anomaly,lower,upper."""
    out: list[dict] = []
    for line in text.splitlines():
        parts = line.split(",")
        if len(parts) < 2 or "-" not in parts[0]:
            continue
        ym = parts[0].split("-")
        if len(ym) != 2:
            continue
        try:
            year, month = int(ym[0]), int(ym[1])
        except ValueError:
            continue
        v = _f(parts[1])
        if v is not None:
            out.append({"year": year, "month": month, "value": v})
    return out


def parse_berkeley(text: str) -> list[dict]:
    """% comment header, then: Year Month MonthlyAnomaly Unc ... (whitespace).

    The 'complete' file contains two data blocks (air-temp-above-sea-ice and
    water-temp-below-sea-ice). They share the same (year, month) keys, so we
    keep the first occurrence — the air-temperature version, the standard one.
    """
    out: list[dict] = []
    seen: set[tuple[int, int]] = set()
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("%"):
            continue
        cols = s.split()
        if len(cols) < 3:
            continue
        try:
            year, month = int(cols[0]), int(cols[1])
        except ValueError:
            continue
        if (year, month) in seen:
            continue
        v = _f(cols[2])
        if v is not None:
            seen.add((year, month))
            out.append({"year": year, "month": month, "value": v})
    return out


def rebaseline(points: list[dict]) -> list[dict]:
    """Shift the whole series so the 1951-1980 mean is zero."""
    base = [p["value"] for p in points if BASELINE_START <= p["year"] <= BASELINE_END]
    if not base:
        return points
    offset = sum(base) / len(base)
    return [
        {"year": p["year"], "month": p["month"], "value": round(p["value"] - offset, 3)}
        for p in points
    ]


SOURCES = [
    Source(
        key="nasa",
        label="NASA GISTEMP v4",
        url="https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
        homepage="https://data.giss.nasa.gov/gistemp/",
    ),
    Source(
        key="hadcrut",
        label="HadCRUT5",
        url="https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.0.2.0/analysis/diagnostics/HadCRUT.5.0.2.0.analysis.summary_series.global.monthly.csv",
        homepage="https://www.metoffice.gov.uk/hadobs/hadcrut5/",
    ),
    Source(
        key="berkeley",
        label="Berkeley Earth",
        url="https://berkeley-earth-temperature.s3.amazonaws.com/Global/Land_and_Ocean_complete.txt",
        homepage="https://berkeleyearth.org/data/",
    ),
]

PARSERS = {"nasa": parse_nasa, "hadcrut": parse_hadcrut, "berkeley": parse_berkeley}


def main() -> int:
    result_sources: dict[str, dict] = {}
    errors: list[str] = []

    for src in SOURCES:
        try:
            print(f"Fetching {src.label} …", file=sys.stderr)
            raw = fetch(src.url)
            points = PARSERS[src.key](raw)
            if not points:
                raise ValueError("no points parsed")
            points = rebaseline(points)
            points.sort(key=lambda p: (p["year"], p["month"]))
            result_sources[src.key] = {
                "label": src.label,
                "url": src.url,
                "homepage": src.homepage,
                "count": len(points),
                "points": points,
            }
            print(f"  → {len(points)} monthly points", file=sys.stderr)
        except Exception as exc:  # keep going; one bad source must not kill the build
            errors.append(f"{src.key}: {exc}")
            print(f"  ! failed: {exc}", file=sys.stderr)

    if not result_sources:
        print("All sources failed; refusing to overwrite data.", file=sys.stderr)
        return 1

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "baseline": f"{BASELINE_START}-{BASELINE_END}",
        "unit": "°C anomaly",
        "sourceOrder": [s.key for s in SOURCES if s.key in result_sources],
        "errors": errors,
        "sources": result_sources,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size // 1024} KiB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
