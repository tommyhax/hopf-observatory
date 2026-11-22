#!/usr/bin/env python3
"""Exact stage substitutions for the frozen grazing corpus; no production imports."""
from concurrent.futures import ProcessPoolExecutor
from collections import Counter
from functools import lru_cache
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import struct
import sys
import sympy as sp

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "research"))
# Avoid the name collision with this diagnostic's analyze.py.
spec = importlib.util.spec_from_file_location(
    "frozen_matching", ROOT / "research/analyze.py"
)
matching = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matching)
match = matching.match
from reference import polynomial, rational

X = sp.Symbol("s")
EPS = sp.Rational(1, 10**40)
TOL = 1e-4
STAGES = [
    "centeredRay",
    "chartExactA",
    "chartRoundedA",
    "coefficients",
    "isolated",
    "refinedUnfiltered",
    "accepted",
]


def verify(hashes):
    for name, digest in hashes.items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name


def form_coefficients(vectors, A):
    out = [sp.S(0)] * 5
    for i in range(4):
        for j in range(4):
            for m in range(3):
                for n in range(3):
                    out[m + n] += A[i][j] * vectors[m][i] * vectors[n][j]
    return tuple(out)


def bernstein_to_power(b):
    out = [sp.S(0)] * 5
    for i in range(5):
        for j in range(5 - i):
            out[i + j] += b[i] * sp.binomial(4, i) * sp.binomial(4 - i, j) * (-1) ** j
    return tuple(out)


@lru_cache(maxsize=256)
def isolate(coefficients, direct):
    p = sp.Poly.from_list(list(coefficients)[::-1], X, domain=sp.QQ)
    if p.is_zero:
        return []
    bounds = {} if direct else dict(inf=0, sup=1)
    return sp.polys.polytools.intervals(p, eps=EPS, **bounds)


def chart_roots(coefficients, k, L, chart):
    result = []
    direct = chart == 4
    far = chart in (1, 3)
    sign = -1 if chart < 2 else 1
    for (a, b), multiplicity in isolate(tuple(coefficients), direct):
        if not direct:
            if far and a == b == 0:
                continue
            if not far and sign < 0 and a == b == 0:
                continue

        def distance(x):
            return (L * x if direct else sign * (L / x if far else L * x)) - k

        # Zero is an exact endpoint root and excluded above for reciprocal charts.
        assert not far or a > 0
        lo, hi = sorted([distance(a), distance(b)])
        middle = (lo + hi) / 2
        if middle <= 0:
            continue
        result.append(
            dict(
                s=str(sp.N(middle, 65)),
                multiplicity=multiplicity,
                xBracket=[str(a), str(b)],
                sBracket=[str(lo), str(hi)],
                chart=chart,
            )
        )
    return result


def positions(roots):
    return sorted(set(float(r["s"]) for r in roots))


def exact_positive(p):
    if p.is_zero:
        return []
    return [
        dict(s=str(sp.N((a + b) / 2, 65)), multiplicity=m, sBracket=[str(a), str(b)])
        for (a, b), m in sp.polys.polytools.intervals(p, eps=EPS, inf=0)
        if a + b > 0
    ]


def summarize_match(expected, actual):
    value = match(expected, actual, TOL)
    return {
        k: v
        for k, v in value.items()
        if k not in ["errors", "allOutputErrors", "missedRoots"]
    }


def analyze_case(item):
    case, capture = item
    P = [[rational(v) for v in row] for row in case["P"]]
    c = rational(case["c"])
    exactA = [[P[i][j] - (c if i == j else 0) for j in range(4)] for i in range(4)]
    roundedA = [[rational(capture["A"][4 * j + i]) for j in range(4)] for i in range(4)]
    k, L = map(rational, capture["geometry"][:2])
    center = list(map(rational, capture["geometry"][4:7]))
    direction = list(map(rational, case["d"]))
    new_origin = [center[i] + k * direction[i] for i in range(3)]
    centered = exact_positive(polynomial(case["P"], case["c"], new_origin, direction))
    expected = positions(case["reference"]["roots"])
    chart_data = []
    for chart in capture["charts"]:
        idx = chart["chart"]
        a, b, h = [list(map(rational, chart["vectors"][i : i + 4])) for i in (0, 4, 8)]
        v = [a, b, h]
        values = list(map(rational, chart["coefficients"]))
        power = tuple(values[:5])
        bernstein = tuple(values[8:12] + [values[5]])
        data = dict(
            chart=idx,
            exactA=chart_roots(form_coefficients(v, exactA), k, L, idx),
            roundedA=chart_roots(form_coefficients(v, roundedA), k, L, idx),
            power=chart_roots(power, k, L, idx),
            bernstein=chart_roots(bernstein_to_power(bernstein), k, L, idx),
            powerCoefficients=[str(v) for v in power],
            bernsteinPowerCoefficients=[str(v) for v in bernstein_to_power(bernstein)],
        )
        chart_data.append(data)
    methods = {}
    for name, data in capture["methods"].items():
        ids = [4] if name == "yuksel_direct" else [0, 1, 2, 3]
        coefficients = "bernstein" if name == "compactified" else "power"
        stage_roots = {"centeredRay": positions(centered)}
        for stage, key in [
            ("chartExactA", "exactA"),
            ("chartRoundedA", "roundedA"),
            ("coefficients", coefficients),
        ]:
            stage_roots[stage] = positions([r for i in ids for r in chart_data[i][key]])
        stage_roots["isolated"] = data["raw"]
        before = []
        removed = []
        changed = []
        for probe in data["probes"]:
            for i in range(4):
                x = probe["trace"][i]
                if x is None or x > 3e38:
                    continue
                after_x = probe["trace"][4 + i]
                s = probe["trace"][12 + i]
                far = (
                    (abs(x) > 1)
                    if name == "yuksel_direct"
                    else probe["chart"] in (1, 3)
                )
                negative = (x < 0) if name == "yuksel_direct" else probe["chart"] < 2
                owned = not (far and after_x <= 0) and (
                    name == "yuksel_direct"
                    or not (negative and not far and after_x == 0)
                )
                if owned and s is not None and s > 0 and math.isfinite(s):
                    before.append(s)
                    if probe["acceptance"][12 + i] != 1:
                        removed.append(
                            dict(
                                s=s,
                                residual=probe["acceptance"][4 + i],
                                chart=probe["chart"],
                            )
                        )
                if probe["trace"][8 + i] != s:
                    changed.append(
                        dict(
                            before=probe["trace"][8 + i], after=s, chart=probe["chart"]
                        )
                    )
        stage_roots["refinedUnfiltered"] = sorted(set(before))
        stage_roots["accepted"] = data["polished"]
        methods[name] = dict(
            roots=stage_roots,
            matches={s: summarize_match(expected, v) for s, v in stage_roots.items()},
            isolationVsCoefficients=summarize_match(
                stage_roots["coefficients"], data["raw"]
            ),
            rejected=removed,
            refinementChanges=changed,
            noMerge=(
                {s: summarize_match(expected, v) for s, v in capture["noMerge"].items()}
                if name == "compactified"
                else None
            ),
        )
    return dict(
        id=case["id"],
        configuration=case["configuration"],
        offset=case["offset"],
        exactIntendedTangent=case["exactTangent"],
        expected=expected,
        intended=positions(case["idealReference"]["roots"]),
        centeredReference=centered,
        chartReferences=chart_data,
        methods=methods,
    )


def main():
    frozen = json.loads((HERE / "frozen-manifest.json").read_text())
    gpu = json.loads((HERE / "results/gpu.json").read_text())
    verify(frozen["files"])
    verify(gpu["hashes"])
    reference = json.loads(
        (ROOT / "research/results/stress-reference.json").read_text()
    )
    cases = {c["id"]: c for c in reference["cases"]}
    items = [(cases[r["id"]], r) for r in gpu["results"]]
    rows = []
    with ProcessPoolExecutor(max_workers=6) as pool:
        for row in pool.map(analyze_case, items, chunksize=5):
            rows.append(row)
            if len(rows) % 50 == 0:
                print(f"Exact stage replay {len(rows)}/600", flush=True)
    summary = {}
    for name in gpu["methods"]:
        final_failed = {
            r["id"] for r in rows if r["methods"][name]["matches"]["accepted"]["failed"]
        }
        stages = {}
        for s in STAGES:
            values = [r["methods"][name]["matches"][s] for r in rows]
            bad = {r["id"] for r in rows if r["methods"][name]["matches"][s]["failed"]}
            stages[s] = dict(
                failedQueries=len(bad),
                failedIds=sorted(bad),
                finalFailuresAlreadyDiscrepant=len(bad & final_failed),
                expectedRoots=sum(v["expected"] for v in values),
                matchedRoots=sum(v["found"] for v in values),
                missingRoots=sum(v["missed"] for v in values),
                unmatchedOutputs=sum(v["false"] for v in values),
                failureCounts=dict(
                    Counter(
                        (
                            "shortfall"
                            if len(r["methods"][name]["roots"][s]) < len(r["expected"])
                            else (
                                "excess"
                                if len(r["methods"][name]["roots"][s])
                                > len(r["expected"])
                                else "position"
                            )
                        )
                        for r in rows
                        if r["id"] in bad
                    )
                ),
            )
        summary[name] = dict(
            stages=stages,
            isolationVsCoefficientsFailedQueries=sum(
                r["methods"][name]["isolationVsCoefficients"]["failed"] for r in rows
            ),
            residualRejectedCandidates=sum(
                len(r["methods"][name]["rejected"]) for r in rows
            ),
            refinementChangedCandidates=sum(
                len(r["methods"][name]["refinementChanges"]) for r in rows
            ),
        )
    no_merge = {
        stage: dict(
            failedQueries=sum(
                r["methods"]["compactified"]["noMerge"][stage]["failed"] for r in rows
            ),
            differentOutputQueries=sum(
                sorted(r["noMerge"][stage])
                != sorted(r["methods"]["compactified"][stage])
                for r in gpu["results"]
            ),
        )
        for stage in ["raw", "polished"]
    }
    old_analysis = json.loads(
        (ROOT / "research/results/stress-analysis.json").read_text()
    )
    representatives = [
        r
        for r in old_analysis["representativeFailures"]
        if r["method"] == "compactified"
    ]
    probe_checks = []
    for discrepancy in gpu["mismatches"]:
        case = cases[discrepancy["id"]]
        expected = positions(case["reference"]["roots"])
        before, after = sorted(discrepancy["expected"]), sorted(discrepancy["actual"])
        ulps = [
            abs(
                struct.unpack("I", struct.pack("f", a))[0]
                - struct.unpack("I", struct.pack("f", b))[0]
            )
            for a, b in zip(before, after)
        ]
        probe_checks.append(
            {
                **discrepancy,
                "maxUlps": max(ulps, default=0),
                "sameFailureClassification": match(expected, before)["failed"]
                == match(expected, after)["failed"],
            }
        )
    sources = [
        HERE / "analyze.py",
        HERE / "results/gpu.json",
        HERE / "frozen-manifest.json",
        ROOT / "research/reference.py",
        ROOT / "research/analyze.py",
    ]
    report = dict(
        protocol="Post-hoc exact stage substitutions; overlapping discrepancies are not unique causal attribution",
        tolerance=TOL,
        python=sys.version,
        sympy=sp.__version__,
        numpy=matching.np.__version__,
        rootBracketWidth=str(EPS),
        captureDiscrepancies=probe_checks,
        summary=summary,
        noMerge=no_merge,
        representatives=representatives,
        rows=rows,
        hashes={
            p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sources
        },
    )
    verify(frozen["files"])
    (HERE / "results/analysis.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n"
    )
    print(json.dumps({"summary": summary, "noMerge": no_merge}, indent=2))


if __name__ == "__main__":
    main()
