#!/usr/bin/env python3
"""Independent exact-rational real-root isolation; no production solver imports.

SymPy's continued-fraction isolator supplies rational isolating intervals (not
Bernstein subdivision or derivative partitioning). Inputs are either 80-digit
geometry or exact binary32 uniforms, and interval widths are at most 1e-30.
"""
from pathlib import Path
import json, struct, time, random
import mpmath as mp
import sympy as sp

mp.mp.dps = 90
ROOT = Path(__file__).resolve().parent
X = sp.Symbol("s")


def f32(x):
    return struct.unpack("f", struct.pack("f", float(x)))[0]


def rational(x):
    if isinstance(x, float):
        return sp.Rational(*x.as_integer_ratio())
    return sp.Rational(str(x))


def polynomial(P, c, o, d):
    P = [[rational(v) for v in row] for row in P]
    c = rational(c)
    o = list(map(rational, o))
    d = list(map(rational, d))
    # Expand the original inverse stereographic numerator independently.
    v = [[2 * o[i], 2 * d[i], 0] for i in range(3)]
    v.append(
        [
            sum(x * x for x in o) - 1,
            2 * sum(a * b for a, b in zip(o, d)),
            sum(x * x for x in d),
        ]
    )
    a = [sp.S(0)] * 5
    for i in range(4):
        for j in range(4):
            A = P[i][j] - (c if i == j else 0)
            for m in range(3):
                for n in range(3):
                    a[m + n] += A * v[i][m] * v[j][n]
    return sp.Poly.from_list(a[::-1], X, domain=sp.QQ)


def roots(P, c, o, d):
    p = polynomial(P, c, o, d)
    if p.is_zero:
        return {"degree": -1, "roots": [], "contained": True}
    intervals = sp.polys.polytools.intervals(p, eps=sp.Rational(1, 10**30), inf=0)
    out = []
    for (a, b), multiplicity in intervals:
        middle = (a + b) / 2
        if middle <= 0:
            continue
        out.append(
            {
                "s": str(sp.N(middle, 65)),
                "multiplicity": multiplicity,
                "bracket": [str(a), str(b)],
            }
        )
    return {"degree": p.degree(), "roots": out}


def mat(t, delta, tilt):
    c = mp.cos(mp.mpf(t) * mp.pi / 180) ** 2
    a = c + mp.mpf(delta)
    # Spatial rotation keeps P44 fixed while varying all spatial entries.
    az = mp.mpf(tilt) * mp.pi / 180
    el = mp.mpf(tilt) / 2 * mp.pi / 180
    u = [mp.cos(az) * mp.cos(el), mp.sin(az) * mp.cos(el), -mp.sin(el)]
    v = [-mp.sin(az), mp.cos(az), mp.mpf(0)]
    P = [
        [(1 - a) * u[i] * u[j] + v[i] * v[j] for j in range(3)]
        + [-mp.sqrt(a * (1 - a)) * u[i]]
        for i in range(3)
    ]
    P.append([-mp.sqrt(a * (1 - a)) * x for x in u] + [a])
    return [[mp.nstr(x, 80) for x in row] for row in P], mp.nstr(c, 80)


def adjacent_float(x, direction):
    bits = struct.unpack("I", struct.pack("f", f32(x)))[0]
    return struct.unpack("f", struct.pack("I", bits + direction))[0]


def rotated_projector(angles):
    R = mp.eye(4)
    for angle, (i, j) in zip(angles, [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]):
        rotation = mp.eye(4)
        c, s = mp.cos(angle), mp.sin(angle)
        rotation[i, i] = rotation[j, j] = c
        rotation[i, j], rotation[j, i] = -s, s
        R = rotation * R
    P = R * mp.diag([1, 1, 0, 0]) * R.T
    return [[mp.nstr(P[i, j], 80) for j in range(4)] for i in range(4)]


def build():
    cases = []
    rays = [
        ([-6, 0, 0], [1, 0, 0]),
        ([-6, 0.35, 0.2], [1, 0, 0]),
        ([-6, 0.8, -0.3], [1, 0, 0]),
        ([0, 3, 0.2], [1, 0, 0]),
        ([0, 3, 0.2], [-1, 0, 0]),
        ([6, 0.25, 0.5], [-1, 0, 0]),
    ]
    deltas = ["0"] + [f"{sign}1e-{e}" for e in range(1, 13) for sign in ["", "-"]]
    for t, tilt in [(25, 0), (45, 0), (65, 0), (45, 37)]:
        for delta in deltas:
            P, c = mat(t, delta, tilt)
            for i, (o, d) in enumerate(rays):
                cases.append(
                    {
                        "family": "pole",
                        "name": f"t={t}, tilt={tilt}, delta={delta}, ray={i}",
                        "t": t,
                        "tilt": tilt,
                        "delta": delta,
                        "Pideal": P,
                        "cIdeal": c,
                        "o": list(map(float, o)),
                        "d": d,
                    }
                )
    # Genuine grazing family at the outer silhouette of the aligned t=45 torus.
    for offset in ["0"] + [f"{sign}1e-{e}" for e in range(2, 11) for sign in ["", "-"]]:
        P = [
            ["1", "0", "0", "0"],
            ["0", "1", "0", "0"],
            ["0", "0", "0", "0"],
            ["0", "0", "0", "0"],
        ]
        cases.append(
            {
                "family": "tangent",
                "name": f"outer tangent offset={offset}",
                "t": 45,
                "delta": "-.5",
                "offset": offset,
                "Pideal": P,
                "cIdeal": "0.5",
                "o": [-4, mp.nstr(1 + mp.sqrt(2) + mp.mpf(offset), 80), 0],
                "d": [1, 0, 0],
            }
        )
    # The nearest representable nonzero pole gaps at the UI parameter extremes.
    for t in [1, 5, 25, 45, 65, 85, 89]:
        ideal_c = mp.cos(mp.mpf(t) * mp.pi / 180) ** 2
        for tilt in [0, 37]:
            for direction in [-1, 1]:
                target = adjacent_float(ideal_c, direction)
                delta = mp.mpf(target) - ideal_c
                P, c = mat(t, mp.nstr(delta, 80), tilt)
                for ray, (o, d) in enumerate(rays):
                    cases.append(
                        {
                            "family": "precision",
                            "name": f"t={t}, tilt={tilt}, adjacent={direction}, ray={ray}",
                            "t": t,
                            "tilt": tilt,
                            "delta": mp.nstr(delta, 80),
                            "Pideal": P,
                            "cIdeal": c,
                            "o": o,
                            "d": d,
                        }
                    )
    # Exact chart junctions lambda=L, plus a line contained in the surface.
    P = [
        [".5", "0", "0", "-.5"],
        ["0", "1", "0", "0"],
        ["0", "0", "0", "0"],
        ["-.5", "0", "0", ".5"],
    ]
    junction_rays = [
        ([-6, 0, 0], [1, 0, 0]),
        ([6, 0, 0], [-1, 0, 0]),
        ([0, 0, 0], [1, 0, 0]),
        ([0, 0, 0], [-1, 0, 0]),
        ([-1, 0, 0], [1, 0, 0]),
        ([1, 0, 0], [-1, 0, 0]),
        ([0, 0.5, 5], [0, 0, -1]),
        ([0, 0, 0], [0, mp.sqrt(0.5), mp.sqrt(0.5)]),
    ]
    for ray, (o, d) in enumerate(junction_rays):
        cases.append(
            {
                "family": "precision",
                "name": f"exact chart junction or contained line {ray}",
                "t": 45,
                "delta": "0",
                "Pideal": P,
                "cIdeal": ".5",
                "o": o,
                "d": [f32(x) for x in d],
            }
        )
    rng = random.Random(270521)
    for config in range(12):
        t = rng.choice([1, 5, 25, 45, 65, 85, 89])
        angles = [mp.mpf(str(rng.uniform(-mp.pi, mp.pi))) for _ in range(6)]
        P = rotated_projector(angles)
        c = mp.cos(mp.mpf(t) * mp.pi / 180) ** 2
        for ray, (o, d) in enumerate(rays):
            cases.append(
                {
                    "family": "rotation",
                    "name": f"six-plane rotation {config}, ray={ray}",
                    "t": t,
                    "angles": [mp.nstr(x, 80) for x in angles],
                    "delta": mp.nstr(mp.mpf(P[3][3]) - c, 80),
                    "Pideal": P,
                    "cIdeal": mp.nstr(c, 80),
                    "o": o,
                    "d": d,
                }
            )
    for i, case in enumerate(cases):
        case["id"] = i
        case["P"] = [[f32(x) for x in row] for row in case["Pideal"]]
        case["c"] = f32(case["cIdeal"])
        case["oIdeal"] = [str(x) for x in case["o"]]
        case["o"] = [f32(x) for x in case["o"]]
        case["effectiveDelta"] = case["P"][3][3] - case["c"]
    return cases


if __name__ == "__main__":
    start = time.time()
    cases = build()
    for i, case in enumerate(cases):
        case["reference"] = roots(case["P"], case["c"], case["o"], case["d"])
        case["idealReference"] = roots(
            case["Pideal"], case["cIdeal"], case["oIdeal"], case["d"]
        )
        if i % 50 == 0:
            print(f"Reference {i}/{len(cases)}, {time.time()-start:.1f}s", flush=True)
    result = {
        "method": "SymPy exact-rational continued-fraction real-root isolation",
        "sympy": sp.__version__,
        "mpmath": mp.__version__,
        "geometryDigits": 80,
        "intervalWidth": "1e-30",
        "cases": cases,
    }
    (ROOT / "results/reference.json").write_text(json.dumps(result, indent=2) + "\n")
    print(
        f"Wrote {len(cases)} independently isolated cases in {time.time()-start:.1f}s"
    )
