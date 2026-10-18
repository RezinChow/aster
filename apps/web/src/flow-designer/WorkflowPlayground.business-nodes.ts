import {
  createA3sFlowExpression,
  defineA3sFlowCustomDagNode,
  type A3sFlowCustomDagNodeRegistration,
  type A3sFlowDagPortDefinition,
  type WorkflowNodeFieldDefinition,
  type WorkflowNodeOutputDefinition,
} from '@a3s-lab/flow-ui';
import type { FlowWebsiteLocale } from './flow-node-catalog';

type LocalizedText = Record<FlowWebsiteLocale, string>;

const text = (zh: string, en: string): LocalizedText => ({ zh, en });

function output(
  name: string,
  displayName: string,
  types: readonly string[],
): WorkflowNodeOutputDefinition {
  return {
    name,
    display_name: displayName,
    types: [...types],
    group_outputs: false,
    allows_loop: false,
    tool_mode: false,
  };
}

function controlPort(id: string, label: string): A3sFlowDagPortDefinition {
  return { id, label, kind: 'control', types: ['FlowControl'] };
}

function dataPort(
  id: string,
  label: string,
  types: readonly string[],
): A3sFlowDagPortDefinition {
  return { id, label, kind: 'data', types };
}

function field(
  locale: FlowWebsiteLocale,
  definition: WorkflowNodeFieldDefinition & {
    labels: LocalizedText;
    help: LocalizedText;
  },
): WorkflowNodeFieldDefinition {
  const { labels, help, ...rest } = definition;
  return {
    ...rest,
    display_name: labels[locale],
    info: help[locale],
  };
}

/** Host actions a business workflow needs beyond the orchestration kernel. */
export function createBusinessActionNodes(
  locale: FlowWebsiteLocale,
): A3sFlowCustomDagNodeRegistration[] {
  const zh = locale === 'zh';
  const group = zh ? '业务动作' : 'Business actions';
  return [
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.http.call',
        display_name: zh ? '调用 HTTP' : 'Call HTTP',
        description: zh
          ? '按方法、地址、请求头、认证、请求体和文件调用接入方的 HTTP 接口，失败时走失败分支。'
          : 'Call a host HTTP endpoint with method, URL, headers, auth, body, timeout, retry, and files.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'globe',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '成功' : 'Success'),
            controlPort('failed', zh ? '失败' : 'Failed'),
            dataPort('response', zh ? '响应' : 'Response', ['Json']),
          ],
        },
        outputs: [
            output('next', zh ? '成功' : 'Success', ['FlowControl']),
            output('failed', zh ? '失败' : 'Failed', ['FlowControl']),
            output('response', zh ? '响应' : 'Response', ['Json']),
        ],
        input_types: ['Json'],
        output_types: ['Json'],
        fields: [
          field(locale, {
            name: 'method',
            labels: text('请求方法', 'Method'),
            help: text('选择这次调用使用的 HTTP 方法。', 'Choose the HTTP method for this call.'),
            type: 'str',
            _input_type: 'DropdownInput',
            value: 'POST',
            options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({
              label: value,
              value,
            })),
            required: true,
          }),
          field(locale, {
            name: 'url',
            labels: text('请求地址', 'URL'),
            help: text(
              '选择或填写要调用的地址。试运行会求值这个表达式。',
              'Choose or enter the URL. A trial run evaluates this expression.',
            ),
            type: 'dict',
            _input_type: 'A3sFlowExpressionInput',
            expression_purpose: 'input',
            value: createA3sFlowExpression({ op: 'field', path: 'input.url' }),
            required: true,
          }),
          field(locale, {
            name: 'headers',
            labels: text('请求头', 'Headers'),
            help: text(
              '附加的请求头，键是头名称，值是文本。',
              'Extra request headers. Each key is a header name and each value is text.',
            ),
            type: 'dict',
            _input_type: 'JSONInput',
            value: {},
            required: false,
          }),
          field(locale, {
            name: 'auth',
            labels: text('认证', 'Auth'),
            help: text(
              '填写 scheme 和 token，例如 Bearer。也可填写 header 和 value。',
              'Set scheme and token, for example Bearer. header and value set a custom header.',
            ),
            type: 'dict',
            _input_type: 'JSONInput',
            value: {},
            required: false,
          }),
          field(locale, {
            name: 'body',
            labels: text('请求体', 'Body'),
            help: text('附加 JSON 请求体。GET 可以留空对象。', 'Optional JSON body. GET may keep an empty object.'),
            type: 'dict',
            _input_type: 'JSONInput',
            value: {},
            required: false,
          }),
          field(locale, {
            name: 'files',
            labels: text('文件', 'Files'),
            help: text(
              '随请求发送的文件。键是分段名称，值是文本或带 filename、content 的对象。',
              'File parts sent with the request. Each key is the part name; each value is text or an object with filename and content.',
            ),
            type: 'dict',
            _input_type: 'JSONInput',
            value: {},
            required: false,
          }),
          field(locale, {
            name: 'timeout',
            labels: text('超时（毫秒）', 'Timeout (ms)'),
            help: text('单次请求的最长等待时间。', 'How long one attempt may wait.'),
            type: 'int',
            _input_type: 'IntInput',
            value: 10000,
            range_spec: { min: 1, max: 120000, step: 1 },
            required: true,
          }),
          field(locale, {
            name: 'retry',
            labels: text('尝试次数', 'Attempts'),
            help: text(
              '失败时最多发出这么多次请求，成功则提前停止。',
              'Maximum number of attempts. A success stops before the count is exhausted.',
            ),
            type: 'int',
            _input_type: 'IntInput',
            value: 1,
            range_spec: { min: 1, max: 8, step: 1 },
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/http-call', version: '1.0.0', handler: 'http.call' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.data.map',
        display_name: zh ? '整理数据' : 'Map data',
        description: zh
          ? '用一个表达式把上游数据整理成下一步需要的对象。'
          : 'Map upstream data into the object the next step needs.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'funnel',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '继续' : 'Next'),
            dataPort('value', zh ? '结果' : 'Value', ['Json']),
          ],
        },
        outputs: [
            output('next', zh ? '继续' : 'Next', ['FlowControl']),
            output('value', zh ? '结果' : 'Value', ['Json']),
        ],
        input_types: ['Json'],
        output_types: ['Json'],
        fields: [
          field(locale, {
            name: 'mapping',
            labels: text('映射', 'Mapping'),
            help: text(
              '选择要传给下一步的字段或对象。',
              'Choose the field or object passed to the next step.',
            ),
            type: 'dict',
            _input_type: 'A3sFlowExpressionInput',
            expression_purpose: 'input',
            value: createA3sFlowExpression({ op: 'field', path: 'input' }),
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/data-map', version: '1.0.0', handler: 'data.map' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.flow.switch',
        display_name: zh ? '多路分支' : 'Switch',
        description: zh
          ? '按一个值在两条命名分支和其他分支之间选择。'
          : 'Choose between two named branches and an otherwise branch.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'git-fork',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('case_a', zh ? '分支 A' : 'Case A'),
            controlPort('case_b', zh ? '分支 B' : 'Case B'),
            controlPort('otherwise', zh ? '其他' : 'Otherwise'),
          ],
        },
        outputs: [
            output('case_a', zh ? '分支 A' : 'Case A', ['FlowControl']),
            output('case_b', zh ? '分支 B' : 'Case B', ['FlowControl']),
            output('otherwise', zh ? '其他' : 'Otherwise', ['FlowControl']),
        ],
        input_types: ['Json'],
        output_types: ['FlowControl'],
        fields: [
          field(locale, {
            name: 'value',
            labels: text('分支值', 'Switch value'),
            help: text('选择用来比对的上游值。', 'Choose the upstream value to compare.'),
            type: 'dict',
            _input_type: 'A3sFlowExpressionInput',
            expression_purpose: 'input',
            value: createA3sFlowExpression({ op: 'field', path: 'input.status' }),
            required: true,
          }),
          field(locale, {
            name: 'case_a',
            labels: text('分支 A 匹配', 'Case A match'),
            help: text('值等于这段文字时走分支 A。', 'Take case A when the value equals this text.'),
            type: 'str',
            _input_type: 'StrInput',
            value: 'approved',
            required: true,
          }),
          field(locale, {
            name: 'case_b',
            labels: text('分支 B 匹配', 'Case B match'),
            help: text('值等于这段文字时走分支 B。', 'Take case B when the value equals this text.'),
            type: 'str',
            _input_type: 'StrInput',
            value: 'rejected',
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/flow-switch', version: '1.0.0', handler: 'flow.switch' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.ai.llm',
        display_name: 'LLM',
        description: zh
          ? '把提示词中的变量替换后发给配置的模型地址，并返回模型正文。'
          : 'Substitute prompt variables and return the text from the configured model endpoint.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'brain',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '继续' : 'Next'),
            dataPort('text', zh ? '模型正文' : 'Text', ['Text']),
          ],
        },
        outputs: [
            output('next', zh ? '继续' : 'Next', ['FlowControl']),
            output('text', zh ? '模型正文' : 'Text', ['Text']),
        ],
        input_types: ['Json'],
        output_types: ['Text'],
        fields: [
          field(locale, {
            name: 'endpoint',
            labels: text('模型地址', 'Model endpoint'),
            help: text(
              '本地或自建模型的 HTTP 地址。留空表示模型来源缺失。',
              'HTTP endpoint of a local or self-hosted model. Leave it empty when the model source is missing.',
            ),
            type: 'str',
            _input_type: 'StrInput',
            value: '',
            required: false,
          }),
          field(locale, {
            name: 'prompt',
            labels: text('提示词', 'Prompt'),
            help: text(
              '用 {{input.question}} 这样的路径引用试运行输入。',
              'Reference trial input with paths such as {{input.question}}.',
            ),
            type: 'prompt',
            _input_type: 'PromptInput',
            value: '{{input.prompt}}',
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/ai-llm', version: '1.0.0', handler: 'ai.llm' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.knowledge.retrieve',
        display_name: zh ? '知识检索' : 'Knowledge retrieval',
        description: zh
          ? '在给出的文档中按查询词重叠检索，并按相关度返回段落。'
          : 'Search the given documents by query-term overlap and return passages in rank order.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'books',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '继续' : 'Next'),
            dataPort('passages', zh ? '段落' : 'Passages', ['Json']),
          ],
        },
        outputs: [
            output('next', zh ? '继续' : 'Next', ['FlowControl']),
            output('passages', zh ? '段落' : 'Passages', ['Json']),
        ],
        input_types: ['Json'],
        output_types: ['Json'],
        fields: [
          field(locale, {
            name: 'query',
            labels: text('查询', 'Query'),
            help: text('选择或填写要检索的查询。', 'Choose or enter the query to search for.'),
            type: 'dict',
            _input_type: 'A3sFlowExpressionInput',
            expression_purpose: 'input',
            value: createA3sFlowExpression({ op: 'field', path: 'input.query' }),
            required: true,
          }),
          field(locale, {
            name: 'documents',
            labels: text('文档来源', 'Document source'),
            help: text(
              '本地文档。键对应一段文本，或带 text 字段的对象。留空表示文档来源缺失。',
              'Local documents. Each value is passage text or an object with text. Leave it empty when the document source is missing.',
            ),
            type: 'dict',
            _input_type: 'JSONInput',
            value: {},
            required: true,
          }),
          field(locale, {
            name: 'count',
            labels: text('返回条数', 'Result count'),
            help: text('最多返回这么多段匹配文本。', 'Maximum number of matching passages.'),
            type: 'int',
            _input_type: 'IntInput',
            value: 3,
            range_spec: { min: 1, max: 20, step: 1 },
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/knowledge-retrieve', version: '1.0.0', handler: 'knowledge.retrieve' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.code.run',
        display_name: zh ? '代码执行' : 'Code execution',
        description: zh
          ? '执行一段 JavaScript。inputs 是选中的输入，返回值成为节点输出。'
          : 'Run a JavaScript snippet. inputs is the selected value, and its return value is the output.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'code',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '继续' : 'Next'),
            dataPort('result', zh ? '返回值' : 'Result', ['Json']),
          ],
        },
        outputs: [
            output('next', zh ? '继续' : 'Next', ['FlowControl']),
            output('result', zh ? '返回值' : 'Result', ['Json']),
        ],
        input_types: ['Json'],
        output_types: ['Json'],
        fields: [
          field(locale, {
            name: 'inputs',
            labels: text('输入', 'Inputs'),
            help: text('传给代码的 inputs。', 'Value passed to the snippet as inputs.'),
            type: 'dict',
            _input_type: 'A3sFlowExpressionInput',
            expression_purpose: 'input',
            value: createA3sFlowExpression({ op: 'field', path: 'input' }),
            required: true,
          }),
          field(locale, {
            name: 'code',
            labels: text('代码', 'Code'),
            help: text(
              'JavaScript 函数体。用 return 返回结果。',
              'JavaScript function body. Return the result.',
            ),
            type: 'code',
            _input_type: 'CodeInput',
            language: 'javascript',
            value: 'return inputs;',
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/code-run', version: '1.0.0', handler: 'code.run' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.data.template',
        display_name: zh ? '模板转换' : 'Template transform',
        description: zh
          ? '把试运行范围里的值填进模板，输出渲染后的文本。'
          : 'Fill trial-scope values into a template and output the rendered text.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'article',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '继续' : 'Next'),
            dataPort('text', zh ? '文本' : 'Text', ['Text']),
          ],
        },
        outputs: [
            output('next', zh ? '继续' : 'Next', ['FlowControl']),
            output('text', zh ? '文本' : 'Text', ['Text']),
        ],
        input_types: ['Json'],
        output_types: ['Text'],
        fields: [
          field(locale, {
            name: 'template',
            labels: text('模板', 'Template'),
            help: text(
              '用 {{input.order.id}} 引用试运行范围中的值。',
              'Reference trial-scope values with {{input.order.id}}.',
            ),
            type: 'prompt',
            _input_type: 'PromptInput',
            value: '{{input.text}}',
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/data-template', version: '1.0.0', handler: 'data.template' },
    }),
    defineA3sFlowCustomDagNode({
      manifest: {
        type: 'biz.data.aggregate',
        display_name: zh ? '变量聚合' : 'Variable aggregation',
        description: zh
          ? '收集各分支写出的变量。只有一个有值时输出该值，多个有值时一起输出。'
          : 'Collect variables written by branches. One live value is emitted as itself; several are emitted together.',
        category: 'business',
        categoryLabel: group,
        role: 'host',
        icon: 'git-merge',
        ports: {
          inputs: [controlPort('in', zh ? '进入' : 'In')],
          outputs: [
            controlPort('next', zh ? '继续' : 'Next'),
            dataPort('value', zh ? '聚合值' : 'Value', ['Json']),
          ],
        },
        outputs: [
            output('next', zh ? '继续' : 'Next', ['FlowControl']),
            output('value', zh ? '聚合值' : 'Value', ['Json']),
        ],
        input_types: ['Json'],
        output_types: ['Json'],
        fields: [
          field(locale, {
            name: 'variables',
            labels: text('变量', 'Variables'),
            help: text(
              '变量名对应一个表达式或路径。没有值的变量会被跳过。',
              'Each name maps to an expression or path. Variables without a value are skipped.',
            ),
            type: 'dict',
            _input_type: 'JSONInput',
            value: {},
            required: true,
          }),
        ],
      },
      capability: { id: 'biz/data-aggregate', version: '1.0.0', handler: 'data.aggregate' },
    }),
  ];
}
