import unittest

from loopback_recipe import LoopbackRecipe


class LoopbackBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_non_loopback_and_unknown_clients_never_reach_the_recipe(self):
        for client in [('10.102.1.2', 2345), ('localhost', 2345), None]:
            calls, sent = [], []
            async def upstream(*args):
                calls.append(args)
            async def send(value):
                sent.append(value)
            await LoopbackRecipe(upstream, 'private')(
                {'type': 'http', 'client': client}, None, send)
            self.assertFalse(calls)
            self.assertEqual(sent[0]['status'], 403)

    async def test_local_stream_is_forwarded_without_buffering_or_trusting_headers(self):
        for client in [('127.0.0.1', 2345), ('::1', 2345)]:
            sent, observations = [], []
            headers = [(b'Authorization', b'untrusted'), (b'authorization', b'other'),
                       (b'content-type', b'application/json')]
            scope = {'type': 'http', 'client': client, 'headers': headers}
            async def upstream(value, receive, send):
                observations.append(value)
                await send({'type': 'http.response.start', 'status': 200})
                await send({'type': 'http.response.body', 'body': b'data: first\n\n', 'more_body': True})
                self.assertEqual(sent[-1]['body'], b'data: first\n\n')
                await send({'type': 'http.response.body', 'body': b'data: [DONE]\n\n', 'more_body': False})
            async def send(value):
                sent.append(value)
            await LoopbackRecipe(upstream, 'private')(scope, None, send)
            self.assertEqual(observations[0]['headers'], [
                (b'content-type', b'application/json'), (b'authorization', b'Bearer private')])
            self.assertEqual(scope['headers'], headers)
            self.assertEqual(len(sent), 3)


if __name__ == '__main__':
    unittest.main()
