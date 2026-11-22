#!/usr/bin/env python3
"""Plot the three representatives fixed by the original stress report."""
from pathlib import Path
import hashlib
import json
import os

os.environ.setdefault("MPLCONFIGDIR", "/tmp/hopf-matplotlib")
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
report = json.loads((HERE / "results/analysis.json").read_text())
for name, digest in report["hashes"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name
rows = {r["id"]: r for r in report["rows"]}
labels = [
    "Intended geometry",
    "Uploaded geometry",
    "Centered ray",
    "Captured W, exact A",
    "Captured W, rounded A",
    "Captured coefficients",
    "GPU isolated",
    "GPU accepted",
]
keys = [
    "centeredRay",
    "chartExactA",
    "chartRoundedA",
    "coefficients",
    "isolated",
    "accepted",
]
colors = [
    "#7a838b",
    "#007f79",
    "#407fbc",
    "#407fbc",
    "#407fbc",
    "#8157ae",
    "#b97628",
    "#b6444c",
]
fig, axes = plt.subplots(1, 3, figsize=(7.4, 4.6), sharey=True)
for ax, representative in zip(axes, report["representatives"]):
    row = rows[representative["id"]]
    method = row["methods"]["compactified"]
    values = [row["intended"], row["expected"]] + [method["roots"][s] for s in keys]
    # The three queries have a symmetric intended pair or an exact contact.
    center = sum(row["intended"]) / len(row["intended"])
    spread = max(abs(s - center) * 1e3 for v in values for s in v)
    extent = max(spread * 1.25, 1)
    for s in row["expected"]:
        half = 1e-4 * max(1, abs(s)) * 1e3
        ax.axvspan(
            (s - center) * 1e3 - half,
            (s - center) * 1e3 + half,
            color="#007f79",
            alpha=0.10,
            lw=0,
        )
    for y, values_at_stage in enumerate(values):
        ax.axhline(y, color="#dfe4e8", lw=0.6, zorder=0)
        if values_at_stage:
            ax.scatter(
                [(s - center) * 1e3 for s in values_at_stage],
                [y] * len(values_at_stage),
                s=32,
                color=colors[y],
                edgecolors="white",
                linewidths=0.5,
                zorder=3,
            )
        else:
            ax.text(
                0,
                y,
                "no roots",
                ha="center",
                va="center",
                fontsize=9,
                color="#68727b",
                bbox=dict(facecolor="white", edgecolor="none", pad=1.5),
            )
    kind = {
        "position": "Position error",
        "count shortfall": "Missing pair",
        "count excess": "Extra pair",
    }[representative["kind"]]
    ax.set_title(f'{kind}\nQuery {row["id"]}', fontsize=10, fontweight="bold", pad=10)
    ax.set_xlim(-extent, extent)
    ax.set_ylim(7.5, -0.5)
    ax.set_yticks(range(8), labels, fontsize=10)
    ax.xaxis.set_major_locator(MaxNLocator(3))
    ax.tick_params(axis="both", length=0)
    ax.tick_params(axis="x", labelsize=9, pad=6)
    ax.set_xlabel(f"1000 × (s − {center:g})", fontsize=9, labelpad=8)
    for spine in ax.spines.values():
        spine.set_visible(False)
fig.subplots_adjust(left=0.28, right=0.99, top=0.85, bottom=0.25, wspace=0.22)
fig.text(
    0.28,
    0.045,
    "Bernstein traces; exact arithmetic above the GPU rows.\nShading: matching tolerance around uploaded-geometry roots.",
    fontsize=9,
    color="#404a54",
)
for ext in ["pdf", "png"]:
    fig.savefig(HERE / f"results/grazing-diagnostic.{ext}", dpi=220, facecolor="white")
print("Wrote grazing-diagnostic.pdf and .png")
