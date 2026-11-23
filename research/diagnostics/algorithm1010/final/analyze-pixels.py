"""Exact nearest-root checks of the two pre-existing pixel outliers' captured rays."""

from pathlib import Path
import hashlib
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "research"))
from reference import roots, f32


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def normalize(v):
    length = math.sqrt(dot(v, v))
    return [x / length for x in v]


def field(P, p):
    r = dot(p, p)
    q = [2 * x / (1 + r) for x in p] + [(r - 1) / (1 + r)]
    return dot(q, [dot(row, q) for row in P])


reports = []
files = [Path(__file__), ROOT / "research/reference.py"]
for backend in ["native", "webgl"]:
    path = HERE / f"results/pixels-{backend}.json"
    files.append(path)
    capture = json.loads(path.read_text())
    for name, digest in capture["hashes"].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name
    u = capture["uniforms"]
    P = [[f32(v) for v in u["uP"][i : i + 4]] for i in range(0, 16, 4)]
    c, bias, ior = f32(u["uLevels"][0]), f32(u["uRayBias"]), f32(u["uOptics[0]"][1])
    for row in capture["records"]:
        events, failures = [], []
        for event in row["events"]:
            if not any(event["origin"]):
                continue  # capture never reached; not a terminal miss
            o, d, s = event["origin"], event["direction"], event["s"]
            reference = roots(P, c, o, d)
            cutoff = 0.5 * bias * max(1, math.sqrt(dot(o, o)))
            forward = [
                float(r["s"]) for r in reference["roots"] if float(r["s"]) > cutoff
            ]
            expected = min(forward) if forward else None
            error = (
                abs(s - expected) / max(1, expected)
                if s >= 0 and expected is not None
                else None
            )
            result = dict(
                path=event["path"],
                step=event["step"],
                actual=s,
                expected=expected,
                relativeError=error,
            )
            if (s < 0) != (expected is None) or (
                s >= 0
                and (
                    error is None
                    or error > 1e-4
                    or event["id"] != 0
                    or event["level"] != c
                )
            ):
                failures.append(dict(kind="nearest intersection", **result))
            if s >= 0:
                p = [x + s * v for x, v in zip(o, d)]
                r = dot(p, p)
                q = [2 * x / (1 + r) for x in p] + [(r - 1) / (1 + r)]
                aq = [dot(P[i], q) - c * q[i] for i in range(4)]
                normal = normalize([aq[i] + p[i] * aq[3] for i in range(3)])
                result["normalError"] = math.dist(normal, event["normal"])
                if result["normalError"] > 2e-4:
                    failures.append(dict(kind="normal", **result))
                # Single-solid media and scalar Snell/TIR, independently from GLSL.
                inside = field(P, o) > c
                eta = ior if inside else 1 / ior
                n = event["normal"]
                if dot(d, n) > 0:
                    n = [-x for x in n]
                ci = max(0, min(1, -dot(d, n)))
                K = 1 - eta * eta * (1 - ci * ci)
                result["tir"] = K < 0
                result["snellDiscriminant"] = K
                outgoing = (
                    [d[i] + 2 * ci * n[i] for i in range(3)]
                    if K < 0
                    else normalize(
                        [
                            eta * d[i] + (eta * ci - math.sqrt(K)) * n[i]
                            for i in range(3)
                        ]
                    )
                )
                following = next(
                    (
                        e
                        for e in row["events"]
                        if e["path"] == event["path"]
                        and e["step"] == event["step"] + 1
                        and any(e["origin"])
                    ),
                    None,
                )
                if following:
                    result["outgoingDirectionError"] = math.dist(
                        outgoing, following["direction"]
                    )
                    if result["outgoingDirectionError"] > 2e-4:
                        failures.append(dict(kind="outgoing direction", **result))
            events.append(result)
        instrumented_error = max(
            abs(a - b) for e in row["events"] for a, b in zip(e["color"], row["color"])
        )
        assert instrumented_error == 0, "Instrumentation changed pixel color"
        record = dict(
            backend=backend,
            variant=row["variant"],
            pixel=row["pixel"],
            color=row["color"],
            instrumentedColorError=instrumented_error,
            events=events,
            failures=failures,
            passed=not failures,
            primaryHits=sum(e["path"] == 0 and e["actual"] >= 0 for e in events),
            internalReflections=sum(
                e["path"] == 0 and e.get("tir", False) for e in events
            ),
            maxRelativeDistanceError=max(
                (e["relativeError"] or 0 for e in events), default=0
            ),
        )
        reports.append(record)
        print(
            backend,
            row["variant"],
            row["pixel"],
            record["primaryHits"],
            "hits;",
            record["internalReflections"],
            "TIR; max distance error",
            record["maxRelativeDistanceError"],
            "failures",
            failures,
        )
output = dict(
    method="Exact-rational roots of each captured float32 incoming ray; nearest root above unchanged bias. Independent analytic normals and single-solid Snell/TIR continuation. Two already-observed pixels only; not a new stress campaign or a high-precision full-image reference.",
    reports=reports,
    hashes={
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in files
    },
)
(HERE / "results/pixel-analysis.json").write_text(
    json.dumps(output, indent=2, allow_nan=False) + "\n"
)
assert all(row["passed"] for row in reports)
