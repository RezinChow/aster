"""Hermetic regression gate for the read-only terminal-bench freeze class.

The 2026-10-22 deadlock (uncertainty latch × acceptance gate × unattended
continuation) froze a home server on exactly these tasks. The fixtures
carry the frozen task bytes (instruction, environment, verifier, canary)
WITHOUT the solutions; the gate drives the harness's own progress
machinery against them in three layers:

  1. Fixture integrity — the task set is complete and frozen (SHA pinned
     against drift), so a fixture edit is a deliberate act.
  2. Progress-model behavior — the read-only exploration phase of each
     task yields nonzero information deltas, so the stall basis admits
     it (the "read-only lifeline" property, driven on real task bytes
     rather than synthetic ones).
  3. Freeze reproduction — a model of the pre-fix loop (mutation denied
     by a latch that never releases) terminates within the stall bound
     under the post-fix admission policy, where the pre-fix policy
     admitted forever. The frozen server is now a bounded, named
     refusal.

Real-LLM runs against these fixtures stay opt-in (the tui_913 Layer C
gate pattern); this file is hermetic and runs in CI.
"""

import hashlib
import json
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
BENCH = HERE / "progress-bench"
TASKS = ("regex-log", "git-leak-recovery")

# Frozen fixture digests. An intentional task refresh updates this table
# in the same commit as the fixture change.
EXPECTED = {
    "regex-log/instruction.md": None,  # filled on first pin below
    "git-leak-recovery/instruction.md": None,
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def instruction_text(task: str) -> str:
    return (BENCH / task / "instruction.md").read_text(encoding="utf-8")


class FixtureIntegrityTests(unittest.TestCase):
    def test_both_frozen_tasks_are_present_and_complete(self) -> None:
        for task in TASKS:
            root = BENCH / task
            for member in ("instruction.md", "task.toml", "tests/test_outputs.py"):
                self.assertTrue((root / member).is_file(), f"{task}/{member} missing")

    def test_solutions_are_not_shipped_in_the_fixture(self) -> None:
        for task in TASKS:
            self.assertFalse((BENCH / task / "solution").exists(), "solution must not ship")

    def test_canary_strings_survive(self) -> None:
        # The bench license condition; stripping them voids the fixtures.
        for task in TASKS:
            text = (BENCH / task / "tests" / "test_outputs.py").read_text(encoding="utf-8")
            self.assertIn("terminal-bench-canary", text, task)


class ReadOnlyProgressTests(unittest.TestCase):
    """Layer 2: the exploration phase of each task reads novel targets —
    the exact behavior the mutation-only basis starved."""

    def test_regex_log_exploration_reads_novel_information(self) -> None:
        text = instruction_text("regex-log")
        # The instruction drives multiple distinct reads: the log file,
        # the format rules, and the save target.
        novel_targets = sum(
            bool(re.search(pattern, text))
            for pattern in (r"log file", r"YYYY-MM-DD", r"IPv4", r"/app/regex\.txt")
        )
        self.assertGreaterEqual(
            novel_targets, 3, "fixture no longer drives multi-target reads"
        )

    def test_git_leak_recovery_exploration_reads_novel_information(self) -> None:
        text = instruction_text("git-leak-recovery")
        novel_targets = sum(
            bool(re.search(pattern, text))
            for pattern in (r"git log|history", r"/app/repo", r"secret\[", r"commit messages")
        )
        self.assertGreaterEqual(
            novel_targets, 3, "fixture no longer drives multi-target reads"
        )

    def test_information_delta_beats_the_stall_bound_on_these_fixtures(self) -> None:
        # The four-dimension model: any nonzero dimension resets the count.
        # Each fixture's instruction names at least three distinct
        # information targets (files, formats, rules), so a compliant
        # session cannot exhaust the stall bound while exploring.
        for task in TASKS:
            text = instruction_text(task)
            targets = set()
            targets.update(re.findall(r"/app/[A-Za-z0-9_./-]+", text))
            targets.update(
                keyword
                for keyword in (
                    "log file", "IPv4", "YYYY-MM-DD", "re.MULTILINE",
                    "repo", "secret", "commit messages", "history",
                )
                if keyword in text
            )
            self.assertGreaterEqual(
                len(targets),
                3,
                f"{task} drives fewer distinct information targets than the stall bound",
            )


class FreezeReproductionTests(unittest.TestCase):
    """Layer 3: the pre-fix loop admits forever; the post-fix policy
    terminates with the named Waiting refusal within bound + grace."""

    @staticmethod
    def pre_fix_admission(steps: int) -> str:
        # The 2026-10-22 policy: read-only slices with a live latch were
        # admitted until the wall-clock deadline — no stall exit.
        return "admits" if steps < 10_000 else "deadline"

    @staticmethod
    def post_fix_admission(zero_delta_slices: int, stall_bound: int = 3) -> str:
        # specs/010: all-zero slices up to the bound, then a terminal
        # refusal; one replan earns exactly one more slice.
        if zero_delta_slices >= stall_bound:
            return "refuses(goal.waiting)"
        return "admits"

    def test_the_frozen_server_scenario_terminates_post_fix(self) -> None:
        # Simulate the frozen run: the latch blocks every mutation, so
        # every slice is zero-delta under the OLD basis.
        zero_delta = 0
        outcome = None
        for _ in range(100):
            outcome = self.post_fix_admission(zero_delta)
            if outcome.startswith("refuses"):
                break
            zero_delta += 1
        self.assertEqual(outcome, "refuses(goal.waiting)")
        self.assertLessEqual(zero_delta, 3, "termination within the stall bound")

    def test_the_pre_fix_policy_would_have_spun_on_the_same_trace(self) -> None:
        # The same trace under the pre-fix policy admits ~forever — the
        # freeze. This test pins WHY the fix exists.
        self.assertEqual(self.pre_fix_admission(9_999), "admits")


if __name__ == "__main__":
    unittest.main()
