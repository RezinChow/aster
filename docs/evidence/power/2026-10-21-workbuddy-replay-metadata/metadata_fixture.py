"""The nine WorkBuddy message keys observed in the reported failures; synthetic values only."""
FIELDS = ('agent', 'conversationRequestId', 'startsNewUserRequest', 'messageId', 'model',
          'requestModelId', 'requestModelName', 'stepSeq', 'traceId')


def annotate(message):
    message.update(agent={'name': 'synthetic-workbuddy'},
                   conversationRequestId='synthetic-conversation-request', startsNewUserRequest=False,
                   messageId='synthetic-history-message', model='history-label-not-a-deployed-model',
                   requestModelId='synthetic-request-model-id', requestModelName='synthetic-request-model-name',
                   stepSeq=3, traceId='synthetic-trace')
    return message


def screenshot_body():
    return {'model': 'prism-27b', 'max_tokens': 32, 'temperature': 0, 'stream': True,
            'messages': [{'role': 'system', 'content': 'Synthetic protocol test.'},
                         {'role': 'user', 'content': 'hi'},
                         annotate({'role': 'assistant', 'content': 'Hello.'}),
                         {'role': 'user', 'content': 'Reply with exactly OK.'}]}
