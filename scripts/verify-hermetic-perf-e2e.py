#!/usr/bin/env python3
"""Named-YOLO hermetic Core/ACP/TUI e2e pack with paired bins.

Opt-in. Does not change default build/CI. After `just build`, pin
ASTER_ACP_BIN / ASTER_TUI_BIN to target/debug so cargo test cannot
rebuild ACP alone and break the aster+aster-acp pair.

    just build
    python3 scripts/verify-hermetic-perf-e2e.py
    python3 scripts/verify-hermetic-perf-e2e.py --suite tui_913_hermetic

Exit 0 = every selected suite passed; 1 = at least one failed.
%≠Pass; green suites ≠ Meta Harness / named YOLO Done.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time

REPO = pathlib.Path(__file__).resolve().parent.parent

# Frozen pack for named YOLO 全面端到端 (hermetic only; headed/live parked).
# ACP integration binaries first; HG2 lib graders last (高效 knives).
SUITES = [
    'tui_913_hermetic',
    'acp_conformance_stdio',
    'protocol_commands_stdio',
    'memory_canonical_stdio',
    'workspace_layer_trust_stdio',
    'approval_rules_stdio',
    'client_fs_stdio',
    'shell_bypass_learning',
    'retrieval_qualification_stdio',
    'plugin_workspace_stdio',
    'codex_account_stdio',
    'local_model_responses_stdio',
    'account_import_opt_in_stdio',
    'consumer_deny',
    'startup_error',
    'memory_management',
    'unattended_e2e',
    'long_horizon_contracts',
    'long_horizon_rust_stdio',
    'long_horizon_preflight',
    # Lib graders (not --test binaries): measurable HG2 surfaces ≠ product Pass.
    'hg2_core_discard',
    'hg2_acp_token',
    'hg2_pager_latency',
    'hg2_read_batch_fit_len',
    'hg2_cancel_banner_line',
    'hg2_json_serialized_len',
    'hg2_json_update_sha256',
    'hg2_shell_merge_meta',
    'hg2_web_search_discard',
    'hg2_stream_toolcall_snapshot',
    'hg2_h6_toolcallid',
    'hg2_tui_first_stream_thinking',
    'hg2_tui_start_turn_thinking',
    'hg2_acp_stream_start_meta',
    'hg2_a5_nested_task_deny',
    'hg2_a4_skill_override_report',
    'hg2_h7_cancel_bg_toast',
    'hg2_kstudio_skill_root',
    'hg2_kstudio_layout_contract',
    'hg2_kstudio_readme_skip',
    'hg2_kstudio_factory_bundle',
    'hg2_kstudio_aster_root',
    'hg2_kstudio_project_acl',
    'hg2_kstudio_workflow_helpers',
    'hg2_e8_compaction_failed',
    'hg2_e2_empty_line_refuse',
    'hg2_p7_feature_switch',
    'hg2_p7_dynamic_refuse',
    'hg2_p7_experimental_refuse',
    'hg2_slash_gate_init',
    'hg2_p8_permission_denial',
    'hg2_blockcontext_appearance_arc',
    'hg2_e4_update_plan_discarded',
    'hg2_c1_confine_verify_stub',
    'hg2_e4_bm25_query_discarded',
    'hg2_e4_generate_object_stream',
]

# name → (package, cargo filter substring under --lib)
LIB_SUITES = {
    'hg2_core_discard': ('aster-core', 'hg2_discard_freeze_grader'),
    'hg2_acp_token': ('aster-acp', 'hg2_token_freeze_grader'),
    'hg2_pager_latency': ('aster-pager', 'hg2_estimate_line_widths_latency_freeze'),
    'hg2_read_batch_fit_len': ('aster-core', 'batch_response_len_matches_rendered_string'),
    'hg2_cancel_banner_line': ('aster-pager', 'banner_line_is_phrase_with_period'),
    'hg2_json_serialized_len': ('aster-core', 'hg2_json_serialized_len_matches_to_vec'),
    'hg2_json_update_sha256': ('aster-core', 'hg2_json_update_sha256_matches_to_vec'),
    'hg2_shell_merge_meta': ('aster-shell', 'equal_aster_generation_delta_meta_merges_consecutive_chunks'),
    'hg2_h6_toolcallid': ('aster-acp', 'subagent_finished_wire_copies_parent_tool_call_id'),
    'hg2_web_search_discard': ('aster-core', 'hg2_web_search_discarded_chars_freeze'),
    'hg2_stream_toolcall_snapshot': ('aster-core', 'hg2_stream_toolcall_snapshot_preserves_bound_args'),
    'hg2_tui_first_stream_thinking': ('aster-pager', 'first_stream_start_pre_creates_thinking'),
    'hg2_tui_start_turn_thinking': ('aster-pager', 'start_turn_pre_creates_thinking_chrome'),
    'hg2_acp_stream_start_meta': ('aster-acp', 'notification_meta_stamps_turn_and_stream_start_ms'),
    'hg2_a5_nested_task_deny': ('aster-core', 'scoped_tools_reject_nested_task_name'),
    'hg2_a4_skill_override_report': (
        'aster-core',
        'test_load_from_dir_duplicate_name_overrides_previous_definition',
    ),
    'hg2_h7_cancel_bg_toast': (
        'aster-pager',
        'cancel_complete_toasts_when_background_tasks_still_run',
    ),
    'hg2_kstudio_skill_root': (
        'aster-core',
        'agent_skill_roots_include_kstudio_skills_last',
    ),
    'hg2_kstudio_layout_contract': (
        'aster-core',
        'vendored_layout_contract_declares_schema_id',
    ),
    'hg2_kstudio_readme_skip': (
        'aster-core',
        'test_load_from_dir',
    ),
    'hg2_kstudio_factory_bundle': (
        'aster-core',
        'bundled_factory_skeleton_contains_manifest_and_seed_paths',
    ),
    'hg2_kstudio_aster_root': (
        'aster-core',
        'kstudio_root_prefers_aster_engineering_then_legacy',
    ),
    'hg2_kstudio_project_acl': (
        'aster-core',
        'materialize_factory_seeds_creates_missing_only',
    ),
    'hg2_kstudio_workflow_helpers': (
        'aster-core',
        'materialize_seeds_workflow_helpers_under_aster',
    ),
    'hg2_e8_compaction_failed': (
        'aster-core',
        'mid_flight_failure_leaves_failed_not_started',
    ),
    'hg2_e2_empty_line_refuse': (
        'aster-effect',
        'empty_mid_file_line_refuses_the_whole_read',
    ),
    'hg2_p7_feature_switch': (
        'aster-acp',
        'initialize_projects_feature_switch_admission',
    ),
    'hg2_p7_dynamic_refuse': (
        'aster-core',
        'register_dynamic_tool_refuses_removed_feature_switch_names',
    ),
    'hg2_p7_experimental_refuse': (
        'aster-core',
        'register_dynamic_tool_refuses_experimental_feature_switch_names',
    ),
    'hg2_slash_gate_init': (
        'aster-pager',
        'apply_aster_slash_gate_hides_unsupported_builtins',
    ),
    'hg2_p8_permission_denial': (
        'aster-acp',
        'permission_denial_raw_output_carries_stable_code',
    ),
    'hg2_blockcontext_appearance_arc': (
        'aster-pager',
        'context_with_mode_arc_shares_appearance_pointer',
    ),
    'hg2_e4_update_plan_discarded': (
        'aster-core',
        'update_plan_reports_discarded_chars_when_steps_truncate',
    ),
    'hg2_c1_confine_verify_stub': (
        'aster-confine',
        'verify_entry_points_fail_closed_with_stable_stub_message',
    ),
    'hg2_e4_bm25_query_discarded': (
        'aster-core',
        'bounded_query_display_reports_discarded_chars',
    ),
    'hg2_e4_generate_object_stream': (
        'aster-core',
        'generate_object_tool_unwraps_array_schema_and_sets_metadata',
    ),
}

RESULT_RE = re.compile(
    r'test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored')
FAILED_RE = re.compile(r'^test (\S+) \.\.\. FAILED', re.M)


def paired_bins(env: dict[str, str]) -> dict[str, str]:
    acp = REPO / 'target' / 'debug' / 'aster-acp'
    tui = REPO / 'target' / 'debug' / 'aster'
    env = dict(env)
    env['ASTER_ACP_BIN'] = str(acp)
    env['ASTER_TUI_BIN'] = str(tui)
    env['CARGO_TARGET_DIR'] = str(REPO / 'target')
    return env


def just_build(env: dict[str, str]) -> None:
    """Rebuild aster + aster-acp into the same target/ so BUILD_ID matches."""
    proc = subprocess.run(
        ['just', 'build'], cwd=REPO, env=env, capture_output=True, text=True,
        timeout=1200,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout or '')
        sys.stderr.write(proc.stderr or '')
        raise SystemExit(f'just build failed with exit {proc.returncode}')
    acp = pathlib.Path(env['ASTER_ACP_BIN'])
    tui = pathlib.Path(env['ASTER_TUI_BIN'])
    if not acp.is_file() or not tui.is_file():
        raise SystemExit(f'missing paired bins after just build ({acp}, {tui})')


def run_lib_suite(
    name: str, package: str, filter_name: str, log_dir: pathlib.Path, env: dict[str, str],
) -> dict:
    """Run a focused --lib filter (HG2 graders). No paired binary rebuild."""
    log = log_dir / f'{name}.log'
    cmd = [
        'cargo', 'test', '--locked', '-p', package, '--lib', filter_name,
        '--', '--test-threads=1',
    ]
    started = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd, cwd=REPO, env=env, capture_output=True, text=True, timeout=1200,
        )
    except subprocess.TimeoutExpired:
        return {
            'suite': name, 'exit': 124, 'timed_out': True,
            'passed': 0, 'failed': 0, 'ignored': 0,
            'failed_tests': [], 'log': str(log), 'seconds': 1200.0,
        }
    elapsed = round(time.perf_counter() - started, 2)
    log.write_text((proc.stdout or '') + '\n' + (proc.stderr or ''))
    matches = RESULT_RE.findall(proc.stdout or '')
    passed, failed, ignored = map(int, matches[-1]) if matches else (0, 0, 0)
    return {
        'suite': name,
        'exit': proc.returncode,
        'seconds': elapsed,
        'passed': passed,
        'failed': failed,
        'ignored': ignored,
        'log': str(log),
        'failed_tests': FAILED_RE.findall(proc.stdout or ''),
        'kind': 'lib',
        'package': package,
        'filter': filter_name,
    }


def run_suite(name: str, log_dir: pathlib.Path, env: dict[str, str]) -> dict:
    if name in LIB_SUITES:
        package, filter_name = LIB_SUITES[name]
        return run_lib_suite(name, package, filter_name, log_dir, env)

    log = log_dir / f'{name}.log'
    # Compile first (may rebuild aster-acp alone), then re-pair, then execute.
    compile_cmd = [
        'cargo', 'test', '--locked', '-p', 'aster-acp', '--test', name,
        '--no-run',
    ]
    run_cmd = [
        'cargo', 'test', '--locked', '-p', 'aster-acp', '--test', name,
        '--', '--test-threads=1',
    ]
    started = time.perf_counter()
    try:
        compile_proc = subprocess.run(
            compile_cmd, cwd=REPO, env=env, capture_output=True, text=True,
            timeout=1200,
        )
        if compile_proc.returncode != 0:
            elapsed = round(time.perf_counter() - started, 2)
            log.write_text(
                (compile_proc.stdout or '') + '\n' + (compile_proc.stderr or '')
            )
            return {
                'suite': name, 'exit': compile_proc.returncode,
                'seconds': elapsed, 'passed': 0, 'failed': 1, 'ignored': 0,
                'failed_tests': ['compile'], 'log': str(log),
            }
        just_build(env)
        proc = subprocess.run(
            run_cmd, cwd=REPO, env=env, capture_output=True, text=True,
            timeout=1200,
        )
    except subprocess.TimeoutExpired:
        return {
            'suite': name, 'exit': 124, 'timed_out': True,
            'passed': 0, 'failed': 0, 'ignored': 0,
            'failed_tests': [], 'log': str(log), 'seconds': 1200.0,
        }
    elapsed = round(time.perf_counter() - started, 2)
    log.write_text((proc.stdout or '') + '\n' + (proc.stderr or ''))
    matches = RESULT_RE.findall(proc.stdout or '')
    passed, failed, ignored = map(int, matches[-1]) if matches else (0, 0, 0)
    return {
        'suite': name,
        'exit': proc.returncode,
        'seconds': elapsed,
        'passed': passed,
        'failed': failed,
        'ignored': ignored,
        'log': str(log),
        'failed_tests': FAILED_RE.findall(proc.stdout or ''),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suite', action='append', default=[],
                        help='run only these suites (repeatable)')
    parser.add_argument('--exclude', action='append', default=[],
                        help='skip these suites (repeatable)')
    parser.add_argument('--out', type=pathlib.Path,
                        help='write a JSON summary to this path')
    parser.add_argument(
        '--log-dir', type=pathlib.Path,
        default=pathlib.Path(tempfile.gettempdir()) / 'aster-hermetic-perf-e2e',
        help='directory for per-suite logs',
    )
    args = parser.parse_args()

    selected = [
        name for name in SUITES
        if (not args.suite or name in args.suite) and name not in args.exclude
    ]
    if not selected:
        parser.error('no suites selected')

    env = paired_bins(os.environ)
    just_build(env)
    args.log_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for name in selected:
        row = run_suite(name, args.log_dir, env)
        results.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)

    summary = {
        'pack': 'hermetic-perf-e2e',
        'aster_acp_bin': env['ASTER_ACP_BIN'],
        'aster_tui_bin': env['ASTER_TUI_BIN'],
        'suites': len(results),
        'passed': sum(r['passed'] for r in results),
        'failed': sum(r['failed'] for r in results),
        'ignored': sum(r['ignored'] for r in results),
        'seconds': round(sum(r.get('seconds', 0) for r in results), 2),
        'failed_suites': [
            r['suite'] for r in results
            if r['failed'] or r['exit'] or r.get('timed_out')
        ],
        'results': results,
        'explicitly_not_claimed': [
            'named YOLO Done',
            'Meta Harness Pass',
            'headed Studio / live LLM',
        ],
    }
    if args.out:
        args.out.write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({
        key: summary[key] for key in (
            'pack', 'suites', 'passed', 'failed', 'ignored', 'seconds',
            'failed_suites',
        )
    }, indent=2), flush=True)
    sys.exit(1 if summary['failed_suites'] else 0)


if __name__ == '__main__':
    main()
