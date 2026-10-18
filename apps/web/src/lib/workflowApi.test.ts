import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { apiRequest } from './apiClient';
import { cloudControlPath } from './cloudControl';
import {
  getCloudWorkflowRunHistory,
  listCloudWorkflowRuns,
  parseCloudHumanTaskList,
  parseCloudWorkflowDefinition,
  parseCloudWorkflowDefinitionList,
  parseCloudWorkflowHistory,
  parseCloudWorkflowRevisionList,
  parseCloudWorkflowRun,
  parseCloudWorkflowRunList,
} from './workflowApi';
import {
  clearUserSession,
  setCloudPersonCredential,
  setUserSession,
} from './userSession';

const ORG = '01a0b765-869a-7743-b2b8-0a0dd58b0ce8';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const RUN = '33333333-3333-4333-8333-333333333333';

describe('cloudControlPath workflow mappings', () => {
  test('project-scoped workflow collections keep the project scope', () => {
    expect(
      cloudControlPath(`/cloud/projects/${PROJECT}/workflow-definitions`, ORG),
    ).toBe(`/organizations/${ORG}/projects/${PROJECT}/workflow-definitions`);
    expect(
      cloudControlPath(`/cloud/projects/${PROJECT}/workflow-runs`, ORG),
    ).toBe(`/organizations/${ORG}/projects/${PROJECT}/workflow-runs`);
    expect(
      cloudControlPath(`/cloud/projects/${PROJECT}/workflow-node-catalog`, ORG),
    ).toBe(`/organizations/${ORG}/projects/${PROJECT}/workflow-node-catalog`);
    expect(
      cloudControlPath(`/cloud/projects/${PROJECT}/human-tasks`, ORG),
    ).toBe(`/organizations/${ORG}/projects/${PROJECT}/human-tasks`);
  });

  test('workflow-scoped reads carry revisions and run sub-resources', () => {
    expect(
      cloudControlPath('/cloud/workflow-definitions/def-1', ORG),
    ).toBe(`/organizations/${ORG}/workflow-definitions/def-1`);
    expect(
      cloudControlPath('/cloud/workflow-definitions/def-1/revisions', ORG),
    ).toBe(`/organizations/${ORG}/workflow-definitions/def-1/revisions`);
    expect(
      cloudControlPath('/cloud/workflow-definitions/def-1/revisions/rev-2', ORG),
    ).toBe(`/organizations/${ORG}/workflow-definitions/def-1/revisions/rev-2`);
    expect(cloudControlPath(`/cloud/workflow-runs/${RUN}`, ORG)).toBe(
      `/organizations/${ORG}/workflow-runs/${RUN}`,
    );
    expect(
      cloudControlPath(`/cloud/workflow-runs/${RUN}/history`, ORG),
    ).toBe(`/organizations/${ORG}/workflow-runs/${RUN}/history`);
    expect(
      cloudControlPath(`/cloud/workflow-runs/${RUN}/diagnostics`, ORG),
    ).toBe(`/organizations/${ORG}/workflow-runs/${RUN}/diagnostics`);
    expect(cloudControlPath('/cloud/human-tasks/task-9', ORG)).toBe(
      `/organizations/${ORG}/human-tasks/task-9`,
    );
  });

  test('unmapped cloud paths stay null so a3s-api keeps them', () => {
    expect(cloudControlPath('/cloud/workflow-secrets', ORG)).toBeNull();
    expect(cloudControlPath('/cloud/workflow-runs', ORG)).toBeNull();
  });
});

describe('workflow projection parsers', () => {
  test('definitions parse from snake_case wire rows', () => {
    const parsed = parseCloudWorkflowDefinition({
      id: 'def-1',
      project_id: PROJECT,
      name: '履约工作流',
      description: '',
      current_revision_id: 'rev-1',
      current_revision_number: 3,
      current_revision_digest: 'sha256-aaa',
      created_at: '2026-09-28T00:00:00Z',
      updated_at: '2026-09-28T01:00:00Z',
    });
    expect(parsed).toEqual({
      id: 'def-1',
      projectId: PROJECT,
      name: '履约工作流',
      description: '',
      currentRevisionId: 'rev-1',
      currentRevisionNumber: 3,
      currentRevisionDigest: 'sha256-aaa',
      createdAt: '2026-09-28T00:00:00Z',
      updatedAt: '2026-09-28T01:00:00Z',
    });
    expect(parseCloudWorkflowDefinition({ broken: true })).toBeNull();
    expect(parseCloudWorkflowDefinitionList({ workflow_definitions: [{}] })).toEqual([]);
    expect(parseCloudWorkflowDefinitionList(null)).toEqual([]);
  });

  test('revisions read the flattened summary and reject unknown shapes', () => {
    const parsed = parseCloudWorkflowRevisionList({
      workflow_revisions: [
        {
          summary: { id: 'rev-1', revision_number: 1, digest: 'sha256-aaa' },
        },
        { id: 'rev-2', revisionNumber: 2, digest: 'sha256-bbb' },
        'junk',
      ],
    });
    expect(parsed).toEqual([
      { id: 'rev-1', revisionNumber: 1, digest: 'sha256-aaa', createdAt: '' },
      { id: 'rev-2', revisionNumber: 2, digest: 'sha256-bbb', createdAt: '' },
    ]);
  });

  test('runs parse snake_case rows and tolerate wrapped lists', () => {
    const parsed = parseCloudWorkflowRunList({
      workflow_runs: [
        {
          id: RUN,
          project_id: PROJECT,
          workflow_goal_id: 'goal-1',
          plan_revision_id: 'plan-1',
          plan_digest: 'sha256-plan',
          operation_id: 'op-1',
          flow_run_id: 'flow-1',
          status: 'running',
          output_digest: null,
          error: null,
          requested_at: '2026-09-28T00:00:00Z',
          updated_at: '2026-09-28T00:01:00Z',
          started_at: '2026-09-28T00:00:10Z',
          deadline_at: '2026-09-29T00:00:00Z',
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: RUN,
      status: 'running',
      workflowGoalId: 'goal-1',
      outputDigest: null,
      startedAt: '2026-09-28T00:00:10Z',
    });
    expect(parseCloudWorkflowRun({ id: RUN })).toMatchObject({
      id: RUN,
      status: '',
      outputDigest: null,
      error: null,
    });
    expect(parseCloudWorkflowRun(null)).toBeNull();
  });

  test('history pages keep sequence order data and the cursor', () => {
    const page = parseCloudWorkflowHistory({
      workflow_run_id: RUN,
      next_cursor: 'cursor-2',
      records: [
        { sequence: 1, kind: 'flow.started', occurred_at: '2026-09-28T00:00:00Z' },
        { sequence: 2, kind: 'step.succeeded', content: { node: 'b' } },
        'junk',
      ],
    });
    expect(page.workflowRunId).toBe(RUN);
    expect(page.nextCursor).toBe('cursor-2');
    expect(page.events).toHaveLength(2);
    expect(page.events[1]).toMatchObject({
      sequence: 2,
      kind: 'step.succeeded',
      content: { node: 'b' },
    });
    expect(parseCloudWorkflowHistory('junk').events).toEqual([]);
  });

  test('human tasks parse from the camelCase wire variant', () => {
    const parsed = parseCloudHumanTaskList({
      human_tasks: [
        {
          id: 'task-1',
          workflowRunId: RUN,
          stepId: 'approve',
          status: 'pending',
          claimedBy: null,
          decisionId: null,
          message: '需要人工审批',
          createdAt: '2026-09-28T00:00:00Z',
        },
      ],
    });
    expect(parsed[0]).toMatchObject({
      id: 'task-1',
      workflowRunId: RUN,
      status: 'pending',
      claimedBy: null,
    });
  });
});

describe('workflow reads ride the cloud control path', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
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
      },
    });
    clearUserSession();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearUserSession();
  });

  test('a signed-in person reads project runs straight from Cloud', async () => {
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
          code: 0,
          message: 'OK',
          data: {
            workflow_runs: [
              { id: RUN, project_id: PROJECT, status: 'succeeded' },
            ],
          },
          request_id: 'req-wf-1',
          timestamp: '2026-09-28T00:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const runs = await listCloudWorkflowRuns(PROJECT);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ id: RUN, status: 'succeeded' });
    expect(
      urls.some((url) =>
        url.includes(`/cloud-api/organizations/${ORG}/projects/${PROJECT}/workflow-runs`),
      ),
    ).toBe(true);
  });

  test('run history rides the same mapping', async () => {
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
          code: 0,
          message: 'OK',
          data: { records: [{ sequence: 1, kind: 'flow.started' }] },
          request_id: 'req-wf-2',
          timestamp: '2026-09-28T00:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const page = await getCloudWorkflowRunHistory(RUN);
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({ kind: 'flow.started' });
    expect(
      urls.some((url) =>
        url.includes(`/cloud-api/organizations/${ORG}/workflow-runs/${RUN}/history`),
      ),
    ).toBe(true);
  });

  test('without a person credential the read fails closed, never fakes rows', async () => {
    setUserSession('a3s_us_test', ORG);
    globalThis.fetch = async () => {
      throw new Error('network unreachable');
    };
    await expect(listCloudWorkflowRuns(PROJECT)).rejects.toBeInstanceOf(Error);
    await expect(apiRequest('/cloud/projects')).rejects.toBeInstanceOf(Error);
  });
});

describe('workflow desired-state submissions', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
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
      },
    });
    clearUserSession();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearUserSession();
  });

  function installPersonCredential() {
    setUserSession('a3s_us_test', ORG);
    setCloudPersonCredential({
      accessToken: `a3s_${'ab'.repeat(32)}`,
      organizationId: ORG,
      principalId: '44444444-4444-4444-8444-444444444444',
      subject: '55555555-5555-4555-8555-555555555555',
    });
  }

  test('publishing a definition posts an idempotent snake_case ACL payload', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    installPersonCredential();
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'OK',
          data: {
            workflow_definition: { id: 'def-1', project_id: PROJECT },
            replayed: false,
          },
          request_id: 'req-wf-3',
          timestamp: '2026-09-28T00:00:00Z',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };

    const { publishCloudWorkflowDefinition } = await import('./workflowApi');
    const result = await publishCloudWorkflowDefinition(PROJECT, {
      definitionAcl: 'acl:digest:aaa',
      payloads: [{ kind: 'graph', acl: 'acl:digest:graph' }],
    });

    expect(result).toMatchObject({
      workflow_definition: { id: 'def-1' },
      replayed: false,
    });
    const call = calls[0]!;
    expect(call.url).toContain(
      `/cloud-api/organizations/${ORG}/projects/${PROJECT}/workflow-definitions`,
    );
    expect(call.init.method).toBe('POST');
    const headers = new Headers(call.init.headers as HeadersInit);
    expect(headers.get('idempotency-key')).toBeTruthy();
    const body = JSON.parse(String(call.init.body));
    expect(body).toEqual({
      definition_acl: 'acl:digest:aaa',
      payloads: [{ kind: 'graph', acl: 'acl:digest:graph' }],
      semantic_contracts: undefined,
    });
  });

  test('starting a run posts goal and plan references and parses the run back', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    installPersonCredential();
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'OK',
          data: {
            workflow_run: {
              id: RUN,
              project_id: PROJECT,
              status: 'pending',
            },
            replayed: true,
          },
          request_id: 'req-wf-4',
          timestamp: '2026-09-28T00:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const { startCloudWorkflowRun } = await import('./workflowApi');
    const mutation = await startCloudWorkflowRun(PROJECT, {
      workflowGoalId: 'goal-1',
      planRevisionId: 'plan-1',
    });

    expect(mutation.replayed).toBe(true);
    expect(mutation.run).toMatchObject({ id: RUN, status: 'pending' });
    const call = calls[0]!;
    expect(call.url).toContain(
      `/cloud-api/organizations/${ORG}/projects/${PROJECT}/workflow-runs`,
    );
    const body = JSON.parse(String(call.init.body));
    expect(body).toEqual({
      workflow_goal_id: 'goal-1',
      plan_revision_id: 'plan-1',
    });
  });

  test('run controls post to their sub-resource with an idempotency key', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    installPersonCredential();
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'OK',
          data: { workflow_run: { id: RUN, status: 'cancelled' }, replayed: false },
          request_id: 'req-wf-5',
          timestamp: '2026-09-28T00:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const { cancelCloudWorkflowRun, resumeCloudWorkflowRun } = await import(
      './workflowApi'
    );
    const cancelled = await cancelCloudWorkflowRun(RUN, 'operator request');
    expect(cancelled.run).toMatchObject({ status: 'cancelled' });
    await resumeCloudWorkflowRun(RUN);

    expect(calls[0]!.url).toContain(`/workflow-runs/${RUN}/cancel`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      reason: 'operator request',
    });
    expect(calls[1]!.url).toContain(`/workflow-runs/${RUN}/resume`);
    expect(calls[1]!.init.method).toBe('POST');
    const headers = new Headers(calls[1]!.init.headers as HeadersInit);
    expect(headers.get('idempotency-key')).toBeTruthy();
  });
});
