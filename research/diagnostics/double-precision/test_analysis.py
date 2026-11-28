"""Independent analytic checks of the precision experiment's exact controls."""
import unittest
import analyze as replay
import sympy as sp


class ReplayTests(unittest.TestCase):
    def test_binary64_reconstruction_preserves_the_bits(self):
        value = 0.1 + 2**-52
        self.assertEqual(replay.exact.rational(value), sp.Rational(*value.as_integer_ratio()))
        self.assertNotEqual(replay.exact.rational(value), sp.Rational(str(value)))

    def test_exact_quartic_bernstein_conversion_and_roots(self):
        # (x-1/4)(x-3/4)(x+1)(x+2), independently sampled in Bernstein form.
        x = replay.exact.X
        p = sp.Poly((x-sp.Rational(1, 4))*(x-sp.Rational(3, 4))*(x+1)*(x+2), x)
        b = [sum(p.nth(k)*sp.binomial(i, k)/sp.binomial(4, k) for k in range(i+1))
             for i in range(5)]
        coefficients = replay.exact.bernstein_to_power(b)
        self.assertEqual(coefficients, tuple(p.nth(i) for i in range(5)))
        roots = replay.exact.chart_roots(coefficients, sp.Rational(-2), sp.Rational(4), 2)
        self.assertEqual(replay.exact.positions(roots), [3.0, 5.0])

    def test_reference_check_rejects_wrong_root_and_multiplicity(self):
        old = [{"bracket": ["1", "1"], "multiplicity": 2}]
        replay.check_reference(old, [{"sBracket": ["1", "1"], "multiplicity": 2}])
        for new in [
            [{"sBracket": ["2", "2"], "multiplicity": 2}],
            [{"sBracket": ["1", "1"], "multiplicity": 1}],
        ]:
            with self.assertRaises(ValueError):
                replay.check_reference(old, new)

    def test_matching_does_not_merge_nearby_roots(self):
        result = replay.checks([1.0, 1.0 + 1e-10], [1.0])["0.0001"]
        self.assertTrue(result["failed"])
        self.assertEqual(result["missed"], 1)


if __name__ == "__main__":
    unittest.main()
