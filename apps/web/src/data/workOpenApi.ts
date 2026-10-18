import type { OpenApiDocument, OpenApiSchema } from '@/lib/openapi';
import { gatewayOrigin } from '@/lib/workConnect';
import type { Locale } from '@/prefs/store';

type Copy = {
  infoTitle: string;
  infoDesc: string;
  serverDesc: string;
  tagModels: string;
  tagTools: string;
  tagEnvelope: string;
  keyDesc: string;
  modelDesc: string;
  inputDesc: string;
  toolInputDesc: string;
  envelopeDesc: string;
  listModelsSummary: string;
  listModelsDesc: string;
  listModels200: string;
  listModels401: string;
  chatSummary: string;
  chatDesc: string;
  chat200: string;
  embedSummary: string;
  embedDesc: string;
  embed200: string;
  embed401: string;
  embed403: string;
  toolSummary: string;
  toolDesc: string;
  skuDesc: string;
  tool200: string;
};

const ZH: Copy = {
  infoTitle: 'Work API',
  infoDesc:
    '面向工作区的数据面接口。鉴权：Capability Key（Bearer）。所有 JSON 响应使用统一信封 ApiEnvelope（success/code/message/data/request_id/timestamp），与 Console `/api`、前台 `/app` 相同。请勿从 Work 调用 a3s-api 管理面。',
  serverDesc: 'Gateway 主机（路径含 /v1 前缀）',
  tagModels: '推理（kind=model）',
  tagTools: '已开通的工具 / API / Feed',
  tagEnvelope: '统一响应信封',
  keyDesc:
    'Identity 推理凭证 ≡ Capability Key（a3s_sk_…）。在 Console → Inference 签发。',
  modelDesc: '已开通集合中的 listing / 路由投影 id',
  inputDesc: '字符串，或字符串数组',
  toolInputDesc:
    '工具 / API 自定义 JSON 载荷。字段名一律 snake_case（如 country_code、page_size）；上游 camelCase 由 Runtime 转发时映射。',
  envelopeDesc:
    '统一 JSON 信封。成功 code=0 且 success=true，业务体在 data；失败 data=null，可选 errors 字段级明细。响应头同步 x-request-id。',
  listModelsSummary: '列出已开通模型',
  listModelsDesc:
    '返回该 Capability Key 可调用的模型 id（Entitlement ∩ Grants ∩ InferenceAccess）。响应经统一信封包装。',
  listModels200: '已开通模型列表（信封 data）',
  listModels401: 'Key 无效或已吊销',
  chatSummary: '创建对话补全',
  chatDesc:
    '对话补全。模型须已开通。用量在 Gateway 侧归因。响应为统一信封，补全结果在 data。',
  chat200: '补全结果（信封 data）',
  embedSummary: '创建向量嵌入',
  embedDesc: 'Env 存在已开通 embedding 路由时可用。响应为统一信封。',
  embed200: '向量结果（信封 data）',
  embed401: '未授权',
  embed403: '未开通',
  toolSummary: '调用已开通工具或 API',
  toolDesc:
    'Gateway 适配器，适用于 kind=tool|api|feed。`{sku}` 为市场 listing SKU（须已开通）。响应为统一信封。',
  skuDesc: '市场 listing SKU',
  tool200: '适配器返回结果（信封 data）',
};

const EN: Copy = {
  infoTitle: 'Work API',
  infoDesc:
    'Data-plane APIs for the workspace. Auth: Capability Key (Bearer). All JSON responses use the shared ApiEnvelope (success/code/message/data/request_id/timestamp), same as Console `/api` and Member `/app`. Do not call a3s-api management routes from Work.',
  serverDesc: 'Gateway host (paths include /v1 prefix)',
  tagModels: 'Inference (kind=model)',
  tagTools: 'Entitled tools / APIs / feeds',
  tagEnvelope: 'Unified response envelope',
  keyDesc:
    'Identity inference credential ≡ Capability Key (a3s_sk_…). Issued in Console → Inference.',
  modelDesc: 'Listing / route projection id from the entitled set',
  inputDesc: 'String or array of strings',
  toolInputDesc:
    'Tool / API JSON payload. Field names must be snake_case (e.g. country_code, page_size); Runtime maps to upstream names on forward.',
  envelopeDesc:
    'Unified JSON envelope. Success: code=0 and success=true with payload in data. Failure: data=null, optional field errors. Header x-request-id mirrors request_id.',
  listModelsSummary: 'List entitled models',
  listModelsDesc:
    'Returns model ids the Capability Key may call. Response wrapped in ApiEnvelope.',
  listModels200: 'Entitled model list (envelope data)',
  listModels401: 'Invalid or revoked key',
  chatSummary: 'Create chat completion',
  chatDesc:
    'Chat completion. Model must be entitled. Usage attributed on Gateway. Response is ApiEnvelope; completion lives in data.',
  chat200: 'Completion (envelope data)',
  embedSummary: 'Create embeddings',
  embedDesc: 'When the Env has an entitled embedding route. Response is ApiEnvelope.',
  embed200: 'Embeddings (envelope data)',
  embed401: 'Unauthorized',
  embed403: 'Not entitled',
  toolSummary: 'Invoke entitled tool or API listing',
  toolDesc:
    'Gateway adapter for kind=tool|api|feed. `{sku}` is the Marketplace listing SKU. Response is ApiEnvelope.',
  skuDesc: 'Marketplace listing SKU',
  tool200: 'Adapter result (envelope data)',
};

function okSchema(dataRef: string): OpenApiSchema {
  return {
    type: 'object',
    required: ['success', 'code', 'message', 'data', 'request_id', 'timestamp'],
    properties: {
      success: { type: 'boolean', example: true, description: 'Always true when code=0' },
      code: { type: 'integer', example: 0, description: '0 = success' },
      message: { type: 'string', example: 'OK' },
      data: { $ref: dataRef },
      request_id: {
        type: 'string',
        format: 'uuid',
        example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        example: '2026-09-18T06:42:00.123Z',
      },
    },
  };
}

function errSchema(codeExample: number, messageExample: string): OpenApiSchema {
  return {
    type: 'object',
    required: ['success', 'code', 'message', 'data', 'request_id', 'timestamp'],
    properties: {
      success: { type: 'boolean', example: false },
      code: {
        type: 'integer',
        example: codeExample,
        description: '40000|40100|40300|40400|40900|42200|42900|50000',
      },
      message: { type: 'string', example: messageExample },
      data: { type: 'object', example: null, description: 'Always null on failure' },
      errors: {
        type: 'array',
        items: { $ref: '#/components/schemas/ApiErrorDetail' },
      },
      request_id: {
        type: 'string',
        format: 'uuid',
        example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        example: '2026-09-18T06:42:00.123Z',
      },
    },
  };
}

function jsonContent(schema: OpenApiSchema) {
  return { 'application/json': { schema } };
}

/**
 * OpenAPI for Kense Work / IDE / Agent data-plane calls via Gateway.
 * Deliberately excludes a3s-api Console/management endpoints.
 * Contract: docs/console/WORK-CONNECT.md + docs/console/API-ENVELOPE.md
 */
export function buildWorkOpenApiDocument(
  locale: Locale = 'zh',
): OpenApiDocument {
  const c = locale === 'en' ? EN : ZH;
  const origin = gatewayOrigin();

  return {
    openapi: '3.0.3',
    info: {
      title: c.infoTitle,
      version: '0.1.0',
      description: c.infoDesc,
    },
    servers: [
      {
        url: origin,
        description: c.serverDesc,
      },
    ],
    tags: [
      { name: 'Models', description: c.tagModels },
      { name: 'Tools', description: c.tagTools },
      { name: 'Envelope', description: c.tagEnvelope },
    ],
    components: {
      securitySchemes: {
        CapabilityKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Capability Key',
          description: c.keyDesc,
        },
      },
      schemas: {
        ApiErrorDetail: {
          type: 'object',
          required: ['field', 'message'],
          properties: {
            field: { type: 'string', example: 'model' },
            message: { type: 'string', example: 'required' },
          },
        },
        ApiEnvelope: {
          type: 'object',
          description: c.envelopeDesc,
          required: ['success', 'code', 'message', 'data', 'request_id', 'timestamp'],
          properties: {
            success: { type: 'boolean', example: true },
            code: { type: 'integer', example: 0 },
            message: { type: 'string', example: 'OK' },
            data: { description: 'Business payload; null on failure' },
            errors: {
              type: 'array',
              items: { $ref: '#/components/schemas/ApiErrorDetail' },
            },
            request_id: {
              type: 'string',
              format: 'uuid',
              example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-09-18T06:42:00.123Z',
            },
          },
        },
        ChatMessage: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: {
              type: 'string',
              enum: ['system', 'user', 'assistant', 'tool'],
            },
            content: { type: 'string' },
          },
        },
        ChatCompletionRequest: {
          type: 'object',
          required: ['model', 'messages'],
          properties: {
            model: {
              type: 'string',
              description: c.modelDesc,
            },
            messages: {
              type: 'array',
              items: { $ref: '#/components/schemas/ChatMessage' },
            },
            temperature: { type: 'number', format: 'float' },
            stream: { type: 'boolean', example: false },
          },
        },
        ChatCompletionResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'chatcmpl_01' },
            object: { type: 'string', example: 'chat.completion' },
            model: { type: 'string' },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer', example: 0 },
                  message: { $ref: '#/components/schemas/ChatMessage' },
                  finish_reason: { type: 'string', example: 'stop' },
                },
              },
            },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: { type: 'integer', example: 8 },
                completion_tokens: { type: 'integer', example: 12 },
                total_tokens: { type: 'integer', example: 20 },
              },
            },
          },
        },
        EmbeddingRequest: {
          type: 'object',
          required: ['model', 'input'],
          properties: {
            model: { type: 'string', example: 'text-embedding' },
            input: {
              description: c.inputDesc,
              example: 'hello world',
            },
          },
        },
        EmbeddingResponse: {
          type: 'object',
          properties: {
            object: { type: 'string', example: 'list' },
            model: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  object: { type: 'string', example: 'embedding' },
                  index: { type: 'integer', example: 0 },
                  embedding: {
                    type: 'array',
                    items: { type: 'number' },
                    example: [0.01, -0.02, 0.03],
                  },
                },
              },
            },
          },
        },
        ModelList: {
          type: 'object',
          properties: {
            object: { type: 'string', example: 'list' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  object: { type: 'string', example: 'model' },
                  owned_by: { type: 'string', example: 'platform' },
                },
              },
            },
          },
        },
        ToolInvokeRequest: {
          type: 'object',
          required: ['input'],
          properties: {
            input: {
              type: 'object',
              description: c.toolInputDesc,
              additionalProperties: true,
              example: { query: 'example' },
            },
          },
        },
        ToolInvokeResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            result: {
              type: 'object',
              additionalProperties: true,
              example: { hits: [] },
            },
          },
        },
      },
    },
    paths: {
      '/v1/api/services/models': {
        get: {
          operationId: 'listModels',
          tags: ['Models'],
          summary: c.listModelsSummary,
          description: c.listModelsDesc,
          security: [{ CapabilityKey: [] }],
          responses: {
            '200': {
              description: c.listModels200,
              content: jsonContent(okSchema('#/components/schemas/ModelList')),
            },
            '401': {
              description: c.listModels401,
              content: jsonContent(errSchema(40100, 'auth.invalid_key')),
            },
          },
        },
      },
      '/v1/api/services/{kind}/invoke/{sku}': {
        post: {
          operationId: 'invokeService',
          tags: ['Services'],
          summary: 'Invoke an entitled listing',
          description:
            'Opaque listing sku in the path. Runtime maps sku → upstream; no subdivided URL suffixes.',
          security: [{ CapabilityKey: [] }],
          parameters: [
            {
              name: 'kind',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: ['model', 'tool', 'api', 'feed'],
                example: 'api',
              },
            },
            {
              name: 'sku',
              in: 'path',
              required: true,
              description: 'Opaque listing id from the entitled set',
              schema: {
                type: 'string',
                example: 'sku',
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
                example: { input: {} },
              },
            },
          },
          responses: {
            '200': {
              description: c.tool200,
              content: jsonContent(
                okSchema('#/components/schemas/ToolInvokeResponse'),
              ),
            },
            '403': {
              description: 'entitlement.denied',
              content: jsonContent(errSchema(40300, 'entitlement.denied')),
            },
            '503': {
              description: 'route.not_ready / provider.credential_missing',
              content: jsonContent(errSchema(50000, 'route.not_ready')),
            },
          },
        },
      },
    },
  };
}
