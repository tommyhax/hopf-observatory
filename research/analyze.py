#!/usr/bin/env python3
from pathlib import Path
import json, math
import numpy as np

ROOT = Path(__file__).resolve().parent
ref = json.loads((ROOT / "results/reference.json").read_text())
gpu = json.loads((ROOT / "results/pole-gpu.json").read_text())


def match(expected, actual):
    remaining = list(enumerate(expected))
    errors = []
    misses = []
    false = 0
    for a in actual:
        if a is None or not math.isfinite(a):
            false += 1
            continue
        if not remaining:
            false += 1
            continue
        index, minerr = min(
            ((j, abs(a - e) / max(1, e)) for j, (i, e) in enumerate(remaining)),
            key=lambda v: v[1],
        )
        if minerr <= 1e-4:
            errors.append(minerr)
            remaining.pop(index)
        else:
            false += 1
    return {
        "expected": len(expected),
        "found": len(errors),
        "missed": len(remaining),
        "false": false,
        "errors": errors,
        "missedRoots": [e for _, e in remaining],
        "failed": bool(remaining or false),
    }


assert len(ref["cases"]) == len(gpu["results"]), "Reference/GPU case count mismatch"
rows = []
for case, actual in zip(ref["cases"], gpu["results"]):
    assert case["id"] == actual["id"], "Reference/GPU case order mismatch"
    cutoff = 0.5 * 4e-4 * max(1, math.dist(case["o"], [0, 0, 0]))
    expected = [
        float(r["s"]) for r in case["reference"]["roots"] if float(r["s"]) > cutoff
    ]
    ideal = [
        float(r["s"]) for r in case["idealReference"]["roots"] if float(r["s"]) > cutoff
    ]
    row = {k: case[k] for k in ["id", "family", "name", "t", "delta", "effectiveDelta"]}
    row["expected"] = expected
    row["ideal"] = ideal
    for method in ["compactified", "ferrari"]:
        row[method] = match(expected, actual[method])
    for method in ["compactified", "ferrari"]:
        row[method]["allOutputErrors"] = [
            min(abs(a - e) / max(1, e) for e in expected)
            for a in actual[method]
            if a is not None and expected
        ]
    row["geometryRounding"] = match(ideal, expected)
    rows.append(row)


def aggregate(rows, method):
    values = [r[method] for r in rows]
    errors = [x for v in values for x in v["errors"]]
    all_errors = [x for v in values for x in v.get("allOutputErrors", [])]
    return {
        "p95AllOutputError": (
            float(np.percentile(all_errors, 95)) if all_errors else None
        ),
        "maxAllOutputError": max(all_errors, default=None),
        "rays": len(rows),
        "failedRays": sum(v["failed"] for v in values),
        "expectedRoots": sum(v["expected"] for v in values),
        "matchedRoots": sum(v["found"] for v in values),
        "missedRoots": sum(v["missed"] for v in values),
        "falseRoots": sum(v["false"] for v in values),
        "medianMatchedError": float(np.median(errors)) if errors else None,
        "maxMatchedError": max(errors, default=None),
    }


summary = {}
for group, subset in [
    ("all", rows),
    ("pole", [r for r in rows if r["family"] == "pole"]),
    ("tangent", [r for r in rows if r["family"] == "tangent"]),
    ("precision", [r for r in rows if r["family"] == "precision"]),
    ("rotation", [r for r in rows if r["family"] == "rotation"]),
]:
    summary[group] = {
        m: aggregate(subset, m) for m in ["compactified", "ferrari", "geometryRounding"]
    }
bins = []
for exponent in range(1, 13):
    selected = [
        r
        for r in rows
        if r["family"] == "pole" and abs(float(r["delta"])) == 10**-exponent
    ]
    bins.append(
        {
            "delta": 10**-exponent,
            "roundedToPole": sum(r["effectiveDelta"] == 0 for r in selected),
            **{
                m: aggregate(selected, m)
                for m in ["compactified", "ferrari", "geometryRounding"]
            },
        }
    )
exact = [r for r in rows if r["family"] == "pole" and float(r["delta"]) == 0]
result = {
    "matchingTolerance": 1e-4,
    "distanceCutoff": "0.0002*max(1,|origin|), no finite far cutoff",
    "summary": summary,
    "bins": bins,
    "exactPole": {
        m: aggregate(exact, m) for m in ["compactified", "ferrari", "geometryRounding"]
    },
    "rows": rows,
}
(ROOT / "results/analysis.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(summary, indent=2))
for b in bins:
    print(
        b["delta"],
        b["compactified"]["failedRays"],
        b["ferrari"]["failedRays"],
        "rounded",
        b["roundedToPole"],
    )
