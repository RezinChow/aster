"""Offline metrics for the retrieval benchmark (Semble's NDCG@10 family).

Pure functions over frozen graded labels; unit-tested in test_metrics.py.
No model, no network.
"""

from __future__ import annotations

import math
from typing import Dict, List, Sequence

# A query's graded relevance: chunk-id -> grade (0 irrelevant .. 3 perfect).
Grades = Dict[str, int]
# An engine's ranked chunk-ids, best first.
Ranking = Sequence[str]


def dcg_at_k(grades: Grades, ranking: Ranking, k: int) -> float:
    total = 0.0
    for position, chunk_id in enumerate(ranking[:k]):
        grade = grades.get(chunk_id, 0)
        if grade > 0:
            total += (2 ** grade - 1) / math.log2(position + 2)
    return total


def ndcg_at_10(grades: Grades, ranking: Ranking) -> float:
    ideal = sorted(grades.values(), reverse=True)
    ideal_ranking = [
        chunk_id
        for chunk_id, _ in sorted(grades.items(), key=lambda pair: -pair[1])
    ]
    got = dcg_at_k(grades, ranking, 10)
    best = dcg_at_k(grades, ideal_ranking, 10)
    if best == 0:
        return 0.0
    return got / best


def mrr(grades: Grades, ranking: Ranking) -> float:
    for position, chunk_id in enumerate(ranking, start=1):
        if grades.get(chunk_id, 0) > 0:
            return 1.0 / position
    return 0.0


def recall_at_k(grades: Grades, ranking: Ranking, k: int) -> float:
    relevant = {chunk_id for chunk_id, grade in grades.items() if grade > 0}
    if not relevant:
        return 0.0
    hit = relevant.intersection(set(ranking[:k]))
    return len(hit) / len(relevant)


def mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def summarize(per_query: Dict[str, Dict[str, List[float]]]) -> Dict[str, float]:
    """Flatten {suite: {metric: [per-query values]}} to {suite.metric: mean}."""
    flat: Dict[str, float] = {}
    for suite, metrics in per_query.items():
        for metric, values in metrics.items():
            flat[f"{suite}.{metric}"] = round(mean(values), 6)
    return flat


def approx_tokens(text: str) -> int:
    """chars/4 — deterministic, dependency-free token proxy."""
    return max(1, len(text) // 4)
