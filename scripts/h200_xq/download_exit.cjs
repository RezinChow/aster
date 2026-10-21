const net = require('node:net');
const crypto = require('node:crypto');

function reader(socket) {
  let buffer = Buffer.alloc(0), waiter = null, failed = null;
  const pump = () => {
    if (waiter && buffer.length >= waiter.count) {
      const current = waiter; waiter = null;
      const value = buffer.subarray(0, current.count);
      buffer = buffer.subarray(current.count); current.resolve(value);
    }
  };
  const fail = error => { failed = error; if (waiter) { waiter.reject(error); waiter = null; } };
  const data = chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > 131072) { fail(new Error('handshake limit')); socket.destroy(); return; }
    pump();
  };
  const close = () => fail(new Error('closed'));
  socket.on('data', data); socket.on('error', fail); socket.on('close', close);
  return {
    take(count) {
      if (failed) return Promise.reject(failed);
      return new Promise((resolve, reject) => { waiter = {count, resolve, reject}; pump(); });
    },
    release() {
      socket.off('data', data); socket.off('error', fail); socket.off('close', close);
      return buffer;
    }
  };
}

function same(actual, expected) {
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function serve(socket, configuration) {
  socket.setNoDelay(true); socket.setTimeout(20000, () => socket.destroy());
  const input = reader(socket);
  const hello = await input.take(2);
  if (hello[0] !== 5 || hello[1] < 1) throw new Error('invalid version');
  const methods = await input.take(hello[1]);
  if (!methods.includes(2)) { socket.end(Buffer.from([5, 255])); return; }
  socket.write(Buffer.from([5, 2]));
  const auth = await input.take(2);
  if (auth[0] !== 1 || auth[1] < 1) throw new Error('invalid authentication');
  const username = await input.take(auth[1]);
  const passwordSize = (await input.take(1))[0];
  if (!passwordSize) throw new Error('empty authentication');
  const password = await input.take(passwordSize);
  if (!same(username, configuration.username) || !same(password, configuration.password)) {
    socket.end(Buffer.from([1, 1])); return;
  }
  socket.write(Buffer.from([1, 0]));
  const request = await input.take(4);
  const deny = code => socket.end(Buffer.from([5, code, 0, 1, 0, 0, 0, 0, 0, 0]));
  if (request[0] !== 5 || request[2] !== 0) throw new Error('invalid request');
  if (request[1] !== 1) { deny(7); return; }
  if (request[3] !== 3) { deny(8); return; }
  const hostSize = (await input.take(1))[0];
  if (hostSize < 1 || hostSize > 253) { deny(2); return; }
  const hostBytes = await input.take(hostSize);
  const host = hostBytes.toString('ascii').toLowerCase();
  const port = (await input.take(2)).readUInt16BE(0);
  if (hostBytes.some(value => value > 127) || !/^[a-z0-9.-]+$/.test(host)
      || port !== 443 || !['huggingface.co', 'hf.co', 'github.com', 'githubusercontent.com',
                          'pypi.org', 'pythonhosted.org'].some(suffix => host === suffix || host.endsWith('.'+suffix))) {
    deny(2); return;
  }
  const upstream = net.createConnection({host, port, autoSelectFamily: true});
  upstream.setNoDelay(true); upstream.setTimeout(20000, () => upstream.destroy(new Error('connect timeout')));
  try {
    await new Promise((resolve, reject) => { upstream.once('connect', resolve); upstream.once('error', reject); });
  } catch {
    upstream.destroy(); deny(5); return;
  }
  upstream.setTimeout(240000, () => upstream.destroy());
  socket.setTimeout(240000);
  upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
  upstream.on('close', () => socket.destroy()); socket.on('close', () => upstream.destroy());
  const pending = input.release();
  socket.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
  if (pending.length) upstream.write(pending);
  socket.pipe(upstream); upstream.pipe(socket);
}

let bootstrap = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { bootstrap += chunk; if (bootstrap.length > 2048) process.exit(2); });
process.stdin.on('end', () => {
  try {
    const value = JSON.parse(bootstrap); bootstrap = '';
    if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535
        || typeof value.username !== 'string' || typeof value.password !== 'string'
        || value.password.length < 32 || value.password.length > 255) throw new Error('invalid bootstrap');
    const configuration = {username: Buffer.from(value.username), password: Buffer.from(value.password)};
    const server = net.createServer(socket => serve(socket, configuration).catch(() => socket.destroy()));
    server.maxConnections = 1024;
    server.on('error', () => process.exit(2));
    server.listen(value.port, '127.0.0.1', () => console.log(JSON.stringify({ready: true, pid: process.pid, port: value.port,
                                                                         max_connections: server.maxConnections})));
  } catch { process.exit(2); }
});
