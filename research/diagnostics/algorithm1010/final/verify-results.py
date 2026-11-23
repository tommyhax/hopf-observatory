"""Verify the bounded decision against final sources and preserved historical evidence."""

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
STUDY = HERE.parent


def read(path):
    return json.loads(path.read_text())


def sha(data):
    return hashlib.sha256(data).hexdigest()


checked = 0
for path in sorted((STUDY / "results").glob("*.json")) + sorted(
    (HERE / "results").glob("*.json")
):
    if path.name == "decision.json":
        continue
    record = read(path)
    records = [record]
    snapshots = record.get("sourceSnapshots", {})
    if path.name == "integration-initial.json":
        records = list(record["reports"].values())
        snapshots = {
            "research/diagnostics/algorithm1010/renderer.mjs": record["rendererSource"]
        }
    for item in records:
        for group in ["hashes", "sourceHashes"]:
            for name, digest in item.get(group, {}).items():
                content = (
                    snapshots[name].encode()
                    if name in snapshots
                    else (ROOT / name).read_bytes()
                )
                assert sha(content) == digest, (path.name, name)
                checked += 1

frozen = read(ROOT / "research/diagnostics/grazing/frozen-manifest.json")
for name, digest in frozen["files"].items():
    assert sha((ROOT / name).read_bytes()) == digest, name

native = read(STUDY / "results/benchmark.json")
browser = read(HERE / "results/webgl-benchmark.json")
root_replay = read(HERE / "results/webgl-roots.json")
previous = read(STUDY / "results/webgl.json")
assert len(root_replay["sanity"]) == 54 and all(
    x["pass"] for x in root_replay["sanity"]
)
assert len(root_replay["results"]["original"]) == 867
assert root_replay["results"]["original"] == previous["results"]["original"]
assert native["shaderHashes"]["odm-direct"] == browser["shaderHashes"]["odm-direct"]

grazing = read(ROOT / "research/diagnostics/grazing/results/analysis.json")
old_ids = sorted(
    row["id"]
    for row in grazing["rows"]
    if row["methods"]["compactified"]["matches"]["accepted"]["failed"]
)
coefficient_ids = sorted(
    row["id"]
    for row in grazing["rows"]
    if row["methods"]["compactified"]["matches"]["coefficients"]["failed"]
)
assert old_ids == coefficient_ids and len(old_ids) == 109
analysis = read(STUDY / "results/analysis.json")
for name in ["bernstein", "odm_direct", "odm_charts"]:
    for stage in ["raw", "polished"]:
        assert (
            sorted(analysis["corpora"]["stress"]["failedIds"][name][stage]) == old_ids
        )
        assert not analysis["corpora"]["original"]["failedIds"][name][stage]

transport = {}
for backend in ["native", "webgl"]:
    for variant in ["production", "production-unrolled", "odm-loop", "odm-direct"]:
        report = read(HERE / f"results/{backend}-transport-{variant}.json")
        expected = not (backend == "native" and variant == "odm-loop")
        assert report["passed"] == expected, (backend, variant)
        if variant in ["production", "odm-direct"]:
            assert (
                report["shaderHashes"]["fragment"] == browser["shaderHashes"][variant]
            )
        transport[f"{backend}/{variant}"] = dict(
            passed=report["passed"],
            suites={
                k: dict(passed=v["passed"], total=v["total"])
                for k, v in report["results"].items()
            },
        )
initial = read(STUDY / "results/integration-initial.json")["reports"]["odm-direct"]
for backend in ["native", "webgl"]:
    assert (
        read(HERE / f"results/{backend}-transport-production.json")["results"]
        == read(HERE / f"results/{backend}-transport-production-unrolled.json")[
            "results"
        ]
    )
loop = read(HERE / "results/native-transport-odm-loop.json")
assert initial["shaderHashes"] == loop["shaderHashes"]
assert initial["results"] == loop["results"], "Native failing control did not reproduce"

pixels = read(HERE / "results/pixel-analysis.json")
assert len(pixels["reports"]) == 8 and all(x["passed"] for x in pixels["reports"])
comparison = []
for before, after in zip(browser["summaries"][::2], browser["summaries"][1::2]):
    assert before["scene"] == after["scene"]
    scene = before["scene"]
    native_before = next(
        x
        for x in native["summaries"]
        if x["scene"] == scene and x["width"] == 1280 and x["variant"] == "production"
    )["median"]
    native_after = next(
        x
        for x in native["summaries"]
        if x["scene"] == scene and x["width"] == 1280 and x["variant"] == "odm-direct"
    )["median"]
    comparison.append(
        dict(
            scene=scene,
            nativeBernsteinMs=native_before,
            nativeOdmMs=native_after,
            nativeReductionPercent=100 * (1 - native_after / native_before),
            webglBernsteinMs=before["gpuMedianMilliseconds"],
            webglOdmMs=after["gpuMedianMilliseconds"],
            webglReductionPercent=100
            * (1 - after["gpuMedianMilliseconds"] / before["gpuMedianMilliseconds"]),
        )
    )
assert all(
    row["webglReductionPercent"] < -10 for row in comparison[1:]
), "Adoption report needs reconsideration"
assert browser["hardware"]["timerQueryAvailable"]
for block in browser["measurements"]:
    assert (
        block["frames"] == 10
        and len(block["gpuMilliseconds"]) == len(block["completionMilliseconds"]) == 10
    )

files = [
    Path(__file__),
    HERE / "README.md",
    ROOT / "PAPER.md",
    ROOT / "paper/references.bib",
    ROOT / "paper/main.tex",
    ROOT / "paper/manuscript.pdf",
    ROOT / "research/diagnostics/grazing/frozen-manifest.json",
    ROOT / "research/diagnostics/grazing/results/analysis.json",
]
files += sorted(
    p for p in (HERE / "results").glob("*.json") if p.name != "decision.json"
)
output = dict(
    decision="retain as experimental",
    reason="Correctness checks pass with expanded traversal, but completed-frame WebGL GPU timing regresses materially in all three shell workloads. Keep production Bernstein.",
    comparedFrameTimes=comparison,
    originalRayReplayExact=True,
    polynomialFixturesPassed=54,
    nativeGrazingFailedIds=old_ids,
    nativeGrazingIdsMatchCapturedCoefficients=True,
    transport=transport,
    pixelReferenceChecksPassed=True,
    nativeLoopFailureExactlyReproduced=True,
    verifiedHistoricalAndCurrentHashEntries=checked,
    frozenBaselinePathsUnchanged=len(frozen["files"]),
    hashes={str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in files},
)
(HERE / "results/decision.json").write_text(
    json.dumps(output, indent=2, allow_nan=False) + "\n"
)
print("Verified", checked, "recorded hashes and", len(frozen["files"]), "frozen paths.")
print(
    "54 fixtures; 867 exact ray replays; identical 109 native grazing IDs; optical suites and expected failing control verified."
)
print("Decision:", output["decision"])
