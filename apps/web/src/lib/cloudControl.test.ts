import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { apiRequest } from './apiClient';
import { ApiRequestError } from './apiEnvelope';
import { adaptCloudControlBody, cloudControlPath, tryCloudControl } from './cloudControl';
import { clearUserSession, setCloudPersonCredential, setUserSession } from './userSession';

const ORG = '01a0b765-869a-7743-b2b8-0a0dd58b0ce8';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const ENVIRONMENT = '22222222-2222-4222-8222-222222222222';

describe('cloudControlPath', () => {
  test('system SMS and service Secrets require no project or environment', () => {
    for (const suffix of ['sms/settings', 'sms/profiles', 'sms/messages', 'sms/profiles/ToWork/balance', 'sms/unknown-command', 'service-secrets', 'service-secrets/id/revoke']) {
      expect(cloudControlPath(`/cloud/${suffix}`, ORG)).toBe(`/organizations/${ORG}/${suffix}`);
    }
  });
  test('SMS and exact Secrets stay within the signed-in organization and selected environment', () => {
    for (const suffix of ['sms/settings', 'sms/profiles', 'sms/messages', 'sms/profiles/primary/balance', 'sms/unknown-command', 'secrets']) {
      expect(cloudControlPath(`/cloud/projects/${PROJECT}/environments/${ENVIRONMENT}/${suffix}`, ORG)).toBe(`/organizations/${ORG}/projects/${PROJECT}/environments/${ENVIRONMENT}/${suffix}`);
    }
  });
  test('maps session resources onto the organization control-plane paths', () => {
    expect(cloudControlPath('/cloud/projects', ORG)).toBe(
      `/organizations/${ORG}/projects`,
    );
    expect(
      cloudControlPath(`/cloud/projects/${PROJECT}/environments`, ORG),
    ).toBe(`/organizations/${ORG}/projects/${PROJECT}/environments`);
    expect(cloudControlPath('/cloud/workloads', ORG)).toBe(
      `/organizations/${ORG}/workload-service-loads`,
    );
    expect(cloudControlPath('/cloud/nodes', ORG)).toBe(
      `/organizations/${ORG}/nodes`,
    );
    expect(
      cloudControlPath(
        `/cloud/nodes/${PROJECT}/actions/drain`,
        ORG,
      ),
    ).toBe(`/organizations/${ORG}/nodes/${PROJECT}/actions/drain`);
    expect(
      cloudControlPath(
        `/cloud/nodes/${PROJECT}/actions/remove`,
        ORG,
      ),
    ).toBe(`/organizations/${ORG}/nodes/${PROJECT}/actions/remove`);
    expect(
      cloudControlPath(
        `/cloud/node-pools/${PROJECT}/maintenance/cancel`,
        ORG,
      ),
    ).toBe(`/organizations/${ORG}/node-pools/${PROJECT}/maintenance/cancel`);
  });

  test('puts durable cells under the project and environment from the query', () => {
    expect(
      cloudControlPath(
        `/cloud/durable-cells?projectId=${PROJECT}&environmentId=${ENVIRONMENT}`,
        ORG,
      ),
    ).toBe(
      `/organizations/${ORG}/projects/${PROJECT}/environments/${ENVIRONMENT}/durable-cell-applications`,
    );
    expect(
      cloudControlPath('/cloud/durable-cells', ORG),
    ).toBeNull();
  });

  test('leaves aggregations and other-tenant provisioning on the adapter', () => {
    expect(cloudControlPath('/cloud/functions', ORG)).toBeNull();
    expect(cloudControlPath('/cloud/skills?projectId=1', ORG)).toBeNull();
    expect(cloudControlPath('/cloud/enrollment-tokens', ORG)).toBeNull();
    expect(cloudControlPath('/cloud/organizations', ORG)).toBeNull();
    expect(cloudControlPath('/cloud/workspace', ORG)).toBeNull();
    expect(
      cloudControlPath(
        `/cloud/organizations/${ORG}/workspace`,
        ORG,
      ),
    ).toBeNull();
    expect(cloudControlPath('/identity/orgs', ORG)).toBeNull();
  });

  test('keeps agent runtime lookup query and maps the execution', () => {
    const execution = '33333333-3333-4333-8333-333333333333';
    expect(
      cloudControlPath(
        `/cloud/agent-runtimes/${execution}/logs?limit=20`,
        ORG,
      ),
    ).toBe(`/organizations/${ORG}/agent-runtimes/${execution}/logs?limit=20`);
    expect(
      cloudControlPath(
        `/cloud/agent-conversations/${execution}/agent-runtimes`,
        ORG,
      ),
    ).toBe(
      `/organizations/${ORG}/agent-conversations/${execution}/agent-runtimes`,
    );
  });
});

const HARNESS_DIGEST = 'a'.repeat(64);

/** AgentRuntimeProjection outer fields are camelCase; AgentRuntimeCorrelationV1 is not. */
function agentRuntimeWire() {
  return {
    correlation: {
      schema: 'cloud.agent-runtime.correlation.v1',
      organization_id: ORG,
      project_id: PROJECT,
      environment_id: ENVIRONMENT,
      agent_release_id: '66666666-6666-4666-8666-666666666666',
      agent_execution_id: 'exec',
      operation_id: 'op',
      harness_invocation_profile_digest: HARNESS_DIGEST,
    },
    conversationId: 'conv',
    status: 'running',
    fullyBound: true,
  };
}

describe('adaptCloudControlBody', () => {
  test('flattens an agent runtime projection and its mutation from the Cloud wire', () => {
    const nested = agentRuntimeWire();
    expect(adaptCloudControlBody(nested)).toMatchObject({
      agentExecutionId: 'exec',
      conversationId: 'conv',
      organizationId: ORG,
      projectId: PROJECT,
      environmentId: ENVIRONMENT,
      operationId: 'op',
      status: 'running',
      fullyBound: true,
      harnessInvocationProfileDigest: HARNESS_DIGEST,
    });
    expect(adaptCloudControlBody([nested])).toMatchObject([
      { agentExecutionId: 'exec', organizationId: ORG },
    ]);
    expect(
      adaptCloudControlBody({ projection: nested, replayed: false }),
    ).toMatchObject({
      projection: { agentExecutionId: 'exec', conversationId: 'conv', operationId: 'op' },
      replayed: false,
    });
  });

  test('unwraps a durable-cell mutation and flattens deploy and route receipts', () => {
    expect(
      adaptCloudControlBody({
        record: {
          application: { applicationId: 'app', name: 'cell' },
          revision: { revisionId: 'rev' },
        },
        replayed: false,
      }),
    ).toEqual({ applicationId: 'app', name: 'cell' });

    expect(
      adaptCloudControlBody({
        application: { applicationId: 'app' },
        revision: { revisionId: 'rev' },
      }),
    ).toEqual({
      application: { applicationId: 'app' },
      revision: { revisionId: 'rev' },
    });

    expect(
      adaptCloudControlBody({
        correlation: {
          applicationId: 'app',
          applicationRevisionId: 'rev',
          workloadId: 'wl',
          deploymentId: 'dep',
          operationId: 'op',
        },
        workload: { status: 'ready' },
        replayed: true,
      }),
    ).toMatchObject({
      applicationId: 'app',
      deploymentId: 'dep',
      status: 'ready',
      replayed: true,
    });

    expect(
      adaptCloudControlBody({
        correlation: {
          applicationId: 'app',
          applicationRevisionId: 'rev',
        },
        publication: {
          route: {
            id: 'route',
            hostname: 'cell.example',
            pathPrefix: '/',
            state: 'active',
          },
          replayed: false,
        },
      }),
    ).toMatchObject({
      routeId: 'route',
      hostname: 'cell.example',
      pathPrefix: '/',
      state: 'active',
      replayed: false,
    });
  });
});

function installStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

describe('mapped Cloud calls stay on the person credential', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    installStorage();
    clearUserSession();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearUserSession();
  });

  test('a mapped path does not fall back to the install-token adapter', async () => {
    const urls: string[] = [];
    setUserSession('a3s_us_test', ORG);
    setCloudPersonCredential({
      accessToken: `a3s_${'ab'.repeat(32)}`,
      organizationId: ORG,
      principalId: '44444444-4444-4444-8444-444444444444',
      subject: '55555555-5555-4555-8555-555555555555',
    });
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          code: 403,
          message: 'missing required scope',
          data: null,
          request_id: 'req-1',
          timestamp: '2026-09-23T00:00:00Z',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
    };

    await expect(apiRequest('/cloud/projects')).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'missing required scope',
    });
    await expect(apiRequest('/cloud/sms/messages')).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'missing required scope',
    });
    expect(urls.some((url) => url.includes('/v1/api/admin/cloud/'))).toBe(false);
    expect(urls.some((url) => url.includes('/cloud-api/organizations/'))).toBe(true);
  });

  test('a failed person credential is the error, not an adapter success', async () => {
    const urls: string[] = [];
    setUserSession('a3s_us_test', ORG);
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          code: 503,
          message: 'cloud credential issuer unavailable',
          data: null,
          request_id: 'req-2',
          timestamp: '2026-09-23T00:00:00Z',
        }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      );
    };

    const error = await apiRequest('/cloud/projects').then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(urls.some((url) => url.includes('/identity/cloud-credentials'))).toBe(true);
    expect(urls.some((url) => url.includes('/cloud/'))).toBe(false);
  });

  test('an unmapped aggregation still uses a3s-api', async () => {
    const urls: string[] = [];
    setUserSession('a3s_us_test', ORG);
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'OK',
          data: [],
          request_id: 'req-3',
          timestamp: '2026-09-23T00:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    await expect(apiRequest('/cloud/functions')).resolves.toEqual([]);
    expect(urls.some((url) => url.includes('/v1/api/admin/cloud/functions'))).toBe(true);
    expect(urls.some((url) => url.includes('/cloud-api/'))).toBe(false);
  });

  test('tryCloudControl reports an unmapped path without calling Cloud', async () => {
    globalThis.fetch = async () => {
      throw new Error('fetch should not run');
    };
    await expect(tryCloudControl('/cloud/skills')).resolves.toEqual({ ok: false });
  });
});
