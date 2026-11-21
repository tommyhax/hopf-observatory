#!/usr/bin/env python3
"""Generate the compact validation figure from recorded stress results."""
from pathlib import Path
import json
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parent.parent
r = json.loads((root / "research/results/stress-analysis.json").read_text())
fig, ax = plt.subplots(1, 2, figsize=(9.4, 3.0), layout="constrained")
families = ["random", "pole", "tangent", "shell"]
s = r["results"]["0.0001"]["summary"]
x = np.arange(4)
ax[0].bar(
    x - 0.18,
    [100 * s[f]["geometryRounding"]["failedRays"] / 600 for f in families],
    0.36,
    color="#8a67a5",
    label="Input geometry changes",
)
ax[0].bar(
    x + 0.18,
    [100 * s[f]["compactified"]["polished"]["failedRays"] / 600 for f in families],
    0.36,
    color="#0c8892",
    label="Represented-root failures",
)
ax[0].set(
    xticks=x,
    xticklabels=["Random", "Pole", "Grazing", "Shell"],
    ylabel="Cases (%)",
    ylim=(0, 60),
    title="(a) Separate error sources at tolerance $10^{-4}$",
)
ax[0].legend(frameon=False, fontsize=8, loc="upper left")
for m, color, label in [
    ("compactified", "#0c8892", "Bernstein"),
    ("yuksel_direct", "#b45730", "Yuksel, centered"),
    ("yuksel_charts", "#8a67a5", "Yuksel, charts"),
]:
    ax[1].plot(
        [1e-4, 1e-5, 1e-6],
        [
            100
            * r["results"][str(t)]["summary"]["all"][m]["polished"]["failedRays"]
            / 2400
            for t in [1e-4, 1e-5, 1e-6]
        ],
        "o-",
        color=color,
        label=label,
        markersize=4,
    )
ax[1].set(
    xscale="log",
    xlim=(1.3e-4, 0.8e-6),
    ylim=(0, 15),
    xlabel="Relative ray-distance tolerance",
    ylabel="Failed queries (%)",
    title="(b) All 2,400 boundary queries",
)
ax[1].legend(frameon=False, fontsize=8)
for a in ax:
    a.spines[["top", "right"]].set_visible(False)
    a.grid(axis="y", alpha=0.15)
    a.set_axisbelow(True)
fig.savefig(root / "research/figures/stress-validation.png", dpi=200)
fig.savefig(
    root / "research/figures/stress-validation.pdf", metadata={"CreationDate": None}
)
