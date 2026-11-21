"""Checks for completeness accounting independent of the numerical solvers."""

import unittest
from analyze import match


class MatchingTests(unittest.TestCase):
    def test_close_roots_need_global_assignment(self):
        result = match([1, 1.00015], [1.00008, 1.00016])
        self.assertFalse(result["failed"])
        self.assertEqual(result["found"], 2)

    def test_missing_and_spurious_are_both_reported(self):
        result = match([1, 2, 3], [1, 4])
        self.assertEqual(result["missedRoots"], [2, 3])
        self.assertEqual(result["false"], 1)

    def test_nonfinite_is_not_a_miss_sentinel(self):
        result = match([], [None, float("nan"), float("inf")])
        self.assertEqual(result["false"], 3)
        self.assertEqual(result["nonfiniteOutputs"], 3)

    def test_extra_duplicate_is_spurious(self):
        self.assertEqual(match([2], [2, 2])["false"], 1)

    def test_small_positive_roots_are_not_filtered(self):
        self.assertEqual(match([1e-8], [])["missed"], 1)


if __name__ == "__main__":
    unittest.main()
