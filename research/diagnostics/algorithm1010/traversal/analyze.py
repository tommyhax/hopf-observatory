"""Analyse the fixed WebGL 2x2 experiment without changing prior records."""

from pathlib import Path
import gzip
import hashlib
import itertools
import json
import numpy as np
from PIL import Image, ImageDraw
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NAMES = ["production", "production-unrolled", "odm-loop", "odm-direct"]
LABELS = ["Bernstein\nloop", "Bernstein\nexpanded", "ODM\nloop", "ODM\nexpanded"]


def read(path):
    return json.loads(path.read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify(record):
    for group in ["hashes", "sourceHashes"]:
        for path, expected in record.get(group, {}).items():
            assert digest((ROOT / path).read_bytes()) == expected, path


benchmark = read(HERE / "results/benchmark.json")
renders = read(HERE / "results/renders.json")
accepted = read(HERE.parent / "final/results/webgl-benchmark.json")
verify(benchmark)
verify(renders)
assert benchmark["shaderHashes"] == renders["shaderHashes"]
assert benchmark["compiledShaderHashes"] == renders["compiledShaderHashes"]
assert benchmark["variants"] == NAMES
assert benchmark["hardware"]["timerQueryAvailable"]
assert benchmark["hardware"] == accepted["hardware"]
scenes = list(dict.fromkeys(x["scene"] for x in benchmark["measurements"]))
assert len(scenes) == 4 and len(benchmark["measurements"]) == 48


def distribution(values):
    return {
        "count": len(values),
        "min": float(np.min(values)),
        "p05": float(np.percentile(values, 5)),
        "p25": float(np.percentile(values, 25)),
        "median": float(np.median(values)),
        "p75": float(np.percentile(values, 75)),
        "p95": float(np.percentile(values, 95)),
        "max": float(np.max(values)),
    }


summaries, effects, transport, image_comparisons = [], [], {}, []
for name in NAMES:
    path = HERE / f"results/webgl-transport-{name}.json"
    report = read(path)
    verify(report)
    previous = read(HERE.parent / f"final/results/webgl-transport-{name}.json")
    assert report["passed"]
    assert report["shaderHashes"]["fragment"] == benchmark["shaderHashes"][name]
    assert report["hardware"] == benchmark["hardware"]
    transport[name] = {
        "passed": True,
        "sameResultsAsPriorSuite": report["results"] == previous["results"],
        "suites": {
            key: {"passed": value["passed"], "total": value["total"]}
            for key, value in report["results"].items()
        },
    }

fig, axes = plt.subplots(2, 2, figsize=(11, 7), constrained_layout=True)
for scene_index, scene in enumerate(scenes):
    medians, block_medians, series = {}, {}, []
    for name in NAMES:
        blocks = sorted(
            (
                x
                for x in benchmark["measurements"]
                if x["scene"] == scene and x["variant"] == name
            ),
            key=lambda x: x["round"],
        )
        assert [x["round"] for x in blocks] == [0, 1, 2]
        for block in blocks:
            expected_uniforms = next(
                x["uniforms"]
                for x in accepted["measurements"]
                if x["scene"] == scene
                and x["variant"] == "production"
                and x["round"] == 0
            )
            assert block["uniforms"] == expected_uniforms
            assert (
                block["width"] == 1280
                and block["height"] == 720
                and block["frames"] == 10
                and block["warmup"] == 5
            )
            assert (
                not block["disjoint"]
                and len(block["gpuMilliseconds"])
                == len(block["completionMilliseconds"])
                == 10
            )
            expected_order = (
                NAMES[::-1] if (block["round"] + scene_index) % 2 else NAMES
            )
            assert block["order"] == expected_order
            assert block["order"][block["position"]] == name
        values = [v for b in blocks for v in b["gpuMilliseconds"]]
        assert np.isfinite(values).all() and min(values) > 0
        series.append(values)
        gpu_summary = distribution(values)
        medians[name] = gpu_summary["median"]
        block_medians[name] = [float(np.median(b["gpuMilliseconds"])) for b in blocks]
        summaries.append(
            dict(
                scene=scene,
                variant=name,
                gpuMilliseconds=gpu_summary,
                completionMilliseconds=distribution(
                    [v for b in blocks for v in b["completionMilliseconds"]]
                ),
                gpuBlockMedians=block_medians[name],
            )
        )
    comparisons = [
        ("bernsteinExpansion", "production", "production-unrolled"),
        ("odmExpansion", "odm-loop", "odm-direct"),
        ("solverWithLoop", "production", "odm-loop"),
        ("solverWithExpansion", "production-unrolled", "odm-direct"),
        ("originalMixedTraversal", "production", "odm-direct"),
    ]
    row = {"scene": scene}
    for key, before, after in comparisons:
        ratios = [
            100 * (b / a - 1)
            for a, b in zip(block_medians[before], block_medians[after])
        ]
        row[key] = dict(
            before=before,
            after=after,
            milliseconds=medians[after] - medians[before],
            percent=100 * (medians[after] / medians[before] - 1),
            pairedBlockPercent=ratios,
            pairedBlockPercentMedian=float(np.median(ratios)),
        )
    row["interactionMilliseconds"] = (
        row["odmExpansion"]["milliseconds"] - row["bernsteinExpansion"]["milliseconds"]
    )
    effects.append(row)
    ax = axes.flat[scene_index]
    ax.boxplot(series, tick_labels=LABELS, showfliers=False, widths=0.5)
    for i, values in enumerate(series):
        for block in range(3):
            positions = np.linspace(i + 1 - 0.14, i + 1 + 0.14, 10)
            ax.scatter(
                positions,
                values[block * 10 : (block + 1) * 10],
                s=9,
                alpha=0.65,
                color=["#227a99", "#de8e28", "#8c66a4"][block],
                label=f"Block {block+1}" if i == 0 else None,
            )
    ax.set_title(scene)
    ax.set_ylabel("GPU elapsed time (ms)")
    ax.grid(axis="y", alpha=0.2)
    if scene_index == 0:
        ax.legend(fontsize=8)
fig.suptitle(
    "WebGL 720p: fixed solver × traversal comparison\n30 completed frames per cell; three alternating-order blocks",
    fontsize=13,
)
fig.savefig(HERE / "figures/timing-distributions.png", dpi=160)
plt.close(fig)

# Lossless RGBA8 captures retain every output, not only a metric or thumbnail.
images = {}
assert len(renders["renders"]) == 48
for item in renders["renders"]:
    data = (ROOT / item["path"]).read_bytes()
    assert digest(data) == item["fileSHA256"]
    raw = gzip.decompress(data)
    assert digest(raw) == item["rgbaSHA256"]
    pixels = np.frombuffer(raw, dtype=np.uint8).reshape(
        item["height"], item["width"], 4
    )[::-1]
    assert np.all(pixels[:, :, 3] == 255)
    images[(item["scene"], item["mode"], item["variant"])] = pixels[:, :, :3]
    original = next(x for x in benchmark["measurements"] if x["scene"] == item["scene"])
    assert item["uniforms"] == {**original["uniforms"], "uMode": item["mode"]}
for scene, mode in itertools.product(scenes, [0, 1, 2]):
    for label, a, b in comparisons:
        first, second = images[(scene, mode, a)], images[(scene, mode, b)]
        delta = np.abs(first.astype(np.int16) - second.astype(np.int16))
        maximum = delta.max(axis=2)
        image_comparisons.append(
            dict(
                scene=scene,
                mode=mode,
                comparison=label,
                before=a,
                after=b,
                identical=bool(np.array_equal(first, second)),
                pixels=maximum.size,
                changedPixels=int(np.count_nonzero(maximum)),
                pixelsOver1Code=int(np.count_nonzero(maximum > 1)),
                pixelsOver3Codes=int(np.count_nonzero(maximum > 3)),
                pixelsOver13Codes=int(np.count_nonzero(maximum > 13)),
                maxChannelDifferenceCodes=int(maximum.max()),
                meanAbsoluteChannelDifferenceCodes=float(delta.mean()),
            )
        )

canvas = Image.new("RGB", (1440, 310 * 4), "#f6f8f9")
draw = ImageDraw.Draw(canvas)
columns = [
    ("Bernstein loop", None),
    ("Bernstein expansion | difference x8", ("production", "production-unrolled")),
    ("ODM expansion | difference x8", ("odm-loop", "odm-direct")),
]
for i, scene in enumerate(scenes):
    for j, (label, pair) in enumerate(columns):
        if pair is None:
            pixels = images[(scene, 0, "production")]
        else:
            pixels = np.clip(
                np.abs(
                    images[(scene, 0, pair[0])].astype(np.int16)
                    - images[(scene, 0, pair[1])].astype(np.int16)
                )
                * 8,
                0,
                255,
            ).astype(np.uint8)
        picture = Image.fromarray(pixels).resize((480, 270), Image.Resampling.LANCZOS)
        canvas.paste(picture, (j * 480, i * 310 + 36))
        draw.text((j * 480 + 6, i * 310 + 5), scene, fill="#0a232d")
        draw.text((j * 480 + 6, i * 310 + 20), label, fill="#0a232d")
canvas.save(HERE / "figures/traversal-output-comparison.png")

paths = [Path(__file__), HERE / "results/benchmark.json", HERE / "results/renders.json"]
paths += [HERE / f"results/webgl-transport-{name}.json" for name in NAMES]
output = dict(
    effectConvention="Positive percentages mean more GPU time for after relative to before. Percentages use pooled medians; paired block ratios and full timing distributions are also retained. Three blocks are not independent device-level replicates.",
    timingSummaries=summaries,
    effects=effects,
    transport=transport,
    imageMetric="RGB8 output differences; comparison baseline is not independent physical truth. No new numerical corpus.",
    imageComparisons=image_comparisons,
    hashes={str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in paths},
)
(HERE / "results/analysis.json").write_text(
    json.dumps(output, indent=2, allow_nan=False) + "\n"
)
for row in effects:
    print(
        row["scene"], {key: round(row[key]["percent"], 1) for key, _, _ in comparisons}
    )
for comparison in ["bernsteinExpansion", "odmExpansion"]:
    rows = [x for x in image_comparisons if x["comparison"] == comparison]
    print(
        comparison,
        "identical images",
        sum(x["identical"] for x in rows),
        "/",
        len(rows),
        "max channel difference",
        max(x["maxChannelDifferenceCodes"] for x in rows),
    )
