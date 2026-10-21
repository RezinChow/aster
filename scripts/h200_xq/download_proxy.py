#!/usr/bin/env python3
"""Loopback-only CONNECT adapter for temporary SSH reverse SOCKS downloads."""

import http.server
import select
import socket
import struct

from download_auth import PROXY_PORTS, socks_authentication

HOST_SUFFIXES = ('huggingface.co', 'hf.co', 'pypi.org', 'pythonhosted.org')
SOCKS_PORTS = PROXY_PORTS


def target(authority):
    host, port = authority.rsplit(':', 1)
    host = host.lower()
    if port != '443' or not host or len(host) > 253:
        raise ValueError('only HTTPS download targets are allowed')
    if not all(c in 'abcdefghijklmnopqrstuvwxyz0123456789.-' for c in host):
        raise ValueError('invalid download hostname')
    if not any(host == suffix or host.endswith('.' + suffix) for suffix in HOST_SUFFIXES):
        raise ValueError('download hostname is outside the allowed sources')
    return host, int(port)


def receive_exact(stream, count):
    data = b''
    while len(data) < count:
        block = stream.recv(count-len(data))
        if not block:
            raise ConnectionError('truncated SOCKS response')
        data += block
    return data


def connect(host, port):
    proxy = socket.create_connection(('127.0.0.1', SOCKS_PORTS[hash(host) % len(SOCKS_PORTS)]), timeout=30)
    try:
        authentication = socks_authentication()
        method = b'\x02' if authentication else b'\x00'
        proxy.sendall(b'\x05\x01'+method)
        if receive_exact(proxy, 2) != b'\x05'+method:
            raise ConnectionError('SOCKS authentication method refused')
        if authentication:
            username, password = authentication
            proxy.sendall(b'\x01'+bytes([len(username)])+username+bytes([len(password)])+password)
            if receive_exact(proxy, 2) != b'\x01\x00':
                raise ConnectionError('SOCKS authentication failed')
        encoded = host.encode('ascii')
        proxy.sendall(b'\x05\x01\x00\x03' + bytes([len(encoded)]) + encoded + struct.pack('!H', port))
        reply = receive_exact(proxy, 4)
        if reply[:3] != b'\x05\x00\x00':
            raise ConnectionError('SOCKS CONNECT failed')
        if reply[3] == 1:
            length = 4
        elif reply[3] == 4:
            length = 16
        elif reply[3] == 3:
            length = receive_exact(proxy, 1)[0]
        else:
            raise ConnectionError('SOCKS address type is invalid')
        receive_exact(proxy, length+2)
        proxy.settimeout(None)
        return proxy
    except BaseException:
        proxy.close()
        raise


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_CONNECT(self):
        try:
            host, port = target(self.path)
        except ValueError:
            self.send_error(403)
            return
        try:
            upstream = connect(host, port)
        except OSError:
            self.send_error(502)
            return
        self.send_response(200, 'Connection Established')
        self.end_headers()
        self.wfile.flush()
        try:
            while True:
                ready, _, _ = select.select([self.connection, upstream], [], [], 120)
                if not ready:
                    return
                for source in ready:
                    block = source.recv(256 * 1024)
                    if not block:
                        return
                    destination = upstream if source is self.connection else self.connection
                    destination.sendall(block)
        except OSError:
            pass
        finally:
            upstream.close()
            self.close_connection = True


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', 18088), Handler).serve_forever()
