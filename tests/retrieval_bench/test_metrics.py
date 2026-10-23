"""Metric contract tests: known rankings produce known scores."""

import unittest
from metrics import mrr, ndcg_at_10, recall_at_k, approx_tokens

GRADES = {"a": 3, "b": 2, "c": 1, "d": 0}


class MetricTests(unittest.TestCase):
    def test_perfect_ranking_scores_one(self):
        self.assertEqual(ndcg_at_10(GRADES, ["a", "b", "c"]), 1.0)

    def test_reversed_ranking_scores_below_perfect(self):
        self.assertLess(ndcg_at_10(GRADES, ["c", "b", "a"]), 1.0)
        self.assertGreater(ndcg_at_10(GRADES, ["c", "b", "a"]), 0.0)

    def test_unranked_relevant_scores_zero(self):
        self.assertEqual(ndcg_at_10(GRADES, ["x", "y"]), 0.0)

    def test_ties_do_not_crash_and_rank(self):
        tied = {"a": 2, "b": 2}
        self.assertEqual(ndcg_at_10(tied, ["a", "b"]), 1.0)

    def test_mrr_first_position(self):
        self.assertEqual(mrr(GRADES, ["a"]), 1.0)
        self.assertAlmostEqual(mrr(GRADES, ["d", "b"]), 0.5)
        self.assertEqual(mrr(GRADES, ["d"]), 0.0)

    def test_recall_at_k(self):
        # 3 relevant of 4; top-2 relevant hits cover 2/3.
        self.assertAlmostEqual(recall_at_k(GRADES, ["a", "b"], 2), 2 / 3)
        self.assertAlmostEqual(recall_at_k(GRADES, ["d", "a"], 2), 1 / 3)
        self.assertEqual(recall_at_k(GRADES, ["a", "b", "c"], 3), 1.0)


class TokenProxyTests(unittest.TestCase):
    def test_chars_per_four_minimum_one(self):
        self.assertEqual(approx_tokens(""), 1)
        self.assertEqual(approx_tokens("abcd"), 1)
        self.assertEqual(approx_tokens("abcde"), 1)
        self.assertEqual(approx_tokens("abcdefgh"), 2)


if __name__ == "__main__":
    unittest.main()
