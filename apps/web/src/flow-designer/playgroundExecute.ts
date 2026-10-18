import { designerRegistry } from './designerFields';
import type {
  PlaygroundEdge,
  PlaygroundNode,
} from './WorkflowPlayground.model';

function dagRecord(
  data: PlaygroundNode['data']['dagNode']['data'],
): Record<string, unknown> {
  return data as unknown as Record<string, unknown>;
}

export type PlaygroundExecutionStep = {
  nodeId: string;
  label: string;
  type: string;
  durationMs: number;
  status: 'success' | 'error' | 'waiting';
  output: unknown;
  error?: string;
};

export type PlaygroundExecution =
  | {
      ok: true;
      steps: PlaygroundExecutionStep[];
      output: unknown;
      /** Set when the walk stopped at a node the browser cannot simulate. */
      pausedAt?: string;
    }
  | { ok: false; steps: PlaygroundExecutionStep[]; error: string };

/**
 * Durable interactions a browser trial cannot advance: waits, callbacks,
 * signals, child work, timeouts, and region coordination. Execution stops
 * there with a `waiting` step instead of pretending the node succeeded.
 */
export const WAITING_NODE_TYPES: ReadonlySet<string> = new Set([
  'flow.wait',
  'flow.hook',
  'flow.signal',
  'flow.child-operation',
  'flow.child-workflow',
  'flow.child-workflows',
  'flow.continue-as-new',
  'flow.timeout',
  'iteration',
  'loop',
]);

const MAX_STEPS = 64;

function nodeType(node: PlaygroundNode): string {
  const type = dagRecord(node.data.dagNode.data).type;
  return typeof type === 'string' ? type : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPath(root: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let current = root;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function compare(op: string, left: unknown, right: unknown): boolean | undefined {
  if (op === 'eq') return Object.is(left, right);
  if (op === 'ne') return !Object.is(left, right);
  if (op === 'contains') {
    if (typeof left === 'string' && typeof right === 'string') return left.includes(right);
    if (Array.isArray(left)) return left.some((item) => Object.is(item, right));
    return false;
  }
  if (op === 'in') {
    if (typeof right === 'string' && typeof left === 'string') return right.includes(left);
    if (Array.isArray(right)) return right.some((item) => Object.is(item, left));
    return false;
  }
  if (
    (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') &&
    typeof left === 'number' &&
    typeof right === 'number'
  ) {
    if (op === 'gt') return left > right;
    if (op === 'gte') return left >= right;
    if (op === 'lt') return left < right;
    return left <= right;
  }
  return undefined;
}

function evaluate(value: unknown, scope: unknown): unknown {
  if (!isRecord(value)) return value;
  const expression = isRecord(value.expression) ? value.expression : value;
  const op = expression.op;
  if (typeof op !== 'string') return value;
  if (op === 'literal') return expression.value;
  if (op === 'field' && typeof expression.path === 'string') {
    return readPath(scope, expression.path);
  }
  if (op === 'concat' && Array.isArray(expression.values)) {
    return expression.values.map((item) => evaluate(item, scope)).join('');
  }
  if (op === 'not') return !evaluate(expression.value, scope);
  if ((op === 'and' || op === 'or') && Array.isArray(expression.values)) {
    const values = expression.values.map((item) => Boolean(evaluate(item, scope)));
    return op === 'and' ? values.every(Boolean) : values.some(Boolean);
  }
  const compared = compare(
    op,
    evaluate(expression.left, scope),
    evaluate(expression.right, scope),
  );
  if (compared !== undefined) return compared;
  throw new Error('unevaluable');
}

function outgoing(
  edges: readonly PlaygroundEdge[],
  source: string,
  handle: string,
): string | undefined {
  return edges.find(
    (edge) => edge.source === source && edge.sourceHandle === handle,
  )?.target;
}

class TrialStepFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrialStepFailure';
  }
}

function renderTemplate(template: string, scope: unknown): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_match, path: string) => {
    const value = readPath(scope, path.trim());
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  });
}

function configuredText(value: unknown, scope: unknown): string {
  if (typeof value === 'string') return value.trim();
  const evaluated = evaluate(value, scope);
  if (typeof evaluated === 'string') return evaluated.trim();
  return '';
}

function collectPassages(value: unknown): string[] {
  const passages: string[] = [];
  const push = (item: unknown) => {
    if (typeof item === 'string' && item.trim()) passages.push(item);
    else if (isRecord(item) && typeof item.text === 'string' && item.text.trim()) {
      passages.push(item.text);
    }
  };
  if (Array.isArray(value)) {
    for (const item of value) push(item);
    return passages;
  }
  if (isRecord(value)) {
    if (Array.isArray(value.items)) return collectPassages(value.items);
    for (const item of Object.values(value)) push(item);
  }
  return passages;
}

function passageScore(text: string, terms: readonly string[]): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    let from = 0;
    while (from < haystack.length) {
      const at = haystack.indexOf(term, from);
      if (at < 0) break;
      score += 1;
      from = at + term.length;
    }
  }
  return score;
}

function rankPassages(query: string, passages: readonly string[], count: number): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);
  return passages
    .map((text, index) => ({ text, index, score: passageScore(text, terms) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .filter((item) => item.score > 0)
    .slice(0, count)
    .map((item) => item.text);
}

function assignmentValue(spec: unknown, scope: unknown): unknown {
  if (typeof spec === 'string') {
    const path = spec.trim();
    return path ? readPath(scope, path) : undefined;
  }
  return evaluate(spec, scope);
}

function aggregateVariables(value: unknown, scope: unknown): unknown {
  if (!isRecord(value)) return {};
  const live: Array<[string, unknown]> = [];
  for (const [name, spec] of Object.entries(value)) {
    const resolved = assignmentValue(spec, scope);
    if (resolved === undefined || resolved === null || resolved === '') continue;
    live.push([name, resolved]);
  }
  if (live.length === 1) return live[0]?.[1];
  return Object.fromEntries(live);
}

function stringHeaders(value: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isRecord(value)) return headers;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') headers[key] = item;
  }
  return headers;
}

function applyAuth(headers: Record<string, string>, auth: unknown): void {
  if (!isRecord(auth)) return;
  const scheme = typeof auth.scheme === 'string' ? auth.scheme.trim() : '';
  const token = typeof auth.token === 'string' ? auth.token : '';
  if (scheme && token) {
    const normalized = scheme.toLowerCase() === 'bearer' ? 'Bearer' : scheme;
    headers.authorization = `${normalized} ${token}`;
    return;
  }
  if (typeof auth.header === 'string' && typeof auth.value === 'string') {
    headers[auth.header] = auth.value;
  }
}

type FilePart = {
  name: string;
  filename: string;
  content: string;
  contentType: string;
};

function fileParts(value: unknown): FilePart[] {
  const parts: FilePart[] = [];
  const push = (name: string, raw: unknown) => {
    if (typeof raw === 'string') {
      parts.push({ name, filename: name, content: raw, contentType: 'text/plain' });
      return;
    }
    if (!isRecord(raw) || typeof raw.content !== 'string') return;
    const partName = typeof raw.name === 'string' && raw.name ? raw.name : name;
    parts.push({
      name: partName,
      filename: typeof raw.filename === 'string' && raw.filename ? raw.filename : partName,
      content: raw.content,
      contentType:
        typeof raw.content_type === 'string' && raw.content_type
          ? raw.content_type
          : 'text/plain',
    });
  };
  if (Array.isArray(value)) {
    value.forEach((item, index) => push(`file${String(index)}`, item));
    return parts;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) push(key, item);
  }
  return parts;
}

function attemptCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}

function timeoutMsOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 10_000;
  return Math.min(120_000, Math.max(1, Math.trunc(value)));
}

function decodeBody(text: string, contentType: string | null): unknown {
  if (contentType?.includes('json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

function requestInit(
  method: string,
  body: unknown,
  headers: Record<string, string>,
  files: readonly FilePart[],
  signal: AbortSignal,
): RequestInit {
  const headerCopy: Record<string, string> = { ...headers };
  const init: RequestInit = { method, headers: headerCopy, signal };
  if (method === 'GET' || method === 'HEAD') return init;
  if (files.length > 0) {
    const form = new FormData();
    form.append('body', typeof body === 'string' ? body : JSON.stringify(body ?? {}));
    for (const file of files) {
      form.append(file.name, new Blob([file.content], { type: file.contentType }), file.filename);
    }
    for (const key of Object.keys(headerCopy)) {
      if (key.toLowerCase() === 'content-type') delete headerCopy[key];
    }
    init.body = form;
    return init;
  }
  if (!Object.keys(headerCopy).some((key) => key.toLowerCase() === 'content-type')) {
    headerCopy['content-type'] = 'application/json';
  }
  init.body = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return init;
}

async function performHttp(
  data: Record<string, unknown>,
  scope: unknown,
): Promise<Record<string, unknown>> {
  const method =
    typeof data.method === 'string' && data.method ? data.method.toUpperCase() : 'GET';
  const url = configuredText(data.url, scope);
  const requestBody = data.body ?? {};
  if (!url) {
    return {
      ok: false,
      method,
      url: '',
      body: requestBody,
      status: 0,
      reason: 'The URL is empty.',
    };
  }
  const headers = stringHeaders(data.headers);
  applyAuth(headers, data.auth);
  const files = fileParts(data.files);
  const attempts = attemptCount(data.retry);
  const timeoutMs = timeoutMsOf(data.timeout);
  let failure: Record<string, unknown> = {
    ok: false,
    method,
    url,
    status: 0,
    body: null,
    reason: 'The request failed.',
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        url,
        requestInit(method, requestBody, headers, files, controller.signal),
      );
      const text = await response.text();
      const body = decodeBody(text, response.headers.get('content-type'));
      if (response.status >= 200 && response.status < 300) {
        return { ok: true, method, url, status: response.status, body };
      }
      failure = {
        ok: false,
        method,
        url,
        status: response.status,
        body,
        reason: `HTTP status ${response.status}`,
      };
    } catch (error) {
      failure = {
        ok: false,
        method,
        url,
        status: 0,
        body: null,
        reason: controller.signal.aborted
          ? 'The request timed out.'
          : error instanceof Error
            ? error.message
            : 'The request failed.',
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return failure;
}

async function performLlm(
  data: Record<string, unknown>,
  scope: unknown,
  locale: 'zh' | 'en',
): Promise<string> {
  const endpoint = configuredText(data.endpoint, scope);
  if (!/^https?:\/\//iu.test(endpoint)) {
    throw new TrialStepFailure(
      locale === 'zh' ? '模型来源缺失。' : 'The model source is missing.',
    );
  }
  const prompt = renderTemplate(typeof data.prompt === 'string' ? data.prompt : '', scope);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch (error) {
    throw new TrialStepFailure(
      error instanceof Error ? error.message : 'The model call failed.',
    );
  }
  const text = await response.text();
  if (response.status < 200 || response.status >= 300) {
    throw new TrialStepFailure(
      locale === 'zh'
        ? `模型调用失败：HTTP 状态 ${response.status}`
        : `The model call failed with HTTP status ${response.status}`,
    );
  }
  return text;
}

function performRetrieval(
  data: Record<string, unknown>,
  scope: unknown,
  locale: 'zh' | 'en',
): string[] {
  const passages = collectPassages(data.documents);
  if (passages.length === 0) {
    throw new TrialStepFailure(
      locale === 'zh' ? '文档来源缺失。' : 'The document source is missing.',
    );
  }
  const queryValue = evaluate(data.query, scope);
  const query =
    queryValue == null ? '' : typeof queryValue === 'string' ? queryValue : String(queryValue);
  const count =
    typeof data.count === 'number' && Number.isFinite(data.count)
      ? Math.max(1, Math.trunc(data.count))
      : 3;
  return rankPassages(query, passages, count);
}

async function performCode(data: Record<string, unknown>, scope: unknown): Promise<unknown> {
  const source = typeof data.code === 'string' ? data.code : '';
  const inputs = evaluate(data.inputs, scope);
  try {
    const fn = new Function('inputs', source) as (inputs: unknown) => unknown;
    return await fn(inputs);
  } catch (error) {
    if (error instanceof TrialStepFailure) throw error;
    throw new TrialStepFailure(error instanceof Error ? error.message : String(error));
  }
}

async function stepResult(
  node: PlaygroundNode,
  scope: Record<string, unknown>,
  locale: 'zh' | 'en',
): Promise<unknown> {
  const data = dagRecord(node.data.dagNode.data);
  const type = nodeType(node);
  if (type === 'flow.start') return scope.input ?? {};
  if (type === 'flow.complete') {
    return evaluate(data.output_expression, scope) ?? scope.input ?? {};
  }
  if (type === 'flow.step' || type === 'flow.batch') {
    const task = typeof data.step_name === 'string' ? data.step_name : node.id;
    const input = evaluate(data.input, scope);
    return { task, input: input ?? scope.input ?? {} };
  }
  if (type === 'flow.condition') {
    const value = evaluate(data.expression ?? data.input, scope);
    if (typeof value !== 'boolean') throw new Error('unevaluable');
    return { matched: value, value };
  }
  if (type === 'biz.data.map') {
    return evaluate(data.mapping, scope) ?? null;
  }
  if (type === 'biz.http.call') return performHttp(data, scope);
  if (type === 'biz.flow.switch') {
    const value = evaluate(data.value, scope);
    const text = value == null ? '' : String(value);
    const handle =
      text === data.case_a ? 'case_a' : text === data.case_b ? 'case_b' : 'otherwise';
    return { value: text, handle };
  }
  if (type === 'biz.data.template') {
    return renderTemplate(typeof data.template === 'string' ? data.template : '', scope);
  }
  if (type === 'biz.data.aggregate') return aggregateVariables(data.variables, scope);
  if (type === 'biz.code.run') return performCode(data, scope);
  if (type === 'biz.ai.llm') return performLlm(data, scope, locale);
  if (type === 'biz.knowledge.retrieve') return performRetrieval(data, scope, locale);
  return { type, id: node.id };
}

function stepFailureMessage(error: unknown, locale: 'zh' | 'en'): string {
  if (error instanceof TrialStepFailure) return error.message;
  return locale === 'zh'
    ? '这个节点的表达式无法在试运行中求值。'
    : 'This node’s expression cannot be evaluated in a trial run.';
}

function nextHandle(type: string, output: unknown): string | undefined {
  const controls =
    designerRegistry('en')
      .get(type)
      ?.ports.outputs.filter((port) => port.kind === 'control') ?? [];
  if (controls.length === 0) return undefined;
  if (
    type === 'flow.condition' &&
    controls.some((port) => port.id === 'matched') &&
    controls.some((port) => port.id === 'otherwise')
  ) {
    return isRecord(output) && output.matched === true ? 'matched' : 'otherwise';
  }
  if (
    type === 'biz.flow.switch' &&
    isRecord(output) &&
    typeof output.handle === 'string' &&
    controls.some((port) => port.id === output.handle)
  ) {
    return output.handle;
  }
  if (
    type === 'biz.http.call' &&
    isRecord(output) &&
    output.ok === false &&
    controls.some((port) => port.id === 'failed')
  ) {
    return 'failed';
  }
  // Manifests list the success continuation before later branches.
  return controls[0]?.id;
}

function entryNode(nodes: readonly PlaygroundNode[]): PlaygroundNode | undefined {
  const start = nodes.find(
    (node) => !node.parentId && nodeType(node) === 'flow.start',
  );
  if (start) return start;
  const roots = nodes.filter((node) => !node.parentId);
  return roots.length === 1 ? roots[0] : undefined;
}

export async function executeNode(input: {
  node: PlaygroundNode;
  trigger: unknown;
  locale: 'zh' | 'en';
  label: string;
}): Promise<PlaygroundExecutionStep> {
  const type = nodeType(input.node);
  const started = performance.now();
  if (WAITING_NODE_TYPES.has(type)) {
    return {
      nodeId: input.node.id,
      label: input.label,
      type,
      durationMs: 0,
      status: 'waiting',
      output: null,
    };
  }
  let output: unknown;
  try {
    output = await stepResult(
      input.node,
      { input: input.trigger ?? {}, steps: {} },
      input.locale,
    );
  } catch (error) {
    return {
      nodeId: input.node.id,
      label: input.label,
      type,
      durationMs: 0,
      status: 'error',
      output: null,
      error: stepFailureMessage(error, input.locale),
    };
  }
  return {
    nodeId: input.node.id,
    label: input.label,
    type,
    durationMs: Math.max(1, Math.round(performance.now() - started)),
    status: 'success',
    output,
  };
}

export async function executePlaygroundGraph(input: {
  nodes: readonly PlaygroundNode[];
  edges: readonly PlaygroundEdge[];
  trigger: unknown;
  locale: 'zh' | 'en';
  label: (node: PlaygroundNode) => string;
}): Promise<PlaygroundExecution> {
  const start = entryNode(input.nodes);
  if (!start) {
    return {
      ok: false,
      steps: [],
      error:
        input.locale === 'zh'
          ? '需要一个开始节点才能执行。'
          : 'A start node is required to run.',
    };
  }

  const scope: Record<string, unknown> = {
    input: input.trigger ?? {},
    steps: {},
  };
  const steps: PlaygroundExecutionStep[] = [];
  let current: PlaygroundNode | undefined = start;
  const seen = new Set<string>();

  while (current) {
    if (steps.length >= MAX_STEPS || seen.has(current.id)) {
      return {
        ok: false,
        steps,
        error:
          input.locale === 'zh'
            ? '执行步数超过上限，已停止。'
            : 'Execution exceeded the step limit and stopped.',
      };
    }
    seen.add(current.id);
    const type = nodeType(current);
    if (WAITING_NODE_TYPES.has(type)) {
      steps.push({
        nodeId: current.id,
        label: input.label(current),
        type,
        durationMs: 0,
        status: 'waiting',
        output: null,
      });
      return { ok: true, steps, output: scope.input, pausedAt: current.id };
    }
    const started = performance.now();
    let output: unknown;
    try {
      output = await stepResult(current, scope, input.locale);
    } catch (caught) {
      const error = stepFailureMessage(caught, input.locale);
      steps.push({
        nodeId: current.id,
        label: input.label(current),
        type,
        durationMs: 0,
        status: 'error',
        output: null,
        error,
      });
      return { ok: false, steps, error };
    }
    const durationMs = Math.max(1, Math.round(performance.now() - started));
    steps.push({
      nodeId: current.id,
      label: input.label(current),
      type,
      durationMs,
      status: 'success',
      output,
    });
    if (isRecord(scope.steps)) {
      scope.steps[current.id] = output;
      const stepName = dagRecord(current.data.dagNode.data).step_name;
      if (typeof stepName === 'string' && stepName) scope.steps[stepName] = output;
    }
    if (type === 'flow.complete') {
      return { ok: true, steps, output };
    }
    if (type === 'flow.fail') {
      const error =
        input.locale === 'zh' ? '工作流以失败结束。' : 'The workflow ended in failure.';
      return { ok: false, steps, error };
    }
    const handle = nextHandle(type, output);
    const nextId: string | undefined = handle
      ? outgoing(input.edges, current.id, handle)
      : undefined;
    if (!nextId) {
      return { ok: true, steps, output };
    }
    let next: PlaygroundNode | undefined;
    for (const node of input.nodes) {
      if (node.id === nextId) {
        next = node;
        break;
      }
    }
    if (!next) {
      const error =
        input.locale === 'zh'
          ? '下一条连线指向不存在的节点。'
          : 'The next connection points at a missing node.';
      return { ok: false, steps, error };
    }
    current = next;
  }

  return { ok: true, steps, output: scope.input };
}
