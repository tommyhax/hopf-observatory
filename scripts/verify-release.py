#!/usr/bin/env python3
"""Read-only offline evidence gate; no GPU, network or scientific packages needed."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
STUDY = "research/diagnostics/algorithm1010"
DOCUMENT_REVISION = "48c5166d22b0755ef25f8c31fc37fef4173e85c1"
# Historical evidence hashes documentary editions, while current prose and
# generated editions may change. Each research/provenance/<commit>/<path> file
# is the exact edition of <path> at <commit>; a recorded hash of a document may
# match any archived edition or the current file. Numerical sources still use
# current files only.
PROVENANCE = ROOT / "research/provenance"
EDITIONS = sorted(p for p in PROVENANCE.rglob("*") if p.is_file() and p.name != ".DS_Store")
DOCUMENTS = {Path(*p.relative_to(PROVENANCE).parts[1:]).as_posix() for p in EDITIONS}
REQUIRED_DOCUMENTS = {"PAPER.md", "paper/main.tex", "paper/manuscript.pdf",
                      "web/technical-note.html"}
# Records of superseded trial runs hash experiment sources that were revised
# afterwards. The exact earlier versions are archived in the trial directory;
# a recorded hash must match either the current file or that archived copy.
TRIAL_RECORDS = {
    "research/diagnostics/browser-precision/results/roots-primitives.json":
        "research/diagnostics/browser-precision/trials/construction",
    "research/diagnostics/browser-precision/results/trial-construction.json":
        "research/diagnostics/browser-precision/trials/construction",
    "research/diagnostics/guarded-direct/trials/initial/results/roots.json":
        "research/diagnostics/guarded-direct/trials/initial",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_text())


def require(ok, message):
    if not ok:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-manifest", action="store_true")
    parser.add_argument("--history", action="store_true",
                        help="also compare shipped document snapshots with original Git blobs")
    args = parser.parse_args()
    counts = {"current": 0, "embeddedSource": 0, "historicalDocument": 0, "archivedTrial": 0}
    absent_assets, checked_assets = set(), set()

    def check(name, expected, snapshots=None, archive=None):
        if snapshots and name in snapshots:
            data = snapshots[name].encode()
            kind = "embeddedSource"
        elif name in DOCUMENTS:
            editions = [p for p in EDITIONS if p.relative_to(PROVENANCE).as_posix().endswith("/" + name)]
            matches = [p.read_bytes() for p in editions + [ROOT / name]
                       if p.is_file() and sha(p.read_bytes()) == expected]
            data = matches[0] if matches else b""
            kind = "historicalDocument"
        elif name.startswith("release/"):
            path = ROOT / name
            if not path.is_file():
                absent_assets.add(name)
                return
            require(sha(path.read_bytes()) == expected, f"Historical asset mismatch: {name}")
            checked_assets.add(name)
            return
        else:
            data = (ROOT / name).read_bytes()
            kind = "current"
            if archive and sha(data) != expected:
                prefix = Path(archive).parents[1].as_posix() + "/"
                copy = ROOT / archive / name[len(prefix):] if name.startswith(prefix) else None
                if copy and copy.is_file():
                    data = copy.read_bytes()
                    kind = "archivedTrial"
        require(sha(data) == expected, f"Evidence hash mismatch: {name}")
        counts[kind] += 1

    manifest = ROOT / "MANIFEST.json"
    require(not args.require_manifest or manifest.is_file(), "Release MANIFEST.json required")
    if manifest.is_file():
        data = read("MANIFEST.json")
        required = {"PAPER.md", "paper/main.tex", "paper/manuscript.pdf",
                    "technical-note/technical-note.pdf", "web/shader.js",
                    "scripts/verify-release.py", f"{STUDY}/traversal/MANIFEST.json"}
        require(required <= data["files"].keys(), "Manifest omits required release files")
        for name, expected in data["files"].items():
            path = ROOT / name
            require(path.resolve().is_relative_to(ROOT), f"Unsafe manifest path: {name}")
            require(sha(path.read_bytes()) == expected, f"Release hash mismatch: {name}")
        print(f"Release {data['version']} at {data['sourceCommit']}: {len(data['files'])} file hashes verified.")

    for name in REQUIRED_DOCUMENTS:
        snapshot = PROVENANCE / DOCUMENT_REVISION / name
        require(snapshot.is_file(), f"Missing historical document: {name}")
    if args.history:
        for snapshot in EDITIONS:
            revision, *parts = snapshot.relative_to(PROVENANCE).parts
            name = Path(*parts).as_posix()
            original = subprocess.check_output(["git", "show", f"{revision}:{name}"], cwd=ROOT)
            require(original == snapshot.read_bytes(), f"Git snapshot mismatch: {revision}:{name}")
        print(f"{len(EDITIONS)} archived document editions match their Git revisions.")

    frozen = read("research/diagnostics/grazing/frozen-manifest.json")
    for name, expected in frozen["files"].items():
        check(name, expected)
    # The traversal manifest paths are relative to its own directory.
    for name, expected in read(f"{STUDY}/traversal/MANIFEST.json")["files"].items():
        check(f"{STUDY}/traversal/{name}", expected)
    for path in sorted((ROOT / "research/diagnostics").rglob("results/*.json")):
        record = json.loads(path.read_text())
        archive = TRIAL_RECORDS.get(path.relative_to(ROOT).as_posix())
        snapshots = record.get("sourceSnapshots", {})
        records = [record]
        if path.name == "integration-initial.json":
            records = list(record["reports"].values())
            snapshots = {f"{STUDY}/renderer.mjs": record["rendererSource"]}
        for item in records:
            for key in ["hashes", "sourceHashes", "preservedFileSHA256", "preservedReleaseFilesSHA256"]:
                for name, expected in item.get(key, {}).items():
                    check(name, expected, snapshots, archive)
    # These predecessor records must exist even if no glob found them.
    for name in ["algebraic/results/gpu.json", "algebraic/results/analysis.json",
                 "algorithm1010/results/integration-initial.json"]:
        read(f"research/diagnostics/{name}")
    subprocess.run([sys.executable, str(ROOT / "research/check-evidence.py")], check=True)

    # The historical verifier writes decision.json. Run it only in isolation,
    # with the exact documentary versions it originally hashed, and compare bytes.
    with tempfile.TemporaryDirectory(prefix="hopf-evidence-") as directory:
        isolated = Path(directory).resolve()
        for name in ["research", "docs", "web", "scripts", "tests", "paper"]:
            shutil.copytree(ROOT / name, isolated / name,
                            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.ppm"))
        for name in ["package-lock.json", "playwright.config.js"]:
            shutil.copy2(ROOT / name, isolated / name)
        # Restore the documentary editions that verifier originally hashed:
        # the DOCUMENT_REVISION editions, plus archived editions of any other
        # document it covers (for example the bibliography).
        for snapshot in EDITIONS:
            revision, *parts = snapshot.relative_to(PROVENANCE).parts
            name = Path(*parts).as_posix()
            if revision == DOCUMENT_REVISION or name not in REQUIRED_DOCUMENTS:
                shutil.copy2(snapshot, isolated / name)
        subprocess.run([sys.executable, str(isolated / STUDY / "final/verify-results.py")],
                       cwd=isolated, check=True)
        decision = f"{STUDY}/final/results/decision.json"
        require((isolated / decision).read_bytes() == (ROOT / decision).read_bytes(),
                "Historical adoption decision did not reproduce exactly")

    benchmark = read(f"{STUDY}/traversal/results/benchmark.json")
    analysis = read(f"{STUDY}/traversal/results/analysis.json")
    renders = read(f"{STUDY}/traversal/results/renders.json")
    accepted = read(f"{STUDY}/final/results/webgl-benchmark.json")
    variants = ["production", "production-unrolled", "odm-loop", "odm-direct"]
    require(benchmark["variants"] == variants, "Traversal variants changed")
    require(benchmark["hardware"] == renders["hardware"] == accepted["hardware"], "Hardware mismatch")
    require(benchmark["hardware"]["timerQueryAvailable"], "Missing recorded GPU timer")
    for key in ["shaderHashes", "compiledShaderHashes"]:
        require(benchmark[key] == renders[key], f"Traversal {key} mismatch")
    require(len(benchmark["measurements"]) == 48 and len(analysis["effects"]) == 4,
            "Incomplete traversal timing capture")
    comparisons = [("bernsteinExpansion", variants[0], variants[1]),
                   ("odmExpansion", variants[2], variants[3]),
                   ("solverWithLoop", variants[0], variants[2]),
                   ("solverWithExpansion", variants[1], variants[3]),
                   ("originalMixedTraversal", variants[0], variants[3])]
    for index, effect in enumerate(analysis["effects"]):
        medians = {}
        for variant in variants:
            blocks = sorted([b for b in benchmark["measurements"]
                             if b["scene"] == effect["scene"] and b["variant"] == variant],
                            key=lambda b: b["round"])
            require([b["round"] for b in blocks] == [0, 1, 2], "Missing timing block")
            uniforms = next(b["uniforms"] for b in accepted["measurements"] if b["scene"] == effect["scene"])
            for b in blocks:
                require(not b["disjoint"] and b["frames"] == 10 and b["warmup"] == 5
                        and b["width"] == 1280 and b["height"] == 720
                        and len(b["gpuMilliseconds"]) == len(b["completionMilliseconds"]) == 10
                        and b["uniforms"] == uniforms, "Invalid timing block")
                order = variants[::-1] if (b["round"] + index) % 2 else variants
                require(b["order"] == order and order[b["position"]] == variant, "Timing order mismatch")
            medians[variant] = statistics.median(v for b in blocks for v in b["gpuMilliseconds"])
        for key, before, after in comparisons:
            percent = 100 * (medians[after] / medians[before] - 1)
            require(abs(percent - effect[key]["percent"]) < 1e-10, f"Effect mismatch: {key}")
        print(f"{effect['scene']}: loop-fixed solver cost {effect['solverWithLoop']['percent']:.3f}%")
    for variant in variants:
        report = read(f"{STUDY}/traversal/results/webgl-transport-{variant}.json")
        previous = read(f"{STUDY}/final/results/webgl-transport-{variant}.json")
        require(report["passed"] and report["results"] == previous["results"]
                and report["hardware"] == benchmark["hardware"]
                and report["shaderHashes"]["fragment"] == benchmark["shaderHashes"][variant],
                f"Traversal correctness mismatch: {variant}")
    images = {}
    require(len(renders["renders"]) == 48, "Missing image captures")
    for item in renders["renders"]:
        compressed = (ROOT / item["path"]).read_bytes()
        raw = gzip.decompress(compressed)
        require(sha(compressed) == item["fileSHA256"] and sha(raw) == item["rgbaSHA256"], "Image hash mismatch")
        require(len(raw) == item["width"] * item["height"] * 4, "Image dimensions mismatch")
        images[item["scene"], item["mode"], item["variant"]] = raw
    pairs = 0
    for effect in analysis["effects"]:
        for mode in [0, 1, 2]:
            for _, a, b in comparisons[:2]:
                require(images[effect["scene"], mode, a] == images[effect["scene"], mode, b],
                        "Within-solver image difference")
                pairs += 1
    print(f"{pairs} within-solver image pairs identical; all 48 lossless captures verified.")
    print(f"Hash checks: {counts}; {len(frozen['files'])} frozen baseline hashes verified.")
    print(f"Historical local distribution assets verified: {len(checked_assets)}; unavailable: {len(absent_assets)}.")
    for name in sorted(absent_assets):
        print(f"  NOT CHECKED (not shipped): {name}")
    print("PASS: offline evidence verified; no hardware capture executed or source files written.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"FAIL: {error}")
