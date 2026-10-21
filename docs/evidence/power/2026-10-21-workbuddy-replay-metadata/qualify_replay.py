"""Run the production protocol suite with all observed replay metadata, including messages[2]."""
import argparse
import importlib.util
import json
from pathlib import Path

from metadata_fixture import FIELDS, annotate, screenshot_body


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--output', required=True)
    parser.add_argument('--public', action='store_true')
    args, _ = parser.parse_known_args()
    source = Path(__file__).resolve().parent.parent / '2026-10-21-workbuddy-compatibility' / 'qualify.py'
    spec = importlib.util.spec_from_file_location('protocol_qualification', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.annotate = annotate
    module.main()
    output = Path(args.output)
    result = json.loads(output.read_text())
    record = {'case': 'screenshot-messages-2-replay-metadata', 'annotation_fields': list(FIELDS)}
    try:
        details, _ = module.request('117.162.0.179' if args.public else '172.18.101.2', 8080,
                                    '/v1/chat/completions', screenshot_body(), module.credential())
        record.update(details)
        assert record['http_status'] == 200 and record['done'] and not record['stream_errors']
        assert record['text'].strip() == 'OK' and record['finish_reasons'] == ['stop']
        record['passed'] = True
    except Exception as error:
        record.update(passed=False, exception=type(error).__name__, detail=str(error)[:250])
    result['records'].append(record)
    result['annotation_fields'] = list(FIELDS)
    result['passed'] = all(row['passed'] for row in result['records'])
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(record), flush=True)
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
