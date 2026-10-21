#!/usr/bin/env python3
"""Small real-model correctness checks before retaining a throughput profile."""

import json
import hashlib
import urllib.request

from service import MODEL_NAME, PRIVATE


def complete(payload):
    request = urllib.request.Request(
        'http://127.0.0.1:30002/v1/chat/completions',
        data=json.dumps({'model': MODEL_NAME, 'temperature': 0, 'max_tokens': 512,
                         'stream': False, **payload}).encode(),
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer '+(PRIVATE/'api.key').read_text().strip()})
    with urllib.request.urlopen(request, timeout=1800) as response:
        body = response.read(4 * 1024**2+1)
    if len(body) > 4 * 1024**2:
        raise RuntimeError('qualification response exceeds its size limit')
    return json.loads(body)


def qualify():
    records = []
    for problem, expected in [('17 + 25', '42'), ('9 * 13', '117'), ('100 - 37', '63')]:
        result = complete({'messages': [{'role': 'user',
                            'content': f'Calculate {problem}. Reply with only the integer answer.'}]})
        message = result['choices'][0]['message']
        answer = (message.get('content') or '').strip()
        records.append({'check': problem, 'expected': expected, 'answer': answer,
                        'passed': answer == expected, 'usage': result.get('usage')})
    result = complete({
        'messages': [{'role': 'user', 'content': 'Use get_temperature for Shanghai. Set city to the exact string Shanghai.'}],
        'tools': [{'type': 'function', 'function': {
            'name': 'get_temperature', 'description': 'Read the temperature for a city.',
            'parameters': {'type': 'object', 'properties': {'city': {'type': 'string', 'enum': ['Shanghai']}},
                           'required': ['city'], 'additionalProperties': False}}}],
        'tool_choice': {'type': 'function', 'function': {'name': 'get_temperature'}},
    })
    calls = result['choices'][0]['message'].get('tool_calls') or []
    correct = False
    if len(calls) == 1:
        function = calls[0].get('function') or {}
        try:
            arguments = json.loads(function.get('arguments', ''))
        except (ValueError, TypeError):
            arguments = None
        correct = function.get('name') == 'get_temperature' and arguments == {'city': 'Shanghai'}
    records.append({'check': 'forced_tool_call', 'passed': correct, 'calls': calls,
                    'usage': result.get('usage')})
    return {'passed': all(record['passed'] for record in records), 'checks': records}


def qualify_long_context():
    records = []
    for count, needle in [(512, 183), (1024, 1003)]:
        codes = [hashlib.sha256(f'h200-context-check-{index}'.encode()).hexdigest()[:12]
                 for index in range(count)]
        table = '\n'.join(f'record {index:04d}: {code}' for index, code in enumerate(codes))
        prompt = (table+f'\nReturn only the exact lowercase code for record {needle:04d}. '
                  'Copy it from the reference table. Do not explain.')
        result = complete({'messages': [{'role': 'user', 'content': prompt}]})
        answer = (result['choices'][0]['message'].get('content') or '').strip()
        records.append({'check': 'long_context_copy', 'reference_records': count, 'needle': needle,
                        'expected': codes[needle], 'answer': answer, 'passed': answer == codes[needle],
                        'usage': result.get('usage')})
    return {'passed': all(record['passed'] for record in records), 'checks': records}


if __name__ == '__main__':
    print(json.dumps(qualify(), indent=2), flush=True)
