#!/usr/bin/env python3
"""Exact original-polynomial checks of captured rays; independent media and Snell checks."""
from pathlib import Path
import hashlib
import json
import math
import mpmath as mp
from reference import roots, f32

ROOT = Path(__file__).resolve().parent.parent
mp.mp.dps = 80


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(v):
    length = mp.sqrt(dot(v, v))
    return [x / length for x in v]


def point(o, d, s):
    return [mp.mpf(x) + mp.mpf(s) * y for x, y in zip(o, d)]


def field(P, p):
    r = dot(p, p)
    q = [2 * x / (1 + r) for x in p] + [(r - 1) / (1 + r)]
    return dot(q, [dot(row, q) for row in P])


def medium(u, p):
    value = field(u["P"], p)
    candidates = [i for i in range(3) if u["low"][i] < value < u["high"][i]]
    return (
        min(candidates, key=lambda i: (f32(u["high"][i] - u["low"][i]), -i))
        if candidates
        else -1
    )


def nearest(u, o, d):
    cutoff = mp.mpf(u["bias"]) * max(1, mp.sqrt(dot(o, o))) / 2
    candidates = []
    for level in u["low"] + u["high"]:
        r = roots(u["P"], level, o, d)
        candidates += [
            (float(v["s"]), level) for v in r["roots"] if mp.mpf(v["s"]) > cutoff
        ]
    return min(candidates) if candidates else None


def check(path):
    v = path["uniforms"]
    u = dict(
        P=[v["uP"][i : i + 4] for i in range(0, 16, 4)],
        low=v["uLows"],
        high=v["uHighs"],
        bias=f32(v["uRayBias"]),
    )
    failures = []
    count = 0
    optical = 0
    entries = 0
    exits = 0
    tir_count = 0
    hidden = 0
    max_distance = max_normal = max_snell = max_vector = 0
    for event in path["events"]:
        a, b = event["states"]
        step = event["step"]
        if a[3] == -2:
            termination = "energy/transport termination before capture"
            break
        if a[3] == -1:
            want = nearest(u, a[:3], a[4:7])
            if want:
                failures.append(
                    dict(
                        step=step,
                        kind="missed remaining intersection",
                        expected=want,
                        origin=a[:3],
                        direction=a[4:7],
                    )
                )
            termination = "no hit"
            break
        count += 1
        p, s, before, after, n1, n2, t, tir, n, level = (
            a[:3],
            a[3],
            int(a[4]),
            int(a[5]),
            a[6],
            a[7],
            a[8:11],
            bool(a[11]),
            a[12:15],
            a[15],
        )
        o, eps, d = b[:3], b[3], b[4:7]
        want = nearest(u, o, d)
        error = abs(want[0] - s) / max(1, abs(want[0])) if want else None
        if error is not None:
            max_distance = max(max_distance, error)
        if want is None or error > 1e-4 or want[1] != level:
            failures.append(
                dict(
                    step=step,
                    kind="intersection",
                    actual=[s, level],
                    expected=want,
                    error=error,
                )
            )
        # Original analytic gradient at the captured point, in high precision.
        pp = list(map(mp.mpf, p))
        r = dot(pp, pp)
        q = [2 * x / (1 + r) for x in pp] + [(r - 1) / (1 + r)]
        aq = [dot(row, q) - mp.mpf(level) * q[i] for i, row in enumerate(u["P"])]
        g = norm([aq[i] + pp[i] * aq[3] for i in range(3)])
        if dot(g, d) > 0:
            g = [-x for x in g]
        normal_error = float(mp.sqrt(sum((g[i] - n[i]) ** 2 for i in range(3))))
        max_normal = max(max_normal, normal_error)
        if normal_error > 2e-4:
            failures.append(dict(step=step, kind="normal", error=normal_error))
        probe_before = medium(u, list(map(mp.mpf, o)))
        probe_after = medium(u, point(p, n, -eps))
        if before != probe_before or after != probe_after:
            failures.append(
                dict(
                    step=step,
                    kind="medium probe",
                    before=before,
                    after=after,
                    expectedBefore=probe_before,
                    expectedAfter=probe_after,
                )
            )
        indices = v["uOptics[0]"]
        want_n1 = 1 if before < 0 else f32(indices[4 * before + 1])
        want_n2 = 1 if after < 0 else f32(indices[4 * after + 1])
        if n1 != want_n1 or n2 != want_n2:
            failures.append(dict(step=step, kind="index", n1=n1, n2=n2))
        if b[14] == 2:
            hidden += 1
            continue
        optical += 1
        ci = max(0, min(1, -dot(d, n)))
        eta = n1 / n2
        K = 1 - eta * eta * (1 - ci * ci)
        if tir:
            tir_count += 1
            if K > 2e-5:
                failures.append(dict(step=step, kind="false TIR", discriminant=K))
        else:
            if before < 0 and after >= 0:
                entries += 1
            if before >= 0 and after < 0:
                exits += 1
            want_t = [
                eta * d[i] + (eta * ci - math.sqrt(max(0, K))) * n[i] for i in range(3)
            ]
            vector_error = math.dist(want_t, t)
            max_vector = max(max_vector, vector_error)
            sin_i = math.sqrt(sum((d[i] + ci * n[i]) ** 2 for i in range(3)))
            ct = -dot(t, n)
            sin_t = math.sqrt(sum((t[i] + ct * n[i]) ** 2 for i in range(3)))
            residual = abs(n1 * sin_i - n2 * sin_t)
            max_snell = max(max_snell, residual)
            if K < -2e-5 or vector_error > 2e-4 or residual > 2e-4:
                failures.append(
                    dict(
                        step=step,
                        kind="Snell",
                        residual=residual,
                        vectorError=vector_error,
                        discriminant=K,
                    )
                )
    else:
        termination = "24-boundary budget"
    return dict(
        group=path["group"],
        variant=path["variant"],
        events=count,
        opticalEvents=optical,
        hiddenBoundaries=hidden,
        entries=entries,
        exits=exits,
        TIR=tir_count,
        termination=termination,
        maxDistanceError=max_distance,
        maxNormalError=max_normal,
        maxSnellResidual=max_snell,
        maxDirectionError=max_vector,
        failures=failures,
    )


if __name__ == "__main__":
    data = json.loads((ROOT / "research/results/stress-transport.json").read_text())
    for p, h in data["hashes"].items():
        assert hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h, p
    paths = []
    for path in data["paths"]:
        result = check(path)
        paths.append(result)
        print(
            result["variant"],
            result["group"],
            result["events"],
            "events",
            len(result["failures"]),
            "failures",
            flush=True,
        )
    summaries = {}
    for variant in sorted(set(p["variant"] for p in paths)):
        selected = [p for p in paths if p["variant"] == variant]
        summaries[variant] = dict(
            paths=len(selected),
            passed=sum(not p["failures"] for p in selected),
            events=sum(p["events"] for p in selected),
            opticalEvents=sum(p["opticalEvents"] for p in selected),
            hiddenBoundaries=sum(p["hiddenBoundaries"] for p in selected),
            entries=sum(p["entries"] for p in selected),
            exits=sum(p["exits"] for p in selected),
            TIR=sum(p["TIR"] for p in selected),
            maxDistanceError=max(p["maxDistanceError"] for p in selected),
            maxNormalError=max(p["maxNormalError"] for p in selected),
            maxSnellResidual=max(p["maxSnellResidual"] for p in selected),
        )
    files = [
        "research/analyze-transport.py",
        "research/reference.py",
        "research/results/stress-transport.json",
    ]
    report = dict(
        method="Exact-rational isolation of each captured incoming ray against all six represented boundaries; nearest beyond production cutoff. Independent high-precision analytic normal and spatial membership probes. Vector/scalar Snell checks at captured events. Misses checked for remaining intersections; budget/energy termination recorded separately.",
        tolerances=dict(intersection=1e-4, normal=2e-4, snell=2e-4),
        summaries=summaries,
        paths=paths,
        hashes={p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files},
    )
    (ROOT / "research/results/stress-transport-analysis.json").write_text(
        json.dumps(report, indent=2, allow_nan=False) + "\n"
    )
    print(summaries)
