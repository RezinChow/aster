import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
  designerControl,
  designerFieldView,
  designerFields,
  designerNodeTypes,
  designerRegistry,
  invalidDesignerValue,
  presentDesignerManifest,
  validDesignerValue,
} from './designerFields';
import {
  assignPlaygroundField,
  buildPlaygroundDocument,
  createNodeAddition,
  createPlaygroundEdge,
  createPlaygroundNode,
  importPlaygroundDocument,
  readPlaygroundField,
  validatePlaygroundConfigurations,
  validatePlaygroundConnection,
  validatePlaygroundGraphStructure,
  type PlaygroundNode,
} from './WorkflowPlayground.model';
import {
  executePlaygroundGraph,
  WAITING_NODE_TYPES,
} from './playgroundExecute';

function placedNode(type: string, existing: readonly PlaygroundNode[] = []): PlaygroundNode {
  const placed = createNodeAddition(
    type,
    { x: 0, y: 0 },
    'en',
    existing,
    undefined,
    designerRegistry('en'),
  );
  const node = placed.nodes.find((item) => item.data.dagNode.data.type === type);
  if (!node) throw new Error(`missing placed node ${type}`);
  return node;
}

function fieldDefinition(type: string, name: string) {
  const field = designerRegistry('en').require(type).fields.find((item) => item.name === name);
  if (!field) throw new Error(`missing field ${type}.${name}`);
  return field;
}

describe('workflow designer nodes', () => {
  test('every catalog node keeps its identity and round-trips each field', async () => {
    const registry = designerRegistry('en');
    const types = designerNodeTypes();
    const controls = new Set<string>();
    expect(types.length).toBeGreaterThan(0);

    for (const type of types) {
      const manifest = registry.require(type);
      const node = placedNode(type);
      expect(node.data.dagNode.data.type).toBe(type);
      expect(node.id.length).toBeGreaterThan(0);
      const resolved = registry.require(node.data.dagNode.data.type);
      expect(resolved.ports.inputs.map((port) => `${port.kind}:${port.id}`)).toEqual(
        manifest.ports.inputs.map((port) => `${port.kind}:${port.id}`),
      );
      expect(resolved.ports.outputs.map((port) => `${port.kind}:${port.id}`)).toEqual(
        manifest.ports.outputs.map((port) => `${port.kind}:${port.id}`),
      );
      const controlInput = manifest.ports.inputs.find(
        (port) => port.kind === 'control' && port.id === 'in',
      );
      if (controlInput) {
        const start = placedNode('flow.start', [node]);
        expect(
          validatePlaygroundConnection(
            {
              source: start.id,
              sourceHandle: 'next',
              target: node.id,
              targetHandle: 'in',
            },
            [start, node],
            [],
            registry,
          ),
        ).toEqual({ ok: true });
      }

      let current = node;
      const written = new Map<string, unknown>();
      for (const view of designerFields(type)) {
        const declared = fieldDefinition(type, view.name);
        const presentation = presentDesignerManifest(type).fields.find(
          (field) => field.name === view.name,
        );
        controls.add(view.control);
        expect(designerFieldView(type, view.name).control).toBe(view.control);
        expect(view.control).toBe(declared._input_type ?? declared.type);
        expect(view.label.zh.length).toBeGreaterThan(0);
        expect(view.label.en.length).toBeGreaterThan(0);
        expect(presentation?.display_name).toContain(view.label.zh);
        expect(presentation?.display_name).toContain(view.label.en);
        expect(presentation?.info).toBeUndefined();
        expect(presentation?._input_type).toBe(declared._input_type);

        const value = validDesignerValue(declared, readPlaygroundField(current, view.name));
        current = assignPlaygroundField(current, view.name, value);
        expect(readPlaygroundField(current, view.name)).toEqual(value);
        const issues = validatePlaygroundConfigurations(
          [current],
          [],
          designerRegistry('en'),
        ).filter(
          (issue) => issue.path === view.name || issue.path.startsWith(`${view.name}.`),
        );
        expect(issues).toEqual([]);
        written.set(view.name, value);

        const invalid = assignPlaygroundField(
          current,
          view.name,
          invalidDesignerValue(declared),
        );
        const rejected = validatePlaygroundConfigurations(
          [invalid],
          [],
          designerRegistry('en'),
        ).filter(
          (issue) => issue.nodeId === invalid.id && issue.path === view.name,
        );
        expect(rejected.length).toBeGreaterThan(0);
        current = assignPlaygroundField(current, view.name, value);
      }

      for (const [name, value] of written) {
        expect(readPlaygroundField(current, name)).toEqual(value);
      }

      const execution = await executePlaygroundGraph({
        nodes: [current],
        edges: [],
        trigger: { configured: true },
        locale: 'en',
        label: (item) => item.id,
      });
      expect(execution.steps.map((step) => step.nodeId)).toContain(current.id);
      expect(execution.steps[0]).toMatchObject({
        nodeId: current.id,
        type,
      });
    }

    for (const control of [
      'TabInput',
      'A3sFlowBatchInput',
      'A3sFlowSpecInput',
      'A3sFlowChildrenInput',
    ]) {
      expect(controls.has(control)).toBe(true);
    }
  });

  test('editing one node leaves the other node configuration unchanged', () => {
    const first = placedNode('flow.step');
    const second = placedNode('flow.step', [first]);
    const before = structuredClone(second.data.dagNode.data);
    const field = designerFields('flow.step')[0];
    if (!field) throw new Error('flow.step has no fields');
    const declared = fieldDefinition('flow.step', field.name);
    const next = assignPlaygroundField(
      first,
      field.name,
      validDesignerValue(declared, readPlaygroundField(first, field.name)),
    );
    expect(next.id).not.toBe(second.id);
    expect(second.data.dagNode.data).toEqual(before);
    expect(readPlaygroundField(second, field.name)).toEqual(before[field.name]);
  });

  test('a connected graph runs nodes in edge order', async () => {
    const start = placedNode('flow.start');
    const step = placedNode('flow.step', [start]);
    const edge = createPlaygroundEdge(
      {
        source: start.id,
        sourceHandle: 'next',
        target: step.id,
        targetHandle: 'in',
      },
      [start, step],
      'en',
    );
    const execution = await executePlaygroundGraph({
      nodes: [start, step],
      edges: [edge],
      trigger: {},
      locale: 'en',
      label: (node) => node.id,
    });
    expect(execution.steps.map((item) => item.type)).toEqual(['flow.start', 'flow.step']);
  });

  test('catalog default condition and loop expressions stay valid and the condition matches', async () => {
    const registry = designerRegistry('en');
    const condition = placedNode('flow.condition');
    const loop = placedNode('loop');
    expect(readPlaygroundField(condition, 'expression')).toMatchObject({
      expression: { op: 'eq' },
    });
    expect(readPlaygroundField(loop, 'condition')).toMatchObject({
      expression: { op: 'lt' },
    });
    for (const node of [condition, loop]) {
      expect(validatePlaygroundConfigurations([node], [], registry)).toEqual([]);
    }

    const start = placedNode('flow.start');
    const branch = placedNode('flow.condition', [start]);
    const complete = placedNode('flow.complete', [start, branch]);
    const nodes = [start, branch, complete];
    const edges = [
      createPlaygroundEdge(
        {
          source: start.id,
          sourceHandle: 'next',
          target: branch.id,
          targetHandle: 'in',
        },
        nodes,
        'en',
        registry,
      ),
      createPlaygroundEdge(
        {
          source: branch.id,
          sourceHandle: 'matched',
          target: complete.id,
          targetHandle: 'in',
        },
        nodes,
        'en',
        registry,
      ),
    ];
    const execution = await executePlaygroundGraph({
      nodes,
      edges,
      trigger: { approved: true },
      locale: 'en',
      label: (node) => node.id,
    });
    expect(execution.ok).toBe(true);
    expect(execution.steps.map((step) => step.type)).toEqual([
      'flow.start',
      'flow.condition',
      'flow.complete',
    ]);
    expect(execution.steps[1]?.output).toMatchObject({ matched: true });

    const deniedStart = placedNode('flow.start');
    const deniedBranch = placedNode('flow.condition', [deniedStart]);
    const failed = placedNode('flow.fail', [deniedStart, deniedBranch]);
    const deniedNodes = [deniedStart, deniedBranch, failed];
    const denied = await executePlaygroundGraph({
      nodes: deniedNodes,
      edges: [
        createPlaygroundEdge(
          {
            source: deniedStart.id,
            sourceHandle: 'next',
            target: deniedBranch.id,
            targetHandle: 'in',
          },
          deniedNodes,
          'en',
          registry,
        ),
        createPlaygroundEdge(
          {
            source: deniedBranch.id,
            sourceHandle: 'otherwise',
            target: failed.id,
            targetHandle: 'in',
          },
          deniedNodes,
          'en',
          registry,
        ),
      ],
      trigger: {},
      locale: 'en',
      label: (node) => node.id,
    });
    expect(denied.ok).toBe(false);
    expect(denied.steps.map((step) => step.type)).toEqual([
      'flow.start',
      'flow.condition',
      'flow.fail',
    ]);
    expect(denied.steps[1]?.output).toMatchObject({ matched: false });
  });

  test('a trial run follows each node control output', async () => {
    const registry = designerRegistry('en');
    const continuations = [
      ['flow.step', 'success'],
      ['flow.batch', 'done'],
      ['flow.wait', 'resumed'],
      ['flow.hook', 'received'],
      ['flow.signal', 'received'],
      ['iteration', 'done'],
      ['loop', 'done'],
      ['flow.progress', 'recorded'],
      ['flow.child-operation', 'linked'],
      ['flow.child-workflow', 'completed'],
      ['flow.child-workflows', 'completed'],
      ['flow.continue-as-new', 'successor'],
      ['commerce.risk.score', 'next'],
      ['commerce.inventory.reserve', 'next'],
      ['commerce.message.dispatch', 'next'],
      ['commerce.customs.document-review', 'next'],
    ] as const;

    for (const [type, handle] of continuations) {
      const start = placedNode('flow.start');
      const node = placedNode(type, [start]);
      const complete = placedNode('flow.complete', [start, node]);
      const nodes = [start, node, complete];
      const connection = {
        source: node.id,
        sourceHandle: handle,
        target: complete.id,
        targetHandle: 'in',
      };
      expect(
        validatePlaygroundConnection(connection, nodes, [], registry),
      ).toEqual({ ok: true });
      const edges = [
        createPlaygroundEdge(
          {
            source: start.id,
            sourceHandle: 'next',
            target: node.id,
            targetHandle: 'in',
          },
          nodes,
          'en',
          registry,
        ),
        createPlaygroundEdge(connection, nodes, 'en', registry),
      ];
      const execution = await executePlaygroundGraph({
        nodes,
        edges,
        trigger: {},
        locale: 'en',
        label: (item) => item.id,
      });
      if (WAITING_NODE_TYPES.has(type)) {
        // Durable interactions stop the trial instead of reporting success.
        expect(execution.ok).toBe(true);
        expect(execution.pausedAt).toBe(node.id);
        expect(execution.steps.map((step) => step.type)).toEqual([
          'flow.start',
          type,
        ]);
        expect(execution.steps[1]?.status).toBe('waiting');
        continue;
      }
      expect(execution.ok).toBe(true);
      expect(execution.steps.map((step) => step.type)).toEqual([
        'flow.start',
        type,
        'flow.complete',
      ]);
      expect(execution.steps.every((step) => step.status === 'success')).toBe(true);
    }

    const start = placedNode('flow.start');
    const batch = placedNode('flow.batch', [start]);
    const complete = placedNode('flow.complete', [start, batch]);
    const nodes = [start, batch, complete];
    const missed = await executePlaygroundGraph({
      nodes,
      edges: [
        createPlaygroundEdge(
          {
            source: start.id,
            sourceHandle: 'next',
            target: batch.id,
            targetHandle: 'in',
          },
          nodes,
          'en',
          registry,
        ),
        createPlaygroundEdge(
          {
            source: batch.id,
            sourceHandle: 'success',
            target: complete.id,
            targetHandle: 'in',
          },
          nodes,
          'en',
          registry,
        ),
      ],
      trigger: {},
      locale: 'en',
      label: (item) => item.id,
    });
    expect(missed.steps.map((step) => step.type)).toEqual(['flow.start', 'flow.batch']);
  });

  test('planned inspector fields keep their label, required marker, and value checks', () => {
    const registry = designerRegistry('en');
    const modelControls = new Set([
      'StrInput',
      'MultilineInput',
      'IntInput',
      'DurationInput',
      'A3sFlowSchemaInput',
      'HandleInput',
      'A3sFlowSpecInput',
    ]);

    for (const type of designerNodeTypes()) {
      for (const view of designerFields(type)) {
        if (!modelControls.has(view.control)) continue;
        const presentation = presentDesignerManifest(type).fields.find(
          (field) => field.name === view.name,
        );
        const bilingual =
          view.label.zh === view.label.en
            ? view.label.en
            : `${view.label.zh} / ${view.label.en}`;
        expect(presentation?.display_name).toBe(bilingual);
        expect(presentation?.required === true).toBe(view.required);

        const declared = fieldDefinition(type, view.name);
        const node = placedNode(type);
        const valid = assignPlaygroundField(
          node,
          view.name,
          validDesignerValue(declared, readPlaygroundField(node, view.name)),
        );
        expect(
          validatePlaygroundConfigurations([valid], [], registry).filter(
            (issue) => issue.path === view.name,
          ),
        ).toEqual([]);
        const invalid = assignPlaygroundField(node, view.name, invalidDesignerValue(declared));
        expect(
          validatePlaygroundConfigurations([invalid], [], registry).filter(
            (issue) => issue.nodeId === invalid.id && issue.path === view.name,
          ).length,
        ).toBeGreaterThan(0);
      }
    }

    const review = placedNode('commerce.customs.document-review');
    const accepted = assignPlaygroundField(review, 'jurisdictions', ['CN', 'EU']);
    expect(
      validatePlaygroundConfigurations([accepted], [], registry).filter(
        (issue) => issue.path === 'jurisdictions',
      ),
    ).toEqual([]);
    const rejected = assignPlaygroundField(review, 'jurisdictions', 'CN');
    expect(
      validatePlaygroundConfigurations([rejected], [], registry).some(
        (issue) => issue.path === 'jurisdictions',
      ),
    ).toBe(true);
  });

  test('business actions map data, call http, and switch branches', async () => {
    const registry = designerRegistry('en');
    const start = placedNode('flow.start');
    const mapped = placedNode('biz.data.map', [start]);
    const called = placedNode('biz.http.call', [start, mapped]);
    const switched = placedNode('biz.flow.switch', [start, mapped, called]);
    const nodes = [start, mapped, called, switched];
    const edges = [
      createPlaygroundEdge(
        { source: start.id, sourceHandle: 'next', target: mapped.id, targetHandle: 'in' },
        nodes,
        'en',
        registry,
      ),
      createPlaygroundEdge(
        { source: mapped.id, sourceHandle: 'next', target: called.id, targetHandle: 'in' },
        nodes,
        'en',
        registry,
      ),
      createPlaygroundEdge(
        { source: called.id, sourceHandle: 'next', target: switched.id, targetHandle: 'in' },
        nodes,
        'en',
        registry,
      ),
    ];
    const mappedRun = await executePlaygroundGraph({
      nodes: [start, mapped],
      edges: edges.slice(0, 1),
      trigger: { order: { id: 'o-1' } },
      locale: 'en',
      label: (node) => node.id,
    });
    expect(mappedRun.ok).toBe(true);
    expect(mappedRun.steps.map((step) => step.type)).toEqual(['flow.start', 'biz.data.map']);
    expect(mappedRun.steps[1]?.output).toEqual({ order: { id: 'o-1' } });

    const missingUrl = assignPlaygroundField(called, 'url', {
      apiVersion: 'a3s.dev/flow-expression/v1',
      expression: { op: 'literal', value: '' },
    });
    const failed = await executePlaygroundGraph({
      nodes: [start, missingUrl],
      edges: [
        createPlaygroundEdge(
          {
            source: start.id,
            sourceHandle: 'next',
            target: missingUrl.id,
            targetHandle: 'in',
          },
          [start, missingUrl],
          'en',
          registry,
        ),
      ],
      trigger: {},
      locale: 'en',
      label: (node) => node.id,
    });
    expect(failed.ok).toBe(true);
    expect(failed.steps.at(-1)?.output).toMatchObject({ ok: false, status: 0 });

    const approved = await executePlaygroundGraph({
      nodes: [start, switched],
      edges: [
        createPlaygroundEdge(
          {
            source: start.id,
            sourceHandle: 'next',
            target: switched.id,
            targetHandle: 'in',
          },
          [start, switched],
          'en',
          registry,
        ),
      ],
      trigger: { status: 'approved' },
      locale: 'en',
      label: (node) => node.id,
    });
    expect(approved.ok).toBe(true);
    expect(approved.steps.at(-1)?.output).toMatchObject({ handle: 'case_a', value: 'approved' });
  });

  test('llm, retrieval, code, template, aggregation, and http run from the catalog', async () => {
    const registry = designerRegistry('en');
    const zhRegistry = designerRegistry('zh');
    const types = designerNodeTypes();
    for (const type of [
      'flow.start',
      'flow.condition',
      'flow.step',
      'flow.batch',
      'flow.wait',
      'flow.hook',
      'flow.signal',
      'flow.child-operation',
      'flow.child-workflow',
      'flow.child-workflows',
      'flow.continue-as-new',
      'flow.progress',
      'flow.complete',
      'flow.fail',
      'flow.cancel',
      'flow.timeout',
      'iteration',
      'loop',
      'biz.http.call',
      'biz.data.map',
      'biz.flow.switch',
      'commerce.customs.document-review',
      'commerce.risk.score',
      'commerce.inventory.reserve',
      'commerce.message.dispatch',
    ]) {
      expect(types).toContain(type);
    }
    expect(registry.require('flow.cancel').fields).toHaveLength(0);
    expect(zhRegistry.require('flow.cancel').fields).toHaveLength(0);

    const catalogNodes = [
      { type: 'biz.ai.llm', zh: 'LLM', en: 'LLM', fields: ['endpoint', 'prompt'] },
      {
        type: 'biz.knowledge.retrieve',
        zh: '知识检索',
        en: 'Knowledge retrieval',
        fields: ['query', 'documents', 'count'],
      },
      {
        type: 'biz.code.run',
        zh: '代码执行',
        en: 'Code execution',
        fields: ['inputs', 'code'],
      },
      {
        type: 'biz.data.template',
        zh: '模板转换',
        en: 'Template transform',
        fields: ['template'],
      },
      {
        type: 'biz.data.aggregate',
        zh: '变量聚合',
        en: 'Variable aggregation',
        fields: ['variables'],
      },
    ] as const;
    for (const node of catalogNodes) {
      expect(types).toContain(node.type);
      expect(zhRegistry.require(node.type).display_name).toBe(node.zh);
      expect(registry.require(node.type).display_name).toBe(node.en);
      expect(zhRegistry.require(node.type).fields.map((field) => field.name)).toEqual([
        ...node.fields,
      ]);
      expect(registry.require(node.type).fields.map((field) => field.name)).toEqual([
        ...node.fields,
      ]);
      for (const name of node.fields) {
        const view = designerFieldView(node.type, name);
        expect(view.label.zh.length).toBeGreaterThan(0);
        expect(view.label.en.length).toBeGreaterThan(0);
      }
    }
    const httpFields = ['method', 'url', 'headers', 'auth', 'body', 'files', 'timeout', 'retry'];
    expect(registry.require('biz.http.call').fields.map((field) => field.name)).toEqual(httpFields);
    expect(zhRegistry.require('biz.http.call').fields.map((field) => field.name)).toEqual(httpFields);
    expect(
      registry.require('biz.http.call').ports.outputs.map((port) => port.id),
    ).toEqual(['next', 'failed', 'response']);

    const template = withFields(placedNode('biz.data.template'), {
      template: 'Order {{input.order.id}} for {{input.customer}}',
    });
    const rendered = await runFromStart(template, { order: { id: 'o-9' }, customer: 'Ada' });
    expect(rendered.ok).toBe(true);
    expect(rendered.steps.at(-1)?.output).toBe('Order o-9 for Ada');

    const code = withFields(placedNode('biz.code.run'), {
      inputs: expressionOf({ op: 'field', path: 'input' }),
      code: 'return inputs.left + inputs.right;',
    });
    const summed = await runFromStart(code, { left: 2, right: 3 });
    expect(summed.ok).toBe(true);
    expect(summed.steps.at(-1)?.status).toBe('success');
    expect(summed.steps.at(-1)?.output).toBe(5);

    const throwing = withFields(placedNode('biz.code.run'), {
      inputs: expressionOf({ op: 'field', path: 'input' }),
      code: "throw new Error('trial-boom');",
    });
    const crashed = await runFromStart(throwing, {});
    expect(crashed.ok).toBe(false);
    expect(crashed.steps.at(-1)?.status).toBe('error');
    expect(crashed.steps.at(-1)?.error).toContain('trial-boom');
    expect(crashed.steps.at(-1)?.status).not.toBe('success');

    const aggregated = withFields(placedNode('biz.data.aggregate'), {
      variables: {
        chosen: expressionOf({ op: 'field', path: 'input.chosen' }),
        other: expressionOf({ op: 'field', path: 'input.other' }),
      },
    });
    const oneBranch = await runFromStart(aggregated, { chosen: 'live-branch' });
    expect(oneBranch.ok).toBe(true);
    expect(oneBranch.steps.at(-1)?.output).toBe('live-branch');
    const bothBranches = await runFromStart(aggregated, { chosen: 'alpha', other: 'beta' });
    expect(bothBranches.steps.at(-1)?.output).toEqual({ chosen: 'alpha', other: 'beta' });

    const missingLlm = withFields(placedNode('biz.ai.llm'), {
      endpoint: '',
      prompt: 'Invent a completion about {{input.topic}}',
    });
    const missingEndpoint = await runFromStart(missingLlm, { topic: 'a3s-trial-topic' });
    expect(missingEndpoint.ok).toBe(false);
    expect(missingEndpoint.steps.at(-1)?.status).toBe('error');
    expect(missingEndpoint.steps.at(-1)?.output).toBeNull();
    expect(missingEndpoint.steps.at(-1)?.error).toContain('model source');
    expect(JSON.stringify(missingEndpoint.steps.at(-1)?.output)).not.toContain('a3s-trial-topic');
    const missingEndpointZh = await runFromStart(missingLlm, { topic: 'a3s-trial-topic' }, 'zh');
    expect(missingEndpointZh.steps.at(-1)?.error).toContain('模型来源');

    const seen: { prompt: string } = { prompt: '' };
    const llmServer = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as { prompt?: string };
        seen.prompt = body.prompt ?? '';
        return new Response('local-model-reply');
      },
    });
    try {
      const llm = withFields(placedNode('biz.ai.llm'), {
        endpoint: `http://127.0.0.1:${String(llmServer.port)}/complete`,
        prompt: 'Answer about {{input.topic}}',
      });
      const completed = await runFromStart(llm, { topic: 'a3s-trial-topic' });
      expect(completed.ok).toBe(true);
      expect(seen.prompt).toContain('a3s-trial-topic');
      expect(completed.steps.at(-1)?.output).toBe('local-model-reply');
    } finally {
      llmServer.stop(true);
    }

    const missingDocs = withFields(placedNode('biz.knowledge.retrieve'), {
      documents: {},
      query: expressionOf({ op: 'field', path: 'input.query' }),
      count: 2,
    });
    const missingSource = await runFromStart(missingDocs, { query: 'zircon' });
    expect(missingSource.ok).toBe(false);
    expect(missingSource.steps.at(-1)?.status).toBe('error');
    expect(missingSource.steps.at(-1)?.error).toContain('document source');
    const missingSourceZh = await runFromStart(missingDocs, { query: 'zircon' }, 'zh');
    expect(missingSourceZh.steps.at(-1)?.error).toContain('文档来源');

    const retrieved = withFields(placedNode('biz.knowledge.retrieve'), {
      documents: {
        match: 'Alpha passage mentions zircon widget.',
        other: 'Beta passage mentions copper wire.',
      },
      query: expressionOf({ op: 'field', path: 'input.query' }),
      count: 2,
    });
    const passages = await runFromStart(retrieved, { query: 'zircon widget' });
    expect(passages.ok).toBe(true);
    expect(passages.steps.at(-1)?.output).toEqual(['Alpha passage mentions zircon widget.']);

    const ranked = withFields(placedNode('biz.knowledge.retrieve'), {
      documents: {
        low: 'zinc once',
        high: 'zinc zinc zinc',
      },
      query: expressionOf({ op: 'literal', value: 'zinc' }),
      count: 2,
    });
    const ordered = await runFromStart(ranked, {});
    expect(ordered.steps.at(-1)?.output).toEqual(['zinc zinc zinc', 'zinc once']);

    const calls: Array<{
      method: string;
      authorization: string | null;
      trace: string | null;
      body: string;
      file: string;
      filename: string;
    }> = [];
    const httpServer = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        const form = await request.formData();
        const file = form.get('attachment');
        calls.push({
          method: request.method,
          authorization: request.headers.get('authorization'),
          trace: request.headers.get('x-trace'),
          body: String(form.get('body')),
          file: file instanceof Blob ? await file.text() : '',
          filename: file instanceof File ? file.name : '',
        });
        return new Response('pong', { status: 200 });
      },
    });
    try {
      const called = withFields(placedNode('biz.http.call'), {
        method: 'PATCH',
        url: expressionOf({
          op: 'literal',
          value: `http://127.0.0.1:${String(httpServer.port)}/hook`,
        }),
        headers: { 'X-Trace': 'trial-trace' },
        auth: { scheme: 'Bearer', token: 'secret-token' },
        body: { note: 'hello' },
        files: {
          attachment: { filename: 'note.txt', content: 'file-bytes', content_type: 'text/plain' },
        },
        timeout: 1000,
        retry: 1,
      });
      const sent = await runHttp(called, {});
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        method: 'PATCH',
        authorization: 'Bearer secret-token',
        trace: 'trial-trace',
        file: 'file-bytes',
        filename: 'note.txt',
      });
      expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ note: 'hello' });
      expect(sent.ok).toBe(true);
      expect(sent.steps.map((step) => step.type)).toEqual([
        'flow.start',
        'biz.http.call',
        'flow.complete',
      ]);
      expect(sent.steps[1]?.output).toMatchObject({ ok: true, status: 200, body: 'pong' });
    } finally {
      httpServer.stop(true);
    }

    let failures = 0;
    const failingServer = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch() {
        failures += 1;
        return new Response('nope', { status: 503 });
      },
    });
    try {
      const called = withFields(placedNode('biz.http.call'), {
        method: 'POST',
        url: expressionOf({
          op: 'literal',
          value: `http://127.0.0.1:${String(failingServer.port)}/fail`,
        }),
        body: {},
        timeout: 1000,
        retry: 3,
      });
      const refused = await runHttp(called, {});
      expect(failures).toBe(3);
      expect(refused.steps.map((step) => step.type)).toEqual([
        'flow.start',
        'biz.http.call',
        'flow.fail',
      ]);
      expect(refused.steps[1]?.output).toMatchObject({
        ok: false,
        status: 503,
        reason: 'HTTP status 503',
      });
    } finally {
      failingServer.stop(true);
    }

    let hangs = 0;
    const hangingServer = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch() {
        hangs += 1;
        return new Promise<Response>(() => {});
      },
    });
    try {
      const called = withFields(placedNode('biz.http.call'), {
        method: 'GET',
        url: expressionOf({
          op: 'literal',
          value: `http://127.0.0.1:${String(hangingServer.port)}/slow`,
        }),
        timeout: 40,
        retry: 2,
      });
      const timedOut = await runHttp(called, {});
      expect(hangs).toBe(2);
      expect(timedOut.steps.map((step) => step.type)).toEqual([
        'flow.start',
        'biz.http.call',
        'flow.fail',
      ]);
      expect(timedOut.steps[1]?.output).toMatchObject({
        ok: false,
        status: 0,
        reason: 'The request timed out.',
      });
    } finally {
      hangingServer.stop(true);
    }

    const unreachable = withFields(placedNode('biz.http.call'), {
      method: 'GET',
      url: expressionOf({ op: 'literal', value: 'http://127.0.0.1:1/unreachable' }),
      timeout: 1000,
      retry: 1,
    });
    const missedHost = await runHttp(unreachable, {});
    expect(missedHost.steps.map((step) => step.type)).toEqual([
      'flow.start',
      'biz.http.call',
      'flow.fail',
    ]);
    const missedOutput = missedHost.steps[1]?.output as { ok?: boolean; status?: number; reason?: string };
    expect(missedOutput).toMatchObject({ ok: false, status: 0 });
    expect(missedOutput.reason?.length).toBeGreaterThan(0);

    const emptyUrl = withFields(placedNode('biz.http.call'), {
      url: expressionOf({ op: 'literal', value: '' }),
      retry: 3,
    });
    const empty = await runHttp(emptyUrl, {});
    expect(empty.steps.map((step) => step.type)).toEqual([
      'flow.start',
      'biz.http.call',
      'flow.fail',
    ]);
    expect(empty.steps[1]?.output).toMatchObject({ ok: false, status: 0 });
  });
});

function expressionOf(expression: Record<string, unknown>) {
  return { apiVersion: 'a3s.dev/flow-expression/v1', expression };
}

function withFields(node: PlaygroundNode, values: Record<string, unknown>): PlaygroundNode {
  let current = node;
  for (const [name, value] of Object.entries(values)) {
    current = assignPlaygroundField(current, name, value);
  }
  return current;
}

function runFromStart(
  node: PlaygroundNode,
  trigger: unknown,
  locale: 'zh' | 'en' = 'en',
) {
  const start = placedNode('flow.start', [node]);
  const nodes = [start, node];
  return executePlaygroundGraph({
    nodes,
    edges: [
      createPlaygroundEdge(
        {
          source: start.id,
          sourceHandle: 'next',
          target: node.id,
          targetHandle: 'in',
        },
        nodes,
        'en',
        designerRegistry('en'),
      ),
    ],
    trigger,
    locale,
    label: (item) => item.id,
  });
}

function runHttp(node: PlaygroundNode, trigger: unknown) {
  const start = placedNode('flow.start', [node]);
  const success = placedNode('flow.complete', [start, node]);
  const failure = placedNode('flow.fail', [start, node, success]);
  const nodes = [start, node, success, failure];
  const registry = designerRegistry('en');
  return executePlaygroundGraph({
    nodes,
    edges: [
      createPlaygroundEdge(
        { source: start.id, sourceHandle: 'next', target: node.id, targetHandle: 'in' },
        nodes,
        'en',
        registry,
      ),
      createPlaygroundEdge(
        { source: node.id, sourceHandle: 'next', target: success.id, targetHandle: 'in' },
        nodes,
        'en',
        registry,
      ),
      createPlaygroundEdge(
        { source: node.id, sourceHandle: 'failed', target: failure.id, targetHandle: 'in' },
        nodes,
        'en',
        registry,
      ),
    ],
    trigger,
    locale: 'en',
    label: (item) => item.id,
  });
}

type Specificity = [number, number, number];

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === separator && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function maxSpecificity(left: Specificity, right: Specificity): Specificity {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? left : right;
  }
  return left;
}

function selectorSpecificity(selector: string): Specificity {
  let specificity: Specificity = [0, 0, 0];
  let index = 0;
  const readBalanced = (from: number) => {
    let depth = 1;
    let cursor = from;
    while (cursor < selector.length && depth > 0) {
      if (selector[cursor] === '(') depth += 1;
      else if (selector[cursor] === ')') depth -= 1;
      if (depth > 0) cursor += 1;
    }
    return { inner: selector.slice(from, cursor), end: cursor + 1 };
  };
  while (index < selector.length) {
    if (selector.startsWith(':where(', index)) {
      index = readBalanced(index + ':where('.length).end;
      continue;
    }
    const functional = [':is(', ':not(', ':has('].find((name) => selector.startsWith(name, index));
    if (functional) {
      const read = readBalanced(index + functional.length);
      let best: Specificity = [0, 0, 0];
      for (const argument of splitTopLevel(read.inner, ',')) {
        best = maxSpecificity(best, selectorSpecificity(argument));
      }
      specificity = [
        specificity[0] + best[0],
        specificity[1] + best[1],
        specificity[2] + best[2],
      ];
      index = read.end;
      continue;
    }
    const character = selector[index];
    if (character === '#') {
      specificity[0] += 1;
      index += 1;
      while (index < selector.length && /[\w-]/u.test(selector[index] ?? '')) index += 1;
      continue;
    }
    if (character === '.' || character === ':') {
      specificity[1] += 1;
      index += 1;
      while (index < selector.length && /[\w-]/u.test(selector[index] ?? '')) index += 1;
      continue;
    }
    if (character === '[') {
      specificity[1] += 1;
      while (index < selector.length && selector[index] !== ']') index += 1;
      index += 1;
      continue;
    }
    if (/[a-z*]/iu.test(character ?? '')) {
      if (character !== '*') specificity[2] += 1;
      while (index < selector.length && /[\w-]/u.test(selector[index] ?? '')) index += 1;
      continue;
    }
    index += 1;
  }
  return specificity;
}

function expandIs(selector: string): string[] {
  const start = selector.indexOf(':is(');
  if (start < 0) return [selector];
  let depth = 1;
  let cursor = start + 4;
  const innerStart = cursor;
  while (cursor < selector.length && depth > 0) {
    if (selector[cursor] === '(') depth += 1;
    else if (selector[cursor] === ')') depth -= 1;
    if (depth > 0) cursor += 1;
  }
  const inner = selector.slice(innerStart, cursor);
  const rest = selector.slice(cursor + 1);
  const prefix = selector.slice(0, start);
  return splitTopLevel(inner, ',').flatMap((argument) => expandIs(`${prefix}${argument}${rest}`));
}

const EXPRESSION_SHELL_ANCESTORS = new Set([
  'a3s-flow-designer',
  'a3s-workflow-playground',
  'a3s-node-inspector',
  'a3s-form-field',
  'a3s-form-flow-node-panel',
  'a3s-form-workflow-node-panel',
  'a3s-form-renderer',
]);

const EXPRESSION_PATH_CHAIN = [
  { tag: 'input', classes: ['input'] },
  { tag: 'div', classes: ['a3s-flow-variable-input'] },
  { tag: 'div', classes: ['a3s-form-flow-expression-source'] },
  { tag: 'div', classes: ['a3s-form-field'] },
  { tag: 'aside', classes: ['a3s-node-inspector'] },
  { tag: 'div', classes: ['a3s-workflow-playground'] },
  { tag: 'div', classes: ['a3s-flow-designer'] },
];

const PLAIN_TEXT_CHAIN = [
  { tag: 'input', classes: ['input'] },
  { tag: 'div', classes: ['a3s-form-workflow-parameter-control'] },
  { tag: 'div', classes: ['a3s-form-field'] },
  { tag: 'aside', classes: ['a3s-node-inspector'] },
  { tag: 'div', classes: ['a3s-workflow-playground'] },
  { tag: 'div', classes: ['a3s-flow-designer'] },
];

function hasPseudo(selector: string, name: string): boolean {
  return new RegExp(`:${name}(?![\\w-])`, 'u').test(selector);
}

function takeNots(selector: string): { bare: string; nots: string[] } {
  const nots: string[] = [];
  let bare = '';
  let index = 0;
  while (index < selector.length) {
    if (selector.startsWith(':not(', index)) {
      let depth = 1;
      let cursor = index + 5;
      const start = cursor;
      while (cursor < selector.length && depth > 0) {
        if (selector[cursor] === '(') depth += 1;
        else if (selector[cursor] === ')') depth -= 1;
        if (depth > 0) cursor += 1;
      }
      nots.push(selector.slice(start, cursor));
      index = cursor + 1;
      continue;
    }
    bare += selector[index];
    index += 1;
  }
  return { bare, nots };
}

function compoundMatches(
  compound: string,
  node: { tag: string; classes: string[] },
): boolean {
  const tag = compound.match(/^[a-z*]+/iu)?.[0];
  if (tag && tag !== '*' && tag.toLowerCase() !== node.tag) return false;
  const classes = [...compound.matchAll(/\.([\w-]+)/gu)].map((match) => match[1] ?? '');
  if (!classes.every((name) => node.classes.includes(name))) return false;
  const attributes = [...compound.matchAll(/\[([^\]=\s]+)(?:=(['"])(.*?)\2)?\]/gu)];
  return attributes.every((attribute) => {
    const name = attribute[1];
    const value = attribute[3];
    if (name === 'type') return value === undefined || value === 'text';
    return false;
  });
}

function chainMatches(
  selector: string,
  chain: ReadonlyArray<{ tag: string; classes: string[] }>,
): boolean {
  const parts: Array<{ combinator: '' | ' ' | '>'; compound: string }> = [];
  let rest = selector.trim();
  let combinator: '' | ' ' | '>' = '';
  while (rest) {
    if (rest.startsWith('>')) {
      combinator = '>';
      rest = rest.slice(1).trim();
      continue;
    }
    const splitAt = rest.search(/\s|>/u);
    if (splitAt < 0) {
      parts.push({ combinator, compound: rest });
      break;
    }
    const compound = rest.slice(0, splitAt).trim();
    if (compound) parts.push({ combinator, compound });
    rest = rest.slice(splitAt).trim();
    combinator = rest.startsWith('>') ? '>' : ' ';
  }
  if (parts.length === 0) return false;
  let nodeIndex = 0;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) return false;
    if (index === parts.length - 1) {
      if (!compoundMatches(part.compound, chain[0]!)) return false;
      continue;
    }
    const link = parts[index + 1]?.combinator ?? ' ';
    if (link === '>') {
      nodeIndex += 1;
      const node = chain[nodeIndex];
      if (!node || !compoundMatches(part.compound, node)) return false;
      continue;
    }
    nodeIndex += 1;
    let found = false;
    while (nodeIndex < chain.length) {
      const node = chain[nodeIndex];
      if (node && compoundMatches(part.compound, node)) {
        found = true;
        break;
      }
      nodeIndex += 1;
    }
    if (!found) return false;
  }
  return true;
}

function selectorMatchesChain(
  selector: string,
  chain: ReadonlyArray<{ tag: string; classes: string[] }>,
): boolean {
  return expandIs(selector).some((candidate) => {
    const { bare, nots } = takeNots(candidate);
    if (nots.some((argument) => selectorMatchesChain(argument, chain))) return false;
    const cleaned = bare.replace(/:(?:hover|focus-visible|focus-within|focus|active)/gu, '');
    return chainMatches(cleaned, chain);
  });
}

function matchesPathBackground(selector: string, state: 'rest' | 'hover'): boolean {
  if (
    hasPseudo(selector, 'focus') ||
    hasPseudo(selector, 'focus-visible') ||
    hasPseudo(selector, 'focus-within') ||
    hasPseudo(selector, 'active') ||
    /aria-invalid/u.test(selector)
  ) {
    return false;
  }
  if (hasPseudo(selector, 'hover') && state === 'rest') return false;
  return selectorMatchesChain(selector, EXPRESSION_PATH_CHAIN);
}

function matchesFocusedExpressionShell(selector: string): boolean {
  if (/:has\([^)]*aria-invalid|:focus-visible|:focus(?!-within)|:hover|:active/u.test(selector)) {
    return false;
  }
  return expandIs(selector).some((candidate) => {
    const compounds = candidate.split(/\s*>\s*|\s+/u).filter(Boolean);
    const subject = compounds.at(-1) ?? '';
    if (!subject.includes('a3s-form-flow-expression-source')) return false;
    const subjectClasses = [...subject.matchAll(/\.([\w-]+)/gu)].map((match) => match[1]);
    if (!subjectClasses.every((name) => name === 'a3s-form-flow-expression-source')) return false;
    return compounds.slice(0, -1).every((compound) => {
      const classes = [...compound.matchAll(/\.([\w-]+)/gu)].map((match) => match[1]);
      return classes.every((name) => EXPRESSION_SHELL_ANCESTORS.has(name));
    });
  });
}

function cssRules(css: string): Array<{ selector: string; body: string; order: number }> {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const rules: Array<{ selector: string; body: string; order: number }> = [];
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open < 0) break;
    const prelude = source.slice(cursor, open).trim();
    let depth = 1;
    let end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth += 1;
      else if (source[end] === '}') depth -= 1;
      end += 1;
    }
    const body = source.slice(open + 1, end - 1);
    if (prelude.startsWith('@') && !prelude.startsWith('@import') && !prelude.startsWith('@font')) {
      rules.push(...cssRules(body).map((rule) => ({ ...rule, order: rule.order + open })));
    } else if (prelude && !body.includes('{')) {
      rules.push({ selector: prelude, body, order: cursor });
    }
    cursor = end;
  }
  return rules;
}

function backgroundOf(body: string): string | null {
  const declared = body.match(/(?:^|;)\s*background\s*:\s*([^;]+)/u);
  return declared?.[1]?.trim() ?? null;
}

function borderColorOf(body: string): string | null {
  const longhand = body.match(/(?:^|;)\s*border-color\s*:\s*([^;]+)/u);
  if (longhand?.[1]) return longhand[1].trim();
  const shorthand = body.match(/(?:^|;)\s*border\s*:\s*([^;]+)/u);
  return shorthand?.[1]?.trim() ?? null;
}

describe('inspector focus rings', () => {
  test('slider and switch keep a visible ring when host.css is applied', async () => {
    await import('../pages/secondaryBack.dom');
    const hostCss = readFileSync(new URL('./host.css', import.meta.url), 'utf8');
    const playgroundCss = readFileSync(
      new URL('./styles/workflow-playground-base.css', import.meta.url),
      'utf8',
    );
    const widgetCss = readFileSync(
      new URL(
        '../../../../crates/flow/packages/ui/src/styles/workflow-node.css',
        import.meta.url,
      ),
      'utf8',
    );
    const expressionCss = readFileSync(
      new URL(
        '../../../../crates/flow/packages/ui/src/styles/a3s-flow-node.css',
        import.meta.url,
      ),
      'utf8',
    );
    const style = document.createElement('style');
    style.textContent = `${widgetCss}\n${expressionCss}\n${playgroundCss}\n${hostCss}`;
    document.head.appendChild(style);
    document.body.innerHTML = `
      <div class="a3s-flow-designer" style="--a3s-form-blue:#112233;--color-ink:#112233;--color-control-fill:#f3f4f6;--color-control-fill-active:#e7e9ed">
        <div class="a3s-workflow-playground">
          <aside class="a3s-node-inspector">
            <div class="a3s-form-field">
              <div class="a3s-form-workflow-parameter-control">
                <input class="input" type="text" id="text-field" />
                <input class="input" type="checkbox" role="switch" id="switch-field" />
              </div>
              <div class="a3s-form-workflow-slider">
                <input class="input" type="range" id="range-field" />
              </div>
            </div>
            <div class="a3s-form-field">
              <div class="a3s-form-flow-expression-source">
                <div class="a3s-flow-variable-input">
                  <input class="input" type="text" id="path-field" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>`;

    const text = document.getElementById('text-field') as HTMLInputElement;
    const path = document.getElementById('path-field') as HTMLInputElement;
    const slider = document.getElementById('range-field') as HTMLInputElement;
    const toggle = document.getElementById('switch-field') as HTMLInputElement;
    text.focus();
    expect(getComputedStyle(text).outlineStyle).toBe('none');
    expect(getComputedStyle(text).backgroundColor).toBe('#e7e9ed');
    expect(getComputedStyle(text).borderTopLeftRadius).toBe('8px');
    path.focus();
    const pathStyle = getComputedStyle(path);
    expect(pathStyle.outlineStyle).toBe('none');
    expect(pathStyle.backgroundColor).not.toBe('#e7e9ed');
    expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(pathStyle.backgroundColor);
    expect(pathStyle.borderTopLeftRadius).toBe('0px');

    const pathBackground = (state: 'rest' | 'hover') => {
      const candidates = cssRules(style.textContent ?? '').flatMap((rule) =>
        splitTopLevel(rule.selector, ',').flatMap((selector) => {
          if (!matchesPathBackground(selector, state)) return [];
          const background = backgroundOf(rule.body);
          if (!background) return [];
          return [
            {
              selector,
              background,
              specificity: selectorSpecificity(selector),
              order: rule.order,
            },
          ];
        }),
      );
      expect(candidates.length).toBeGreaterThan(0);
      return candidates.reduce((winner, candidate) => {
        for (let index = 0; index < 3; index += 1) {
          if (candidate.specificity[index] !== winner.specificity[index]) {
            return candidate.specificity[index] > winner.specificity[index] ? candidate : winner;
          }
        }
        return candidate.order >= winner.order ? candidate : winner;
      });
    };
    const restingPath = pathBackground('rest');
    const hoveredPath = pathBackground('hover');
    expect(restingPath.background).toBe('transparent');
    expect(restingPath.selector).toContain('a3s-flow-variable-input');
    expect(hoveredPath.background).toBe('transparent');
    expect(hoveredPath.selector).toContain('a3s-flow-variable-input');
    const plainFill = cssRules(hostCss).some(
      (rule) =>
        backgroundOf(rule.body)?.includes('--color-control-fill') &&
        !backgroundOf(rule.body)?.includes('--color-control-fill-') &&
        splitTopLevel(rule.selector, ',').some((selector) =>
          selectorMatchesChain(selector, PLAIN_TEXT_CHAIN),
        ) &&
        splitTopLevel(rule.selector, ',').every(
          (selector) => !selectorMatchesChain(selector, EXPRESSION_PATH_CHAIN),
        ),
    );
    expect(plainFill).toBe(true);

    const shellBorders = cssRules(style.textContent ?? '').flatMap((rule) =>
      splitTopLevel(rule.selector, ',').flatMap((selector) => {
        if (!matchesFocusedExpressionShell(selector)) return [];
        const borderColor = borderColorOf(rule.body);
        if (!borderColor) return [];
        return [
          {
            selector,
            borderColor,
            background: rule.body.match(/(?:^|;)\s*background\s*:\s*([^;]+)/u)?.[1]?.trim() ?? '',
            specificity: selectorSpecificity(selector),
            order: rule.order,
          },
        ];
      }),
    );
    expect(shellBorders.length).toBeGreaterThan(0);
    const winningShell = shellBorders.reduce((winner, candidate) => {
      if (!winner) return candidate;
      for (let index = 0; index < 3; index += 1) {
        if (candidate.specificity[index] !== winner.specificity[index]) {
          return candidate.specificity[index] > winner.specificity[index] ? candidate : winner;
        }
      }
      return candidate.order >= winner.order ? candidate : winner;
    });
    const restingShell = shellBorders.find((candidate) => candidate.borderColor === 'transparent');
    expect(restingShell).toBeTruthy();
    expect(winningShell.selector).toContain(':focus-within');
    expect(winningShell.selector).toContain('.a3s-form-field');
    expect(winningShell.borderColor).not.toBe('transparent');
    expect(winningShell.borderColor).toContain('--color-ink');
    expect(winningShell.background).toContain('--color-control-fill-active');
    expect(winningShell.specificity[1]).toBeGreaterThan(restingShell?.specificity[1] ?? 0);
    slider.focus();
    expect(getComputedStyle(slider).outlineStyle).not.toBe('none');
    expect(getComputedStyle(slider).outlineWidth).not.toBe('0px');
    toggle.focus();
    expect(getComputedStyle(toggle).outlineStyle).not.toBe('none');
    expect(getComputedStyle(toggle).outlineWidth).not.toBe('0px');
  });
});

test('region start references render as a node picker without touching stored values', () => {
    const manifest = presentDesignerManifest('iteration', 'en', {
      nodeOptions: [
        { value: 'inner1', label: 'inner1' },
        { value: 'inner2', label: 'inner2' },
      ],
    });
    const field = manifest.fields.find((item) => item.name === 'start_node_id');
    expect(field?._input_type).toBe('DropdownInput');
    expect(field?.options).toEqual([
      { value: 'inner1', label: 'inner1' },
      { value: 'inner2', label: 'inner2' },
    ]);

    // Other node types and uncontexted manifests keep their declared controls.
    const untouched = presentDesignerManifest('flow.step', 'en', {
      nodeOptions: [{ value: 'inner1', label: 'inner1' }],
    });
    expect(designerControl(untouched.fields.find((item) => item.name === 'step_name')!)).toBe('StrInput');
    const plain = presentDesignerManifest('iteration', 'en');
    expect(designerControl(plain.fields.find((item) => item.name === 'start_node_id')!)).toBe('StrInput');
  });

describe('workflow designer graph structure and document import', () => {
  const registry = designerRegistry('en');

  function manualNode(
    id: string,
    type: string,
    configuration: Record<string, unknown> = {},
  ): PlaygroundNode {
    return createPlaygroundNode(id, type, { x: 0, y: 0 }, 'en', {
      configuration,
      registry,
    });
  }

  function edge(
    nodes: readonly PlaygroundNode[],
    source: string,
    sourceHandle: string,
    target: string,
  ) {
    return createPlaygroundEdge(
      { source, sourceHandle, target, targetHandle: 'in' },
      nodes,
      'en',
      registry,
    );
  }

  test('a well-formed graph produces no structural issues', () => {
    const start = manualNode('a', 'flow.start');
    const step = manualNode('b', 'flow.step');
    const complete = manualNode('c', 'flow.complete');
    const nodes = [start, step, complete];
    const edges = [
      edge(nodes, 'a', 'next', 'b'),
      edge(nodes, 'b', 'success', 'c'),
    ];
    expect(validatePlaygroundGraphStructure(nodes, edges, registry)).toEqual([]);
  });

  test('an empty graph is fine but a node-only graph demands a start', () => {
    expect(validatePlaygroundGraphStructure([], [], registry)).toEqual([]);
    const step = manualNode('b', 'flow.step');
    const issues = validatePlaygroundGraphStructure([step], [], registry);
    expect(issues.some((issue) => issue.code === 'graph.no_start')).toBe(true);
    expect(issues.some((issue) => issue.code === 'graph.unreachable')).toBe(true);
  });

  test('a second start node is rejected', () => {
    const start = manualNode('a', 'flow.start');
    const again = manualNode('b', 'flow.start');
    const issues = validatePlaygroundGraphStructure([start, again], [], registry);
    expect(issues.filter((issue) => issue.code === 'graph.multiple_starts')).toHaveLength(1);
    expect(issues.find((issue) => issue.code === 'graph.multiple_starts')?.nodeId).toBe('b');
  });

  test('a node detached from the start path is unreachable', () => {
    const start = manualNode('a', 'flow.start');
    const complete = manualNode('c', 'flow.complete');
    const orphan = manualNode('z', 'flow.step');
    const nodes = [start, complete, orphan];
    const edges = [edge(nodes, 'a', 'next', 'c')];
    const issues = validatePlaygroundGraphStructure(nodes, edges, registry);
    expect(issues.find((issue) => issue.code === 'graph.unreachable')?.nodeId).toBe('z');
  });

  test('a non-terminal node with every control output open is a dead end', () => {
    const start = manualNode('a', 'flow.start');
    const step = manualNode('b', 'flow.step');
    const nodes = [start, step];
    const edges = [edge(nodes, 'a', 'next', 'b')];
    const issues = validatePlaygroundGraphStructure(nodes, edges, registry);
    expect(issues.find((issue) => issue.code === 'graph.dead_end')?.nodeId).toBe('b');
  });

  test('a dangling region start id is reported on the region node', () => {
    const start = manualNode('a', 'flow.start');
    const region = manualNode('r', 'iteration', { start_node_id: 'ghost' });
    const complete = manualNode('c', 'flow.complete');
    const nodes = [start, region, complete];
    const edges = [
      edge(nodes, 'a', 'next', 'r'),
      edge(nodes, 'r', 'done', 'c'),
    ];
    const issues = validatePlaygroundGraphStructure(nodes, edges, registry);
    const issue = issues.find((issue) => issue.code === 'graph.unknown_start_node');
    expect(issue?.nodeId).toBe('r');
    expect(issue?.path).toBe('start_node_id');
    const grounded = manualNode('r2', 'iteration', { start_node_id: 'a' });
    const healthy = validatePlaygroundGraphStructure(
      [start, grounded, complete],
      [
        edge([start, grounded, complete], 'a', 'next', 'r2'),
        edge([start, grounded, complete], 'r2', 'done', 'c'),
      ],
      registry,
    );
    expect(healthy.some((issue) => issue.code === 'graph.unknown_start_node')).toBe(false);
  });

  test('expressions referencing an unknown step are flagged before a run', () => {
    const start = manualNode('a', 'flow.start');
    const named = manualNode('b', 'flow.step', { step_name: 'enrich' });
    const dangling = manualNode('d', 'flow.step', {
      input: { expression: { op: 'field', path: 'steps.missing.output' } },
    });
    const grounded = manualNode('g', 'flow.step', {
      input: { expression: { op: 'field', path: 'steps.enrich.output' } },
    });
    const issues = validatePlaygroundGraphStructure(
      [start, named, dangling, grounded],
      [],
      registry,
    );
    const bad = issues.find((issue) => issue.code === 'graph.unknown_reference');
    expect(bad?.nodeId).toBe('d');
    expect(bad?.path).toBe('input');
    expect(
      issues.some(
        (issue) => issue.code === 'graph.unknown_reference' && issue.nodeId === 'g',
      ),
    ).toBe(false);
  });

  test('a serialized document imports back into an editable graph', () => {
    const start = manualNode('a', 'flow.start');
    const step = manualNode('b', 'flow.step');
    const complete = manualNode('c', 'flow.complete');
    const nodes = [start, step, complete];
    const edges = [
      edge(nodes, 'a', 'next', 'b'),
      edge(nodes, 'b', 'success', 'c'),
    ];
    const source = JSON.stringify(buildPlaygroundDocument(nodes, edges), null, 2);
    const imported = importPlaygroundDocument(source, 'en', registry);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.graph.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(imported.graph.nodes.map((node) => node.data.dagNode.data.type)).toEqual([
      'flow.start',
      'flow.step',
      'flow.complete',
    ]);
    expect(imported.graph.edges).toHaveLength(2);
    expect(validatePlaygroundGraphStructure(imported.graph.nodes, imported.graph.edges, registry)).toEqual([]);
  });

  test('import rejects malformed JSON and unregistered node types', () => {
    expect(importPlaygroundDocument('not json at all', 'en', registry)).toEqual({
      ok: false,
      reason: 'parse',
    });
    const document = {
      version: '0.7.0',
      kind: 'app',
      app: { name: 'ghost.workflow', mode: 'workflow' },
      dependencies: [],
      workflow: {
        graph: {
          nodes: [
            {
              id: 'g',
              position: { x: 0, y: 0 },
              data: { type: 'ghost.type', title: 'Ghost' },
            },
          ],
          edges: [],
        },
      },
    };
    // A structurally valid document with an unregistered type is refused at
    // the registry boundary instead of silently dropping nodes.
    expect(importPlaygroundDocument(JSON.stringify(document), 'en', registry)).toEqual({
      ok: false,
      reason: 'unknown_node',
    });
  });
});
