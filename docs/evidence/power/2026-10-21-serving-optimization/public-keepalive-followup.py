#!/usr/bin/env python3
"""One authorized follow-up and optional private comparison in the same phase."""
import importlib.util
import json
from pathlib import Path
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('keepalive_followup', HERE / 'public-keepalive-repro.py')
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)
prior = json.loads((HERE / 'public-keepalive-v1.json').read_text())
deadline = prior['started_monotonic'] + 180
k.main('public-keepalive-v2', deadline=deadline)
latest = json.loads((HERE / 'public-keepalive-v2.json').read_text())
records = latest['records']
connect_failed = bool(records and records[-1]['http_status'] is None and
                      not any(item['phase'] == 'connect-complete' for item in records[-1]['transport']['phases']))
if connect_failed and deadline - time.monotonic() > 15:
    k.main('private-keepalive-v1', deadline=deadline, host='172.18.101.2', text_turns=2, include_tool=False)
print(json.dumps({'phase_elapsed_seconds': time.monotonic() - prior['started_monotonic'],
                  'public_status': latest['qualification_status'], 'public_requests': len(records)}))
