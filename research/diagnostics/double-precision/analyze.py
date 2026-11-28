#!/usr/bin/env python3
"""Compare the CPU replay with exact uploaded geometry and exact coefficients."""
from concurrent.futures import ProcessPoolExecutor
from collections import Counter
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import sys

import sympy as sp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location(
    "grazing_exact", HERE.parent / "grazing/analyze.py"
)
exact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exact)
match = exact.match
TOLERANCES = [1e-4, 1e-6, 1e-8, 1e-10, 1e-12]
METHODS = [
    "gpu32Raw", "gpu32Refined", "coefficients32Exact", "coefficients32Solve64",
    "coefficients64Exact", "coefficients64Solve64",
]


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_hashes(hashes):
    for name, expected in hashes.items():
        actual = hash_file(ROOT / name)
        if actual != expected:
            raise ValueError(f"Changed source/input: {name}")


def checks(expected, actual):
    return {str(t): match(expected, actual, t) for t in TOLERANCES}


def check_reference(stored, recomputed):
    """Require matching multiplicities and overlapping exact rational brackets."""
    if len(stored) != len(recomputed):
        raise ValueError("Recomputed reference has a different root count")
    for old, new in zip(stored, recomputed):
        a, b = map(sp.Rational, old["bracket"])
        c, d = map(sp.Rational, new["sBracket"])
        if old["multiplicity"] != new["multiplicity"] or max(a, c) > min(b, d):
            raise ValueError("Recomputed reference disagrees with an exact stored bracket")


def analyze_case(item):
    case, capture, old = item
    reference = exact.exact_positive(exact.polynomial(case["P"], case["c"], case["o"], case["d"]))
    check_reference(case["reference"]["roots"], reference)
    expected = exact.positions(reference)
    constructed = capture["construct64Solve64"]
    k, L = map(exact.rational, (constructed["k"], constructed["L"]))
    charts = []
    for chart in constructed["charts"]:
        coefficients = exact.bernstein_to_power(list(map(exact.rational, chart["b"])))
        charts.append({
            "chart": chart["chart"],
            "powerCoefficients": [str(c) for c in coefficients],
            "roots": exact.chart_roots(coefficients, k, L, chart["chart"]),
        })
    exact64 = exact.positions([r for chart in charts for r in chart["roots"]])
    exact32 = old["methods"]["compactified"]["roots"]["coefficients"]
    # Check captured-coefficient controls against their previously archived exact values.
    for chart in capture["solve64Only"]["charts"]:
        coefficients = exact.bernstein_to_power(list(map(exact.rational, chart["b"])))
        archived = old["chartReferences"][chart["chart"]]["bernsteinPowerCoefficients"]
        if tuple(coefficients) != tuple(map(sp.Rational, archived)):
            raise ValueError(f"Captured binary32 coefficient mismatch: {case['id']}")
    roots = {
        "gpu32Raw": capture["gpu32Raw"],
        "gpu32Refined": capture["gpu32Refined"],
        "coefficients32Exact": exact32,
        "coefficients32Solve64": capture["solve64Only"]["roots"],
        "coefficients64Exact": exact64,
        "coefficients64Solve64": constructed["roots"],
    }
    return {
        "id": case["id"], "configuration": case["configuration"],
        "offset": case["offset"], "intendedExactTangent": case["exactTangent"],
        "expected": expected, "exactReference": reference,
        "exact64Charts": charts,
        "methods": {name: {"roots": values, "checks": checks(expected, values)}
                    for name, values in roots.items()},
        "solverVsOwnCoefficients": {
            "binary32": checks(exact32, roots["coefficients32Solve64"]),
            "binary64": checks(exact64, roots["coefficients64Solve64"]),
        },
        "inputQuantization": checks(exact.positions(case["idealReference"]["roots"]), expected),
    }


def summarize(rows, get_check, get_roots=None):
    values = [get_check(row) for row in rows]
    errors = [e for value in values for e in value["errors"]]
    failed = [row["id"] for row, value in zip(rows, values) if value["failed"]]
    categories = Counter()
    if get_roots is not None:
        for row, value in zip(rows, values):
            if value["failed"]:
                n, expected = len(get_roots(row)), value["expected"]
                categories["shortfall" if n < expected else "excess" if n > expected else "position"] += 1
    return {
        "queries": len(rows), "failedQueries": len(failed), "failedIds": failed,
        "expectedRoots": sum(v["expected"] for v in values),
        "matchedRoots": sum(v["found"] for v in values),
        "missingRoots": sum(v["missed"] for v in values),
        "unmatchedOutputs": sum(v["false"] for v in values),
        "nonfiniteOutputs": sum(v["nonfiniteOutputs"] for v in values),
        "maxMatchedRelativeError": max(errors, default=None),
        "failureCategories": dict(categories),
    }


def build_summary(rows):
    by_tolerance = {}
    for tolerance in TOLERANCES:
        key = str(tolerance)
        by_tolerance[key] = {
            name: summarize(rows, lambda r: r["methods"][name]["checks"][key],
                            lambda r: r["methods"][name]["roots"])
            for name in METHODS
        }
    principal = by_tolerance[str(TOLERANCES[0])]
    baseline = set(principal["gpu32Refined"]["failedIds"])
    for summary in principal.values():
        failed = set(summary["failedIds"])
        summary["recoveredOriginalFailures"] = len(baseline - failed)
        summary["regressionsOnOriginalPasses"] = len(failed - baseline)
        summary["regressionIds"] = sorted(failed - baseline)
    return {
        "byTolerance": by_tolerance,
        "solverVsOwnCoefficients": {
            precision: {str(t): summarize(rows, lambda r: r["solverVsOwnCoefficients"][precision][str(t)])
                        for t in TOLERANCES}
            for precision in ["binary32", "binary64"]
        },
        "inputQuantization": {str(t): summarize(rows, lambda r: r["inputQuantization"][str(t)])
                              for t in TOLERANCES},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    if args.verify_only:
        report = json.loads((HERE / "results/analysis.json").read_text())
        verify_hashes(report["hashes"])
        if build_summary(report["rows"]) != report["summary"]:
            raise ValueError("Stored summary does not match its per-query records")
        print("All captured source/input hashes and per-query summaries verified.")
        return

    capture = json.loads((HERE / "results/cpu.json").read_text())
    hashes = {
        **capture["hashes"],
        (HERE / "results/cpu.json").relative_to(ROOT).as_posix(): hash_file(HERE / "results/cpu.json"),
    }
    verify_hashes(hashes)
    reference = json.loads((ROOT / "research/results/stress-reference.json").read_text())
    prior = json.loads((HERE.parent / "grazing/results/analysis.json").read_text())
    cases = {c["id"]: c for c in reference["cases"] if c["family"] == "tangent"}
    old = {r["id"]: r for r in prior["rows"]}
    ids = [r["id"] for r in capture["rows"]]
    if len(ids) != 600 or set(ids) != set(cases) or len(set(ids)) != 600:
        raise ValueError("Expected all 600 grazing queries exactly once")
    items = [(cases[r["id"]], r, old[r["id"]]) for r in capture["rows"]]
    rows = []
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for row in pool.map(analyze_case, items, chunksize=5):
            rows.append(row)
            if len(rows) % 50 == 0:
                print(f"Exact binary64 construction check {len(rows)}/600", flush=True)
    summary = build_summary(rows)
    primary = summary["byTolerance"]["0.0001"]
    if primary["gpu32Refined"]["failedIds"] != prior["summary"]["compactified"]["stages"]["accepted"]["failedIds"]:
        raise ValueError("Frozen baseline failed-ID set changed")
    assert primary["gpu32Refined"]["failedQueries"] == 109
    assert primary["gpu32Refined"]["expectedRoots"] == 584
    verify_hashes(hashes)
    report = {
        "schemaVersion": 1, "experimentDate": "2026-11-28",
        "python": sys.version, "sympy": sp.__version__, "node": capture["runtime"],
        "matching": "Maximum cardinality then minimum relative-distance error; distinct roots",
        "tolerances": TOLERANCES, "exactCoordinateBracketWidth": str(exact.EPS),
        "recomputedReferenceQueries": len(rows),
        "inheritedMismatches": capture["inheritedMismatches"],
        "summary": summary, "representativeIds": [1201, 1257, 1260, 1311],
        "rows": rows, "hashes": hashes,
    }
    (HERE / "results/analysis.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    for name, data in primary.items():
        print(f"{name:25}: {data['failedQueries']}/600 failed; "
              f"{data['matchedRoots']}/584 roots; {data['unmatchedOutputs']} unmatched; "
              f"max matched error {data['maxMatchedRelativeError']}")


if __name__ == "__main__":
    main()
