#!/usr/bin/env python3
"""Private, loopback-only adapter to the pinned official recipe implementation."""

import importlib.util
import hashlib
import ipaddress
import os
import secrets
import sys
from pathlib import Path

SHARED_RECIPE = Path('/mnt/shared-storage-user/safeag-share/zoubo/deployments/deepseek-v4.1-flash-1017/recipe_server.py')
RECIPE_SHA256 = 'ad69210e9c5be88aec4bede3ad3b91906dbc8c9dbc44bf12c1673c58b9584ccd'
MODEL_PATH = '/mnt/shared-storage-gpfs2/gpfs2-shared-public/huggingface/hub/models--deepseek-ai--DeepSeek-V4.1-Flash-1017/snapshots/1bae0e1088993b9b82de08f59de5be5a34e42170'
EXISTING_BACKEND_KEY = Path('/root/deepseek-v4-1-flash-1017/backend-api-key')


class LoopbackRecipe:
    """Supply the adapter's own auth only for local HTTP clients; stream unchanged."""

    def __init__(self, upstream, token):
        self.upstream = upstream
        self.authorization = ('Bearer '+token).encode('ascii')

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'lifespan':
            return await self.upstream(scope, receive, send)
        client = scope.get('client')
        try:
            allowed = bool(client) and ipaddress.ip_address(client[0]).is_loopback
        except ValueError:
            allowed = False
        if scope['type'] != 'http' or not allowed:
            if scope['type'] == 'websocket':
                await send({'type': 'websocket.close', 'code': 1008})
            else:
                await send({'type': 'http.response.start', 'status': 403, 'headers': []})
                await send({'type': 'http.response.body', 'body': b'loopback clients only'})
            return
        private_scope = dict(scope)
        private_scope['headers'] = [(name, value) for name, value in scope.get('headers', [])
                                    if name.lower() != b'authorization']
        private_scope['headers'].append((b'authorization', self.authorization))
        return await self.upstream(private_scope, receive, send)


def main():
    source = SHARED_RECIPE.read_bytes()
    if hashlib.sha256(source).hexdigest() != RECIPE_SHA256:
        raise RuntimeError('shared recipe source differs from the pinned implementation')
    key = EXISTING_BACKEND_KEY.read_text().strip()
    if not key or len(key) > 4096 or any(character in key for character in '\r\n'):
        raise RuntimeError('existing backend credential is missing or malformed')
    token = secrets.token_hex(32)
    os.environ.update(DS_MODEL_PATH=MODEL_PATH, SGLANG_URL='http://127.0.0.1:30000',
                      SERVED_MODEL_NAME='deepseek-v4.1-flash-1017',
                      WRAPPER_API_KEY=token, SGLANG_API_KEY=key, DIVERT_API_KEY='',
                      SSE_KEEPALIVE_SEC='15', DEFAULT_MAX_OUTPUT_TOKENS='4096')
    specification = importlib.util.spec_from_file_location('official_recipe', SHARED_RECIPE)
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    import uvicorn
    uvicorn.run(LoopbackRecipe(module.app, token), host='127.0.0.1', port=30103,
                proxy_headers=False, access_log=False)


if __name__ == '__main__':
    main()
