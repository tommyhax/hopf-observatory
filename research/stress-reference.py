#!/usr/bin/env python3
"""One frozen seeded corpus; exact isolation independent of renderer algorithms."""
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import hashlib
import json
import random
import time

import mpmath as mp
import sympy as sp
from reference import f32, roots, polynomial

ROOT = Path(__file__).resolve().parent
SEED = 20261121
# Renderer revision frozen before construction/evaluation of this corpus.
BASELINE_REVISION = "e49349dd91defdc1d86961ec68b472a7f0f24efe"
mp.mp.dps = 90


def text(x):
    return str(x) if isinstance(x, sp.Rational) else mp.nstr(x, 80)


def unit(v):
    length = mp.sqrt(sum(x * x for x in v))
    return [x / length for x in v]


def rotation(rng):
    R = mp.eye(4)
    angles = [
        mp.mpf(str(rng.uniform(-3.141592653589793, 3.141592653589793)))
        for _ in range(6)
    ]
    for a, (i, j) in zip(angles, [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]):
        G = mp.eye(4)
        G[i, i] = G[j, j] = mp.cos(a)
        G[i, j], G[j, i] = -mp.sin(a), mp.sin(a)
        R = G * R
    return R, R * mp.diag([1, 1, 0, 0]) * R.T, angles


def direction(rng):
    return unit([mp.mpf(str(rng.gauss(0, 1))) for _ in range(3)])


def target(R, t, rng):
    a, b = [mp.mpf(str(rng.uniform(-3.14, 3.14))) for _ in range(2)]
    q = R * mp.matrix(
        [
            mp.cos(t) * mp.cos(a),
            mp.cos(t) * mp.sin(a),
            mp.sin(t) * mp.cos(b),
            mp.sin(t) * mp.sin(b),
        ]
    )
    return [q[i] / (1 - q[3]) for i in range(3)]


def rational_rotation(rng):
    # Quaternion formula yields an exact rational SO(3), including its unit columns.
    w, x, y, z = [sp.Integer(rng.randint(1, 20)) for _ in range(4)]
    n = w * w + x * x + y * y + z * z
    return (
        sp.Matrix(
            [
                [
                    w * w + x * x - y * y - z * z,
                    2 * (x * y - w * z),
                    2 * (x * z + w * y),
                ],
                [
                    2 * (x * y + w * z),
                    w * w - x * x + y * y - z * z,
                    2 * (y * z - w * x),
                ],
                [
                    2 * (x * z - w * y),
                    2 * (y * z + w * x),
                    w * w - x * x - y * y + z * z,
                ],
            ]
        )
        / n
    )


def build():
    rng = random.Random(SEED)
    cases, groups = [], []

    def add(family, P, c, o, d, **meta):
        pi = [[text(P[i, j]) for j in range(4)] for i in range(4)]
        ci, oi, di = text(c), list(map(text, o)), list(map(text, d))
        number = lambda x: f32(float(sp.Rational(x)))
        case = dict(
            id=len(cases),
            family=family,
            Pideal=pi,
            cIdeal=ci,
            oIdeal=oi,
            dIdeal=di,
            P=[[number(x) for x in row] for row in pi],
            c=number(ci),
            o=list(map(number, oi)),
            d=list(map(number, di)),
            **meta,
        )
        case["effectiveDelta"] = case["P"][3][3] - case["c"]
        cases.append(case)
        return case["id"]

    for i in range(600):
        R, P, angles = rotation(rng)
        t = mp.mpf(str(rng.uniform(1, 89))) * mp.pi / 180
        d = direction(rng)
        scale = mp.power(10, mp.mpf(str(rng.uniform(-2, 3))))
        p = target(R, t, rng) if i % 2 else [mp.mpf(0)] * 3
        o = (
            [p[j] - scale * d[j] for j in range(3)]
            if i % 2
            else [scale * x for x in direction(rng)]
        )
        add(
            "random",
            P,
            mp.cos(t) ** 2,
            o,
            d,
            targeted=bool(i % 2),
            angles=list(map(text, angles)),
            t=text(t),
        )

    for i in range(100):
        R, P, angles = rotation(rng)
        c0 = P[3, 3]
        o = [x * rng.randint(2, 12) for x in direction(rng)]
        d = direction(rng)
        # Include exact nominal pole, both sides, sub-ulp differences, and one adjacent float.
        import struct

        bits = struct.unpack("I", struct.pack("f", f32(c0)))[0]
        adjacent = struct.unpack("f", struct.pack("I", bits + (-1 if i % 2 else 1)))[0]
        levels = [
            c0,
            c0 - mp.mpf("1e-6"),
            c0 + mp.mpf("1e-6"),
            c0 - mp.mpf("1e-10"),
            c0 + mp.mpf("1e-10"),
            mp.mpf(adjacent),
        ]
        for j, c in enumerate(levels):
            add(
                "pole",
                P,
                c,
                o,
                d,
                configuration=i,
                offset=j,
                delta=text(c0 - c),
                angles=list(map(text, angles)),
            )

    for i in range(200):
        S = rational_rotation(rng)
        a = sp.Rational(rng.randint(2, 30), 32)
        ct, st = (1 - a * a) / (1 + a * a), 2 * a / (1 + a * a)
        M = sp.eye(4)
        M[:3, :3] = S
        P = M * sp.diag(1, 1, 0, 0) * M.T
        radius = (1 + st) / ct
        d, n = S[:, 2], S[:, 0]
        distance = sp.Rational(rng.randint(2, 20))
        eps = sp.Rational(1, 10 ** rng.randint(3, 10))
        for sign in [0, -1, 1]:
            o = (radius + sign * eps) * n - distance * d
            add(
                "tangent",
                P,
                ct * ct,
                o,
                d,
                configuration=i,
                offset=str(sign * eps),
                exactTangent=sign == 0,
            )

    for i in range(100):
        R, P, angles = rotation(rng)
        if i < 40:
            center = mp.mpf(str(rng.uniform(5, 84)))
            ts = [center, center + mp.mpf(".006"), center + mp.mpf(".02")]
            kind = "overlapping bands"
        elif i < 80:
            ts = [
                mp.mpf(str(rng.uniform(a, b))) for a, b in [(5, 25), (35, 55), (65, 85)]
            ]
            kind = "separated bands"
        else:
            center = mp.acos(mp.sqrt(P[3, 3])) * 180 / mp.pi
            # The first wall lies on, or within a sub-ulp angle of, the pole.
            center += mp.mpf(".005") + mp.mpf(["0", "1e-8", "-1e-8"][i % 3])
            ts = [center, max(mp.mpf(1), center - 1), min(mp.mpf(89), center + 1)]
            kind = "pole boundary"
        d = direction(rng)
        p = target(R, ts[0] * mp.pi / 180, rng)
        o = [p[j] - mp.mpf(6) * d[j] for j in range(3)]
        ids = []
        for torus, t in enumerate(ts):
            for wall, sign in [("low", 1), ("high", -1)]:
                c = mp.cos((t + sign * mp.mpf(".005")) * mp.pi / 180) ** 2
                ids.append(
                    add(
                        "shell",
                        P,
                        c,
                        o,
                        d,
                        group=i,
                        torus=torus,
                        wall=wall,
                        widthDegrees=".01",
                        t=text(t),
                        kind=kind,
                    )
                )
        groups.append(dict(id=i, kind=kind, cases=ids, t=list(map(text, ts))))
    assert len(cases) == 2400
    return cases, groups


def isolate(case):
    case["reference"] = roots(case["P"], case["c"], case["o"], case["d"])
    case["idealReference"] = roots(
        case["Pideal"], case["cIdeal"], case["oIdeal"], case["dIdeal"]
    )
    coefficients = [
        mp.mpf(str(x.p)) / int(x.q)
        for x in polynomial(case["P"], case["c"], case["o"], case["d"]).all_coeffs()
    ]
    derivative = [
        x * (len(coefficients) - 1 - i) for i, x in enumerate(coefficients[:-1])
    ]
    for root in case["reference"]["roots"]:
        s = mp.mpf(root["s"])
        slope = abs(mp.polyval(derivative, s))
        magnitude = mp.polyval(list(map(abs, coefficients)), abs(s))
        root["conditionProxy"] = (
            text(magnitude / (max(1, abs(s)) * slope))
            if slope and root["multiplicity"] == 1
            else None
        )
    return case


if __name__ == "__main__":
    start = time.time()
    cases, groups = build()
    print("Frozen corpus: 2,400 boundary queries; seed", SEED, flush=True)
    with ProcessPoolExecutor(max_workers=4) as pool:
        result = []
        for case in pool.map(isolate, cases, chunksize=4):
            result.append(case)
            if len(result) % 100 == 0:
                print(
                    f"Isolated {len(result)}/2400 in {time.time()-start:.1f}s",
                    flush=True,
                )
    files = ["research/stress-reference.py", "research/reference.py"]
    report = dict(
        seed=SEED,
        baselineRevision=BASELINE_REVISION,
        generator="Python random.Random; fixed family counts and construction before GPU evaluation; six independent uniform rotation angles, not Haar measure",
        method="SymPy exact-rational continued-fraction real-root isolation; intended geometry serialized at 80 digits (exact rationals for tangent constructions)",
        sympy=sp.__version__,
        mpmath=mp.__version__,
        intervalWidth="1e-30",
        hashes={
            p: hashlib.sha256((ROOT.parent / p).read_bytes()).hexdigest() for p in files
        },
        cases=result,
        shellGroups=groups,
    )
    (ROOT / "results/stress-reference.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print("Wrote stress-reference.json", flush=True)
