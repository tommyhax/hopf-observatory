"""Exact-rational roots of float32 polynomial fixtures, independent of the port."""

from pathlib import Path
import json
import random
import struct
import sympy as sp

x = sp.Symbol("x")
cases = [
    ("four simple roots", [24, -50, 35, -10, 1]),
    ("cubic degree loss", [-6, 11, -6, 1, 0]),
    ("quadratic degree loss", [-1, 0, 1, 0, 0]),
    ("linear degree loss", [-2, 1, 0, 0, 0]),
    ("constant", [1, 0, 0, 0, 0]),
    ("zero polynomial", [0, 0, 0, 0, 0]),
    ("double zero", [0, 0, 1, 0, 0]),
    ("two double roots", [1, 0, -2, 0, 1]),
    ("quadruple one", [1, -4, 6, -4, 1]),
    ("quadruple one perturbed above", [1 + 2**-20, -4, 6, -4, 1]),
    ("quadruple one perturbed below", [1 - 2**-20, -4, 6, -4, 1]),
    ("triple one", [-2, 5, -3, -1, 1]),
    ("closed endpoints", [0, -1, 1, 0, 0]),
    ("quadratic separated scales", [1, -1e10, 1, 0, 0]),
    ("no real roots", [1, 0, 0, 0, 1]),
    ("two real roots", [-1, 0, 0, 0, 1]),
    ("2024 correction case 26", [-46, 0, -11, 0, 1]),
    (
        "correction case 25",
        [1, -17.678187643398402, -14.480985471938862, 2.2459773428819827, 1],
    ),
]
for name, roots in [
    ("separated quartic", [sp.Rational(1, 4096), sp.Rational(1, 2), 2, 4096]),
    ("near zero quartet", [sp.Rational(i, 2**20) for i in [1, 2, 4, 8]]),
    ("widely separated quartet", [sp.Rational(1, 2**20), sp.Rational(1, 8), 8, 2**20]),
    ("close dyadic pair", [sp.Rational(1023, 1024), sp.Rational(1025, 1024), -2, 3]),
]:
    polynomial = sp.Poly(sp.prod(x - r for r in roots), x)
    cases.append((name, list(reversed(polynomial.all_coeffs()))))
rng = random.Random(10102024)
for i in range(32):
    roots = rng.sample(list(range(-16, 0)) + list(range(1, 17)), 4)
    polynomial = sp.Poly(sp.prod(x - r for r in roots), x)
    cases.append((f"integer quartet {i}", list(reversed(polynomial.all_coeffs()))))

fixtures = []
for name, coefficients in cases:
    rounded = [struct.unpack("f", struct.pack("f", float(v)))[0] for v in coefficients]
    polynomial = sp.Poly(sum(sp.Rational(v) * x**i for i, v in enumerate(rounded)), x)
    intervals = (
        [] if polynomial.is_zero else polynomial.intervals(eps=sp.Rational(1, 10**40))
    )
    roots = [float((lo + hi) / 2) for (lo, hi), multiplicity in intervals]
    fixtures.append(dict(name=name, c=rounded[:4], lead=rounded[4], roots=roots))
Path(__file__).with_name("fixtures.json").write_text(
    json.dumps(fixtures, indent=2) + "\n"
)
print("Wrote", len(fixtures), "exact-reference polynomial fixtures")
