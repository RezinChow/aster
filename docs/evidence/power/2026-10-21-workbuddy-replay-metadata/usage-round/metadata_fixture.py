"""All twelve message keys observed in the actual WorkBuddy failures; synthetic values."""
FIELDS = ('agent', 'conversationRequestId', 'startsNewUserRequest', 'messageId', 'model',
          'requestModelId', 'requestModelName', 'stepSeq', 'traceId',
          'argumentsDisplayText', 'rawUsage', 'usage')


def annotate(message):
    message.update(agent={'name': 'synthetic-workbuddy'},
                   conversationRequestId='synthetic-conversation-request', startsNewUserRequest=False,
                   messageId='synthetic-history-message', model='history-label-not-a-deployed-model',
                   requestModelId='synthetic-request-model-id', requestModelName='synthetic-request-model-name',
                   stepSeq=3, traceId='synthetic-trace', argumentsDisplayText='CLIENT_DISPLAY_OVERRIDE',
                   rawUsage={'input_tokens': 999999, 'output_tokens': 999999},
                   usage={'prompt_tokens': 999999, 'completion_tokens': 999999})
    return message


def screenshot_body():
    return {'model': 'prism-27b', 'max_tokens': 32, 'temperature': 0, 'stream': True,
            'messages': [{'role': 'system', 'content': 'Synthetic protocol test.'},
                         {'role': 'user', 'content': 'hi'},
                         annotate({'role': 'assistant', 'content': 'Hello.'}),
                         {'role': 'user', 'content': 'Reply with exactly OK.'}]}
