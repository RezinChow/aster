"""Qualify all observed replay fields, including display/usage isolation at the live endpoint."""
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
    source = Path(__file__).resolve().parents[2] / '2026-10-21-workbuddy-compatibility' / 'qualify.py'
    spec = importlib.util.spec_from_file_location('protocol_qualification', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.annotate = annotate
    module.main()
    output = Path(args.output)
    result = json.loads(output.read_text())
    host = '117.162.0.179' if args.public else '172.18.101.2'
    for streaming in (True, False):
        record = {'case': 'messages-2-all-observed-fields-stream' if streaming else 'client-usage-not-authoritative',
                  'annotation_fields': list(FIELDS)}
        try:
            body = screenshot_body()
            body['stream'] = streaming
            details, value = module.request(host, 8080, '/v1/chat/completions', body, module.credential())
            record.update(details)
            assert record['http_status'] == 200
            if streaming:
                assert record['done'] and not record['stream_errors']
                assert record['text'].strip() == 'OK' and record['finish_reasons'] == ['stop']
            else:
                assert value['choices'][0]['message']['content'].strip() == 'OK'
                assert value['model'] == 'prism-27b'
                usage = value['usage']
                assert all(isinstance(usage[field], int) and 0 < usage[field] < 999999
                           for field in ('prompt_tokens', 'completion_tokens'))
                assert usage['total_tokens'] == usage['prompt_tokens'] + usage['completion_tokens']
                assert 'CLIENT_DISPLAY_OVERRIDE' not in json.dumps(value) and '999999' not in json.dumps(value)
                record['actual_usage'] = usage
                record['reported_model'] = value['model']
            record['passed'] = True
        except Exception as error:
            record.update(passed=False, exception=type(error).__name__, detail=str(error)[:250])
        result['records'].append(record)
        print(json.dumps(record), flush=True)
    result['annotation_fields'] = list(FIELDS)
    result['passed'] = all(row['passed'] for row in result['records'])
    output.write_text(json.dumps(result, indent=2) + '\n')
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
