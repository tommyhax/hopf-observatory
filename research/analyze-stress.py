#!/usr/bin/env python3
"""Report failures without consolidating close contacts or treating residuals as truth."""
from collections import Counter
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from analyze import match, aggregate

ROOT = Path(__file__).resolve().parent.parent
TOLERANCES = [1e-4, 1e-5, 1e-6]


def main():
    ref = json.loads((ROOT / "research/results/stress-reference.json").read_text())
    gpu = json.loads((ROOT / "research/results/stress-gpu.json").read_text())
    for source in [ref, gpu]:
        for p, h in source["hashes"].items():
            assert hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h, p
    assert len(ref["cases"]) == len(gpu["results"]) == 2400
    results = {}
    representatives = []
    for tolerance in TOLERANCES:
        rows = []
        for case, actual in zip(ref["cases"], gpu["results"]):
            assert case["id"] == actual["id"]
            expected = [float(r["s"]) for r in case["reference"]["roots"]]
            ideal = [float(r["s"]) for r in case["idealReference"]["roots"]]
            gaps = [
                (b - a) / max(1, abs(a), abs(b)) for a, b in zip(expected, expected[1:])
            ]
            conditions = [
                float(r["conditionProxy"])
                for r in case["reference"]["roots"]
                if r["conditionProxy"] is not None
            ]
            row = dict(
                id=case["id"],
                family=case["family"],
                expected=expected,
                geometryRounding=match(ideal, expected, tolerance),
                multiple=any(r["multiplicity"] > 1 for r in case["reference"]["roots"]),
                close=bool(gaps and min(gaps) < 1e-4),
                illConditioned=bool(conditions and max(conditions) > 1e4),
                far=bool(expected and max(expected) > 1e7),
                nearOrigin=bool(expected and min(expected) < 1e-3),
                roundedPole=case["effectiveDelta"] == 0,
            )
            for method in gpu["methods"]:
                row[method] = {
                    stage: match(expected, actual[method][stage], tolerance)
                    for stage in gpu["stages"]
                }
                for stage in gpu["stages"]:
                    values = actual[method][stage]
                    result = row[method][stage]
                    result["countDifference"] = len(values) - len(expected)
                    absolute, relative = [], []
                    for value in values:
                        if value is None or not expected:
                            continue
                        nearest = min(expected, key=lambda s: abs(s - value))
                        distance = abs(value - nearest) * math.hypot(*case["d"])
                        position = [
                            o + nearest * d for o, d in zip(case["o"], case["d"])
                        ]
                        absolute.append(distance)
                        relative.append(distance / max(1, math.hypot(*position)))
                    result["nearestPositionAbsolute"] = absolute
                    result["nearestPositionRelative"] = relative
            rows.append(row)
        families = ["all", *sorted(set(r["family"] for r in rows))]
        summary = {}
        for family in families:
            selected = (
                rows if family == "all" else [r for r in rows if r["family"] == family]
            )
            summary[family] = {
                m: {s: aggregate(selected, m, s) for s in gpu["stages"]}
                for m in gpu["methods"]
            }
            summary[family]["geometryRounding"] = aggregate(
                selected, "geometryRounding"
            )
            for method in gpu["methods"]:
                for stage in gpu["stages"]:
                    result = summary[family][method][stage]
                    for key in ["nearestPositionAbsolute", "nearestPositionRelative"]:
                        errors = [
                            x for row in selected for x in row[method][stage][key]
                        ]
                        result[key] = dict(
                            p50=float(np.median(errors)) if errors else None,
                            p95=float(np.percentile(errors, 95)) if errors else None,
                            maximum=max(errors, default=None),
                        )
        breakdown = {}
        for method in gpu["methods"]:
            failed = [r for r in rows if r[method]["polished"]["failed"]]
            # Diagnostic flags overlap; no claim of a unique numerical cause.
            breakdown[method] = {
                "failedIds": [r["id"] for r in failed],
                "flags": {
                    flag: sum(r[flag] for r in failed)
                    for flag in [
                        "multiple",
                        "close",
                        "illConditioned",
                        "far",
                        "nearOrigin",
                        "roundedPole",
                    ]
                },
                "byFamily": dict(Counter(r["family"] for r in failed)),
                "countShortfall": sum(
                    r[method]["polished"]["countDifference"] < 0 for r in failed
                ),
                "countExcess": sum(
                    r[method]["polished"]["countDifference"] > 0 for r in failed
                ),
                "equalCountPositionFailure": sum(
                    r[method]["polished"]["countDifference"] == 0 for r in failed
                ),
            }
        shell_groups = {}
        for method in gpu["methods"]:
            bad = []
            reordered = []
            for group in ref["shellGroups"]:
                ids = group["cases"]
                if any(rows[i][method]["polished"]["failed"] for i in ids):
                    bad.append(group["id"])
                    continue
                # Match each boundary independently, then compare event ordering.
                expected = sorted((s, i) for i in ids for s in rows[i]["expected"])
                actual = sorted(
                    (s, i) for i in ids for s in gpu["results"][i][method]["polished"]
                )
                if [i for _, i in expected] != [i for _, i in actual]:
                    reordered.append(group["id"])
            shell_groups[method] = dict(
                groups=100,
                incompleteBoundaryGroups=bad,
                reorderedCompleteGroups=reordered,
            )
        results[str(tolerance)] = {
            "summary": summary,
            "failureDistributions": breakdown,
            "shellGroups": shell_groups,
        }
        if tolerance == TOLERANCES[0]:
            # Save every failed case's outputs by ID; full inputs/brackets are in reference.
            failures = []
            for row in rows:
                if any(row[m]["polished"]["failed"] for m in gpu["methods"]):
                    failures.append({**row, "actual": gpu["results"][row["id"]]})
            results[str(tolerance)]["failures"] = failures
            seen = set()
            for row in failures:
                for method in gpu["methods"]:
                    difference = row[method]["polished"]["countDifference"]
                    kind = (
                        "count shortfall"
                        if difference < 0
                        else "count excess" if difference > 0 else "position"
                    )
                    if (
                        row[method]["polished"]["failed"]
                        and (row["family"], method, kind) not in seen
                    ):
                        seen.add((row["family"], method, kind))
                        representatives.append(
                            dict(
                                id=row["id"],
                                family=row["family"],
                                method=method,
                                kind=kind,
                                expected=row["expected"],
                                actual=row["actual"][method]["polished"],
                                diagnostic=row[method]["polished"],
                            )
                        )
        for method in gpu["methods"]:
            v = summary["all"][method]["polished"]
            print(
                tolerance,
                method,
                v["failedRays"],
                "failed;",
                v["matchedRoots"],
                "matched;",
                v["missedRoots"],
                "missing;",
                v["falseRoots"],
                "unmatched",
            )
    files = [
        "research/analyze-stress.py",
        "research/analyze.py",
        "research/results/stress-reference.json",
        "research/results/stress-gpu.json",
    ]
    report = dict(
        seed=ref["seed"],
        baselineRevision=ref["baselineRevision"],
        tolerances=TOLERANCES,
        metric="abs(sGPU-sReference)/max(1,abs(sReference)); distinct positions; maximum-cardinality matching with no proximity merge",
        conditioning="coefficient-relative polynomial condition proxy sum(abs(ak)*abs(s)^k)/(max(1,abs(s))*abs(pDerivative(s))); multiple roots flagged separately; overlapping diagnostic flags are not a causal attribution",
        results=results,
        representativeFailures=representatives,
        hashes={p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files},
    )
    (ROOT / "research/results/stress-analysis.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n"
    )


if __name__ == "__main__":
    main()
