import { describe, expect, test } from 'bun:test';
import { parseOpenApiDocument, unwrapOpenApiDocument } from './openapi';
import { groupLabel, operationTitle } from '@/pages/apiDocs/labels';

describe('platform OpenAPI catalog', () => {
  const ops = parseOpenApiDocument({
    paths: {
      '/v1/api/admin/model-service/suppliers': {
        get: {},
        post: {},
      },
      '/v1/api/org/members/login': { post: {} },
      '/v1/api/org/models': { get: {} },
      '/v1/api/admin/docs/openapi.json': { get: {} },
    },
  });

  test('groups admin and member routes by resource', () => {
    const groups = new Map(ops.map((op) => [`${op.method} ${op.path}`, op.group]));
    expect(groups.get('get /v1/api/admin/model-service/suppliers')).toBe('admin/model-service');
    expect(groups.get('get /v1/api/org/models')).toBe('org/models');
  });

  test('treats login and the spec itself as public', () => {
    const byPath = new Map(ops.map((op) => [op.path + ' ' + op.method, op.hasBearerAuth]));
    expect(byPath.get('/v1/api/org/members/login post')).toBe(false);
    expect(byPath.get('/v1/api/admin/docs/openapi.json get')).toBe(false);
    expect(byPath.get('/v1/api/admin/model-service/suppliers get')).toBe(true);
    expect(byPath.get('/v1/api/org/models get')).toBe(true);
  });

  test('reads a raw document and an enveloped document', () => {
    const spec = { openapi: '3.0.3', paths: { '/v1/api/admin/notes': { get: {} } } };
    expect(unwrapOpenApiDocument(spec).paths).toEqual(spec.paths);
    expect(
      unwrapOpenApiDocument({ success: true, code: 0, message: 'OK', data: spec }).paths,
    ).toEqual(spec.paths);
  });

  test('labels the catalog in Chinese by default', () => {
    const suppliers = ops.find((op) => op.path.endsWith('/suppliers') && op.method === 'get');
    expect(suppliers).toBeDefined();
    expect(groupLabel(suppliers!.group, 'zh')).toBe('管理 · 模型服务');
    expect(operationTitle(suppliers!, 'zh')).toBe('列出供应商');
  });

  test('names actions and doubled admin paths in Chinese', () => {
    const titled = parseOpenApiDocument({
      paths: {
        '/v1/api/admin': { get: {} },
        '/v1/api/admin/v1/api/admin/im/{org_id}/service-identities': { get: {} },
        '/v1/api/admin/models/hubs': { get: {} },
        '/v1/api/admin/assets/models/{owner}/{name}/files/download': { get: {} },
        '/v1/api/org/im/{org_id}/conversations/{conversation_id}/mute': { post: {} },
        '/v1/api/org/drive/{org_id}/files/{file_id}/content': { get: {} },
      },
    });
    const title = (path: string, method: string) =>
      operationTitle(titled.find((op) => op.path === path && op.method === method)!, 'zh');
    expect(title('/v1/api/admin', 'get')).toBe('管理入口');
    expect(titled.find((op) => op.path.includes('service-identities'))?.group).toBe('admin/im');
    expect(title('/v1/api/admin/v1/api/admin/im/{org_id}/service-identities', 'get')).toBe('列出服务身份');
    expect(title('/v1/api/admin/models/hubs', 'get')).toBe('列出模型库');
    expect(title('/v1/api/admin/assets/models/{owner}/{name}/files/download', 'get')).toBe('下载文件');
    expect(title('/v1/api/org/im/{org_id}/conversations/{conversation_id}/mute', 'post')).toBe('静音会话');
    expect(title('/v1/api/org/drive/{org_id}/files/{file_id}/content', 'get')).toBe('获取内容');
    for (const op of titled) {
      expect(operationTitle(op, 'zh')).not.toMatch(/[A-Za-z]/);
      expect(groupLabel(op.group, 'zh')).not.toMatch(/[A-Za-z]/);
    }
  });
});
