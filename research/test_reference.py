"""Independent checks on the exact-rational reference, using known geometry."""

import unittest
import mpmath as mp
from reference import roots, mat, f32


class ReferenceTests(unittest.TestCase):
    def test_exact_double_tangent(self):
        # For cos(t)=3/5, the outer radius is exactly 3. The x-directed
        # line y=3 touches at s=4, giving a genuine algebraic double root.
        P = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        result = roots(P, "0.36", [-4, 3, 0], [1, 0, 0])
        self.assertEqual(len(result["roots"]), 1)
        self.assertEqual(float(result["roots"][0]["s"]), 4)
        self.assertEqual(result["roots"][0]["multiplicity"], 2)

    def test_aligned_clifford_axis(self):
        P = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        actual = roots(P, "0.5", [-4, 0, 0], [1, 0, 0])["roots"]
        expected = sorted(4 + a * mp.sqrt(2) + b for a in [-1, 1] for b in [-1, 1])
        self.assertEqual(len(actual), 4)
        for a, b in zip(actual, expected):
            self.assertLess(abs(mp.mpf(a["s"]) - b), mp.mpf("1e-29"))

    def test_exact_pole_degree_reduction(self):
        P = [[".5", 0, 0, "-.5"], [0, 1, 0, 0], [0, 0, 0, 0], ["-.5", 0, 0, ".5"]]
        result = roots(P, ".5", [0, ".5", 5], [0, 0, -1])
        self.assertEqual(result["degree"], 2)
        self.assertEqual([float(r["s"]) for r in result["roots"]], [4.5, 5.5])

    def test_contained_line_is_not_an_isolated_hit(self):
        P = [[".5", 0, 0, "-.5"], [0, 1, 0, 0], [0, 0, 0, 0], ["-.5", 0, 0, ".5"]]
        self.assertTrue(roots(P, ".5", [0, 0, 0], [0, 1, 1])["contained"])

    def test_geometry_rounding_can_erase_nonzero_delta(self):
        P, c = mat(45, "1e-12", 0)
        self.assertGreater(mp.mpf(P[3][3]) - mp.mpf(c), 0)
        self.assertEqual(f32(P[3][3]), f32(c))


if __name__ == "__main__":
    unittest.main()
