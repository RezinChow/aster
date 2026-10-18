import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const here = dirname(fileURLToPath(import.meta.url));
const acl = readFileSync(resolve(here, '../../../api/gateway/gateway.acl'), 'utf8');
const webProxy = readFileSync(resolve(here, '../../rsbuild.config.ts'), 'utf8');

function routerBlock(name: string): string {
  const match = acl.match(
    new RegExp(`routers "${name}" \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match?.[1]) throw new Error(`missing routers "${name}"`);
  return match[1];
}

function serviceBlock(name: string): string {
  const match = acl.match(
    new RegExp(`services "${name}" \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match?.[1]) throw new Error(`missing services "${name}"`);
  return match[1];
}

function proxyTarget(source: string, path: string): string | null {
  const match = source.match(
    new RegExp(`['"]${path}['"]\\s*:\\s*\\{[^}]*target:\\s*['"]([^'"]+)['"]`),
  );
  return match?.[1] ?? null;
}

describe('gateway route document', () => {
  test('/v1/api/admin and /v1/api/org stay on a3s-api and /v2 stays on the registry', () => {
    expect(acl).not.toContain('routers "runtime"');
    expect(acl).not.toContain('services "a3s-runtime"');
    expect(acl).not.toMatch(/PathPrefix\(`\/v1\/api`\)/);

    const admin = routerBlock('api-admin');
    expect(admin).toContain('PathPrefix(`/v1/api/admin`)');
    expect(admin).toContain('service     = "a3s-api"');
    expect(admin).toContain('priority    = 110');
    const org = routerBlock('api-org');
    expect(org).toContain('PathPrefix(`/v1/api/org`)');
    expect(org).toContain('priority    = 110');
    expect(acl).not.toContain('routers "app"');
    expect(acl).not.toMatch(/PathPrefix\(`\/v1`\)/);

    const chat = routerBlock('openai');
    expect(chat).toContain('`/v1/models`');
    expect(chat).toContain('`/v1/chat/completions`');
    expect(chat).toContain('priority    = 100');

    const v2 = routerBlock('oci-registry');
    expect(v2).toContain('PathPrefix(`/v2`)');
    expect(v2).toContain('service     = "a3s-registry"');
    expect(serviceBlock('a3s-registry')).toContain('http://a3s-registry:5000');

    const legal = routerBlock('api-legal');
    expect(legal).toContain('PathPrefix(`/v1/api/legal`)');
    expect(legal).toContain('service     = "a3s-api"');
    expect(legal).toContain('priority    = 110');
    expect(legal).toContain('api-cors');
    expect(legal).not.toContain('api-auth');

    const useRegistry = routerBlock('use-registry');
    expect(useRegistry).toContain('PathPrefix(`/use-registry`)');
    expect(useRegistry).toContain('service     = "use-registry"');
    expect(useRegistry).toContain('use-registry-strip');
    expect(useRegistry).not.toContain('api-auth');
    expect(serviceBlock('use-registry')).toContain('http://host.docker.internal:4873');
    expect(serviceBlock('use-registry')).toContain('/metadata/root.json');
  });

  test('console proxies platform admin and member APIs straight to a3s-api', () => {
    expect(proxyTarget(webProxy, '/v1/api/admin')).toBe('http://127.0.0.1:3000');
    expect(proxyTarget(webProxy, '/v1/api/org')).toBe('http://127.0.0.1:3000');
    expect(proxyTarget(webProxy, '/v1/api/legal')).toBe('http://127.0.0.1:3000');
  });
});
