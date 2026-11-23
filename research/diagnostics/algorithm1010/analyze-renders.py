#!/usr/bin/env python3
"""Image differences of complete GLSL renders; no solver is an image ground truth."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
r = json.loads(
    (
        ROOT / "research/diagnostics/algorithm1010/results/render-comparison.json"
    ).read_text()
)
for p, h in r["hashes"].items():
    assert hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h, p
rows = []
for item in r["renders"]:
    if item["variant"] == "production":
        continue
    base = next(
        x
        for x in r["renders"]
        if x["scene"] == item["scene"]
        and x["mode"] == item["mode"]
        and x["variant"] == "production"
    )
    a = np.asarray(Image.open(ROOT / base["path"]), dtype=float) / 255
    b = np.asarray(Image.open(ROOT / item["path"]), dtype=float) / 255
    difference = np.abs(a - b)
    per_pixel = np.max(difference, axis=2)
    rows.append(
        dict(
            scene=item["scene"],
            mode=item["mode"],
            variant=item["variant"],
            meanAbsoluteRGBError=float(difference.mean()),
            rmsRGBError=float(np.sqrt((difference * difference).mean())),
            p99PixelMaxError=float(np.percentile(per_pixel, 99)),
            maxError=float(per_pixel.max()),
            fractionOver3Codes=float((per_pixel > 3 / 255 + 1e-10).mean()),
            fractionOverPoint05=float((per_pixel > 0.05).mean()),
            sourceImageSHA256=hashlib.sha256(
                (ROOT / item["path"]).read_bytes()
            ).hexdigest(),
            baselineImageSHA256=hashlib.sha256(
                (ROOT / base["path"]).read_bytes()
            ).hexdigest(),
        )
    )
# One compact contact sheet: physical rendering, and exaggerated differences.
scenes = list(dict.fromkeys(x["scene"] for x in r["renders"]))
canvas = Image.new("RGB", (1440, 310 * len(scenes)), (246, 248, 249))
draw = ImageDraw.Draw(canvas)
for i, scene in enumerate(scenes):
    images = {
        x["variant"]: Image.open(ROOT / x["path"]).convert("RGB")
        for x in r["renders"]
        if x["scene"] == scene and x["mode"] == 0
    }
    canvas.paste(images["production"], (0, i * 310 + 32))
    draw.text((8, i * 310 + 8), scene + " | production", fill=(10, 35, 45))
    a = np.asarray(images["production"], dtype=float)
    for j, variant in enumerate(["odm-direct", "odm-charts"], 1):
        diff = np.clip(
            abs(a - np.asarray(images[variant], dtype=float)) * 8, 0, 255
        ).astype("uint8")
        canvas.paste(Image.fromarray(diff), (j * 480, i * 310 + 32))
        draw.text(
            (j * 480 + 8, i * 310 + 8),
            variant + " | absolute difference x8",
            fill=(10, 35, 45),
        )
canvas.save(ROOT / "research/diagnostics/algorithm1010/figures/render-comparison.png")
files = [
    "research/diagnostics/algorithm1010/analyze-renders.py",
    "research/diagnostics/algorithm1010/results/render-comparison.json",
]
output = dict(
    metric="RGB8 final-display differences after tone mapping/vignette; baseline is production Bernstein, not independent image truth. Thresholds are diagnostic, not an equivalence guarantee.",
    width=480,
    height=270,
    comparisons=rows,
    hashes={p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files},
)
(
    ROOT / "research/diagnostics/algorithm1010/results/render-comparison-analysis.json"
).write_text(json.dumps(output, indent=2) + "\n")
for row in rows:
    print(
        row["scene"],
        row["mode"],
        row["variant"],
        "MAE",
        format(row["meanAbsoluteRGBError"], ".3g"),
        "pixels > .05",
        format(row["fractionOverPoint05"] * 100, ".3g") + "%",
    )
