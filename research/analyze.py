#!/usr/bin/env python3
"""Match original-ray roots one-to-one; report failures as well as retained accuracy."""
from functools import lru_cache
from pathlib import Path
import argparse
import hashlib
import json
import math
import numpy as np

ROOT = Path(__file__).resolve().parent
TOLERANCE = 1e-4


def match(expected, actual, tolerance=TOLERANCE):
    """Maximum-cardinality matching, then minimum total relative error.

    Greedy nearest matching can incorrectly fail when two close reference roots
    both match one output but only one of them matches another output.
    Multiplicity is recorded by the reference; this comparison counts distinct
    intersection positions, not repeated copies of an algebraic multiple root.
    """
    costs = [
        (
            [abs(a - e) / max(1, abs(e)) for e in expected]
            if a is not None and math.isfinite(a)
            else [math.inf] * len(expected)
        )
        for a in actual
    ]

    @lru_cache(None)
    def assign(i, mask):
        if i == len(actual):
            return (0, 0.0, ())
        best = assign(i + 1, mask)
        for j, error in enumerate(costs[i]):
            if mask & (1 << j) or error > tolerance:
                continue
            count, total, pairs = assign(i + 1, mask | (1 << j))
            candidate = (count + 1, total + error, ((i, j),) + pairs)
            if (-candidate[0], candidate[1]) < (-best[0], best[1]):
                best = candidate
        return best

    found, _, pairs = assign(0, 0)
    matched = {j for _, j in pairs}
    missing = [e for j, e in enumerate(expected) if j not in matched]
    return {
        "expected": len(expected),
        "found": found,
        "missed": len(missing),
        "false": len(actual) - found,
        "errors": [costs[i][j] for i, j in pairs],
        "missedRoots": missing,
        "failed": bool(missing or len(actual) != found),
        "allOutputErrors": [min(c) for c in costs if c and math.isfinite(min(c))],
        "nonfiniteOutputs": sum(a is None or not math.isfinite(a) for a in actual),
    }


def aggregate(rows, method, stage=None):
    values = [r[method][stage] if stage else r[method] for r in rows]
    errors = [x for v in values for x in v["errors"]]
    all_errors = [x for v in values for x in v["allOutputErrors"]]
    return {
        "rays": len(rows),
        "failedRays": sum(v["failed"] for v in values),
        "expectedRoots": sum(v["expected"] for v in values),
        "matchedRoots": sum(v["found"] for v in values),
        "missedRoots": sum(v["missed"] for v in values),
        "falseRoots": sum(v["false"] for v in values),
        "nonfiniteOutputs": sum(v["nonfiniteOutputs"] for v in values),
        "medianMatchedError": float(np.median(errors)) if errors else None,
        "maxMatchedError": max(errors, default=None),
        "p95AllOutputError": (
            float(np.percentile(all_errors, 95)) if all_errors else None
        ),
        "maxAllOutputError": max(all_errors, default=None),
    }


def analyze(ref, gpu):
    if gpu.get("schemaVersion") != 2:
        raise ValueError("Run the original-ray all-roots experiment before analysis")
    if len(ref["cases"]) != len(gpu["results"]):
        raise ValueError("Reference/GPU case count mismatch")
    methods = [m["id"] for m in gpu["methods"]]
    stages = gpu["stages"]
    rows = []
    for case, actual in zip(ref["cases"], gpu["results"]):
        if case["id"] != actual["id"]:
            raise ValueError("Reference/GPU case order mismatch")
        expected = [float(r["s"]) for r in case["reference"]["roots"]]
        ideal = [float(r["s"]) for r in case["idealReference"]["roots"]]
        row = {
            k: case[k] for k in ["id", "family", "name", "t", "delta", "effectiveDelta"]
        }
        row.update(
            expected=expected,
            ideal=ideal,
            contained=case["reference"].get("contained", False),
        )
        for method in methods:
            row[method] = {
                stage: match(expected, actual[method][stage]) for stage in stages
            }
        row["geometryRounding"] = match(ideal, expected)
        rows.append(row)

    def summarize(selected):
        return {
            **{m: {s: aggregate(selected, m, s) for s in stages} for m in methods},
            "geometryRounding": aggregate(selected, "geometryRounding"),
        }

    groups = {"all": rows}
    groups.update(
        {
            family: [r for r in rows if r["family"] == family]
            for family in ["pole", "tangent", "precision", "rotation"]
        }
    )
    bins = []
    for exponent in range(1, 13):
        selected = [
            r for r in groups["pole"] if abs(float(r["delta"])) == 10**-exponent
        ]
        bins.append(
            {
                "delta": 10**-exponent,
                "roundedToPole": sum(r["effectiveDelta"] == 0 for r in selected),
                **summarize(selected),
            }
        )
    return {
        "schemaVersion": 2,
        "matchingTolerance": TOLERANCE,
        "distanceCutoff": "s > 0; no near bias or finite far cutoff; original ray unchanged",
        "matching": "Maximum cardinality, then minimum total relative-distance error; distinct positions",
        "containedLines": sum(r["contained"] for r in rows),
        "methods": gpu["methods"],
        "stages": stages,
        "summary": {name: summarize(group) for name, group in groups.items()},
        "bins": bins,
        "exactPole": summarize([r for r in groups["pole"] if float(r["delta"]) == 0]),
        "rows": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "results/pole-gpu.json")
    parser.add_argument("--output", type=Path, default=ROOT / "results/analysis.json")
    args = parser.parse_args()
    ref = json.loads((ROOT / "results/reference.json").read_text())
    gpu = json.loads(args.input.read_text())
    # Do not silently analyze a report against changed inputs or solver code.
    for name, digest in gpu["hashes"].items():
        if hashlib.sha256((ROOT.parent / name).read_bytes()).hexdigest() != digest:
            raise ValueError(f"Stale GPU source or input: {name}")
    result = analyze(ref, gpu)
    sources = [
        ROOT / "analyze.py",
        ROOT / "results/reference.json",
        args.input.resolve(),
    ]
    result["hashes"] = {
        str(path.relative_to(ROOT.parent)): hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        for path in sources
    }
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    for method in gpu["methods"]:
        for stage in gpu["stages"]:
            s = result["summary"]["all"][method["id"]][stage]
            print(
                f'{method["id"]:16} {stage:8}: {s["failedRays"]}/{s["rays"]} failed rays; '
                f'{s["matchedRoots"]}/{s["expectedRoots"]} matched, {s["falseRoots"]} spurious'
            )


if __name__ == "__main__":
    main()
