"""Analytic checks for basis conversion, coordinate ownership and exact replay."""

import importlib.util
from pathlib import Path
import unittest
import sympy as sp

spec = importlib.util.spec_from_file_location(
    "grazing_analysis", Path(__file__).with_name("analyze.py")
)
diag = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diag)
Q = sp.Rational


class DiagnosticTests(unittest.TestCase):
    def test_elevated_quadratic_retains_double_contact(self):
        # (x - 1/2)^2 in the degree-four Bernstein basis.
        power = diag.bernstein_to_power([Q(1, 4), 0, Q(-1, 12), 0, Q(1, 4)])
        self.assertEqual(power, (Q(1, 4), -1, 1, 0, 0))
        roots = diag.chart_roots(power, Q(-2), Q(3), 2)
        self.assertEqual(diag.positions(roots), [3.5])
        self.assertEqual(roots[0]["multiplicity"], 2)

    def test_reciprocal_mapping_and_infinity(self):
        # x(x - 1/2): x=0 is infinity; x=1/2 maps to s=2L-k.
        roots = diag.chart_roots((0, Q(-1, 2), 1, 0, 0), Q(-2), Q(3), 3)
        self.assertEqual(diag.positions(roots), [8.0])
        roots = diag.chart_roots((0, Q(-1, 2), 1, 0, 0), Q(-10), Q(3), 1)
        self.assertEqual(diag.positions(roots), [4.0])

    def test_center_owned_once_and_ray_origin_excluded(self):
        p = (0, 1, 0, 0, 0)
        self.assertEqual(diag.positions(diag.chart_roots(p, Q(-2), Q(1), 0)), [])
        self.assertEqual(diag.positions(diag.chart_roots(p, Q(-2), Q(1), 2)), [2.0])
        self.assertEqual(diag.positions(diag.chart_roots(p, Q(0), Q(1), 2)), [])

    def test_ray_identity_without_unit_direction(self):
        # A non-unit rational direction tests all homogeneous coefficients.
        P = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        level = Q(1, 3)
        C, d, L = [Q(1, 7), Q(2, 7), Q(-3, 7)], [Q(2, 3), Q(1, 5), Q(-4, 5)], Q(3)
        a = [2 * v / L**2 for v in C] + [(sum(v * v for v in C) - 1) / L**2]
        b = [2 * v / L for v in d] + [2 * sum(u * v for u, v in zip(C, d)) / L]
        h = [0, 0, 0, sum(v * v for v in d)]
        A = [
            [Q(P[i][j]) - (level if i == j else 0) for j in range(4)] for i in range(4)
        ]
        p = diag.polynomial(P, level, C, [L * v for v in d])
        expected = tuple(p.nth(i) / L**4 for i in range(5))
        self.assertEqual(diag.form_coefficients([a, b, h], A), expected)

    def test_no_nearby_reference_merge(self):
        result = diag.summarize_match([1.0, 1.00000001], [1.0])
        self.assertTrue(result["failed"])
        self.assertEqual(result["missed"], 1)


if __name__ == "__main__":
    unittest.main()
