/**
 * Dev-only writer for apps/web/public/tenant/<slug>.
 * Registered before Rsbuild's built-in middleware. Other paths call next().
 * Client bundles must not import this module.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tenantInfoFromRecord } from '../src/prefs/tenantInfo.ts';
import { decodePngDataUrl, readTenantRecord, saveTenant } from '../../../scripts/tenant-fs.ts';

const BODY_LIMIT = 2_500_000;
const SLUG_RE = /^[a-z][a-z0-9-]{0,31}$/;

type Next = (error?: unknown) => void;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function pathnameOf(req: IncomingMessage): string {
  const raw = req.url ?? '/';
  const query = raw.indexOf('?');
  return query >= 0 ? raw.slice(0, query) : raw;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function tenantAdminMiddleware(launchSlug: string) {
  return function tenantAdmin(req: IncomingMessage, res: ServerResponse, next: Next) {
    const pathname = pathnameOf(req);
    if (pathname !== '/__tenant' && !pathname.startsWith('/__tenant/')) {
      next();
      return;
    }

    void handle(req, res, pathname, launchSlug).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) send(res, 400, { error: message });
    });
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  launchSlug: string,
) {
  if (pathname === '/__tenant') {
    if (req.method !== 'GET') {
      send(res, 405, { error: 'method' });
      return;
    }
    const tenant = launchSlug ? readTenantRecord(launchSlug) : null;
    send(res, 200, { launch: launchSlug, tenant });
    return;
  }

  const match = pathname.match(/^\/__tenant\/([a-z][a-z0-9-]{0,31})(\/repair)?$/);
  const slug = match?.[1] ?? '';
  if (!match || !SLUG_RE.test(slug) || slug !== launchSlug) {
    send(res, 404, { error: 'unknown tenant path' });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method' });
    return;
  }

  if (match[2]) {
    const record = readTenantRecord(slug);
    if (!record.info) {
      send(res, 422, { error: record.error ?? 'unreadable' });
      return;
    }
    send(res, 200, { info: record.info });
    return;
  }

  const raw = await readBody(req);
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    send(res, 400, { error: 'invalid json' });
    return;
  }
  const body = asRecord(parsed);
  if (!body) {
    send(res, 400, { error: 'invalid json' });
    return;
  }
  const info = tenantInfoFromRecord(body.info);
  if (info.slug !== slug) {
    send(res, 400, { error: `INFO.md field slug: must equal ${slug}` });
    return;
  }
  const logos = asRecord(body.logos);
  const light = typeof logos?.light === 'string' && logos.light ? decodePngDataUrl(logos.light) : undefined;
  const dark = typeof logos?.dark === 'string' && logos.dark ? decodePngDataUrl(logos.dark) : undefined;
  const saved = saveTenant(slug, info, { light, dark });
  send(res, 200, { info: saved.info });
}
