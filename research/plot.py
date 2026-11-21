#!/usr/bin/env python3
"""Create publication figures directly from recorded data and shader renders."""
from pathlib import Path
import json
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import NullFormatter
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "technical-note/figures"
OUT.mkdir(parents=True, exist_ok=True)
plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.labelcolor": "#172d36",
        "text.color": "#172d36",
        "figure.facecolor": "white",
        "savefig.facecolor": "white",
        "pdf.fonttype": 42,
    }
)
COLORS = {
    "compactified": "#087e82",
    "ferrari": "#b85a39",
    "geometryRounding": "#78569a",
}


def save(fig, name, vector=False):
    fig.savefig(OUT / (name + ".png"), dpi=300, bbox_inches="tight", pad_inches=0.08)
    if vector:
        fig.savefig(OUT / (name + ".pdf"), bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)


def panels(names, titles, size, name):
    fig, axes = plt.subplots(1, len(names), figsize=size)
    for ax, file, title in zip(np.atleast_1d(axes), names, titles):
        ax.imshow(Image.open(ROOT / "figures" / f"{file}.ppm"))
        ax.set_axis_off()
        ax.set_title(title, pad=9, fontsize=11)
    fig.subplots_adjust(wspace=0.025)
    save(fig, name)


panels(
    ["three-unrotated", "three-tori"],
    ["(a) Aligned family", "(b) Shared four-dimensional rotation"],
    (8, 3.6),
    "three-tori",
)
panels(
    [f"pole-{a}" for a in [30, 42, 45, 48, 60]],
    [f"{a}°" for a in [30, 42, 45, 48, 60]],
    (8, 1.8),
    "pole-sequence",
)
panels(
    ["solid", "shell"],
    ["(a) Solid region", "(b) 3° parameter-band shell"],
    (7, 3.3),
    "solid-shell",
)
# A faithful three-coordinate section of S^3: choose p=(s,b,0), so q3=0.
fig = plt.figure(figsize=(8, 3.4))
ax = fig.add_subplot(121)
b = 0.65
ax.axhline(0, color="#c6cdd0", lw=0.8)
ax.axvline(0, color="#c6cdd0", lw=0.8)
ax.plot([-3, 5], [b, b], color="#c6cdd0", ls="--", lw=1)
ax.annotate(
    "",
    xy=(4.8, b),
    xytext=(-2, b),
    arrowprops={"arrowstyle": "->", "lw": 2, "color": COLORS["compactified"]},
)
ax.scatter([-2], [b], c=COLORS["compactified"], s=30)
ax.text(-2, 0.85, r"$o$", fontsize=12)
ax.text(0.6, 0.85, r"$p(s)=o+s\,d$", fontsize=12)
ax.set(
    xlim=(-3, 5),
    ylim=(-1, 2),
    xlabel="$x$",
    ylabel="$y$",
    title=r"(a) A straight ray in $\mathbb{R}^3$",
)
ax.set_aspect("equal")
ax.set_yticks([0, b])
ax.set_yticklabels(["0", "$b$"])
ax = fig.add_subplot(122, projection="3d")
u = np.linspace(0, 2 * np.pi, 50)
v = np.linspace(0, np.pi, 25)
ax.plot_wireframe(
    np.outer(np.cos(u), np.sin(v)),
    np.outer(np.sin(u), np.sin(v)),
    np.outer(np.ones_like(u), np.cos(v)),
    rstride=7,
    cstride=4,
    color="#c1ccd0",
    linewidth=0.35,
    alpha=0.55,
)
s = np.r_[np.linspace(-2, 10, 350), np.geomspace(10.01, 10000, 200)]
D = 1 + s * s + b * b
ax.plot(
    2 * s / D, 2 * b / D, (s * s + b * b - 1) / D, color=COLORS["compactified"], lw=2.5
)
q0 = np.array([-4, 2 * b, 4 + b * b - 1]) / (5 + b * b)
ax.scatter(*q0, color=COLORS["compactified"], s=22)
ax.text(*q0, "  $Q(o)$", fontsize=11)
ax.scatter(0, 0, 1, color="#b85a39", s=24)
ax.text(0, 0, 1.13, "$N$: projection pole", fontsize=10)
ax.set_title("(b) Its circular lift on $S^3$")
ax.set_box_aspect((1, 1, 1))
ax.view_init(elev=22, azim=-67)
ax.set_axis_off()
ax.text2D(
    0.13,
    0.03,
    "$q_3=0$ section, drawn in $(q_1,q_2,q_4)$",
    transform=ax.transAxes,
    fontsize=9,
)
fig.tight_layout()
save(fig, "ray-lift", True)
# Plot all failures, not just the errors of successful roots.
analysis = json.loads((ROOT / "results/analysis.json").read_text())
bins = analysis["bins"]
x = [r["delta"] for r in bins]
fig, axes = plt.subplots(1, 3, figsize=(10, 3.05))
for method, label in [
    ("compactified", "Near/reciprocal"),
    ("ferrari", "Ferrari baseline"),
]:
    axes[0].plot(
        x,
        [100 * r[method]["failedRays"] / r[method]["rays"] for r in bins],
        "-o",
        ms=4,
        color=COLORS[method],
        label=label,
    )
    axes[1].plot(
        x,
        [max(1e-10, r[method]["maxAllOutputError"] or 0) for r in bins],
        "-o",
        ms=4,
        color=COLORS[method],
        label=label,
    )
axes[0].set(
    ylabel="Failed rays (%)",
    ylim=(-3, 103),
    title="(a) Solver failure rate",
)
axes[1].set(
    yscale="log",
    ylabel="Largest returned-root relative error",
    ylim=(1e-9, 1e-6),
    title="(b) Returned-root error",
)
axes[2].plot(
    x,
    [
        100 * r["geometryRounding"]["failedRays"] / r["geometryRounding"]["rays"]
        for r in bins
    ],
    "-o",
    color=COLORS["geometryRounding"],
    ms=4,
    label="Geometry changed > tolerance",
)
axes[2].plot(
    x,
    [100 * r["roundedToPole"] / 48 for r in bins],
    "--s",
    color="#727d82",
    ms=3,
    label=r"Uploaded $\delta$ equals zero",
)
axes[2].set(ylabel="Rays (%)", ylim=(-3, 103), title="(c) Input rounding alone")
for ax in axes:
    ax.set_xscale("log")
    ax.set_xlim(1e-1, 1e-12)
    ax.set_xlabel(r"Nominal $|\delta|$")
    ax.set_xticks([1e-1, 1e-4, 1e-8, 1e-12])
    ax.grid(True, alpha=0.15)
    ax.xaxis.set_minor_formatter(NullFormatter())
axes[0].legend(fontsize=8, loc="upper right")
axes[2].legend(fontsize=7, loc="upper left")
fig.tight_layout()
save(fig, "pole-errors", True)
# Browser measurements retain raw sample arrays in the companion JSON.
web = json.loads((ROOT / "results/webgl-benchmark.json").read_text())
fig, axes = plt.subplots(1, 2, figsize=(8, 3.1))
for ax, width in zip(axes, [640, 1280]):
    for scene, color, label in [
        ("single solid", "#087e82", "One solid"),
        ("three thin shells", "#78569a", "Three 0.01° shells"),
        ("three thin shells near pole", "#b85a39", "Three shells, XW=45°"),
    ]:
        records = [
            m
            for m in web["measurements"]
            if m["scene"] == scene and m["width"] == width
        ]
        ax.plot(
            [m["budget"] for m in records],
            [m["median"] for m in records],
            "-o",
            color=color,
            label=label,
            ms=4,
        )
        ax.fill_between(
            [m["budget"] for m in records],
            [np.percentile(m["milliseconds"], 25) for m in records],
            [np.percentile(m["milliseconds"], 75) for m in records],
            color=color,
            alpha=0.12,
        )
    ax.set(
        title=f"{width} × {width*9//16}",
        xlabel="Maximum optical interactions",
        ylabel="Draw + readback time (ms)",
        xticks=[8, 16, 24],
    )
    ax.grid(alpha=0.15)
axes[0].legend(fontsize=8)
fig.tight_layout()
save(fig, "performance", True)
print("Wrote six paper figures to", OUT)
