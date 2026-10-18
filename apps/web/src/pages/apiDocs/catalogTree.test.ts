import { describe, expect, test } from 'bun:test';
import type { ApiOperation } from '@/lib/openapi';
import {
  buildCatalogTree,
  buildSideCatalog,
  catalogAncestorIds,
  docsPlaneForPath,
  preferCatalogOp,
} from './catalogTree';

function op(id: string, method: ApiOperation['method'], path: string): ApiOperation {
  return {
    id,
    method,
    path,
    summary: '',
    description: '',
    group: '',
    parameters: [],
    responses: {},
    security: [],
    hasBearerAuth: true,
  };
}

describe('buildCatalogTree', () => {
  test('nests admin and member routes under a plane and a resource', () => {
    const tree = buildCatalogTree(
      [
        {
          group: 'org/models',
          items: [op('get-models', 'get', '/v1/api/org/models')],
        },
        {
          group: 'admin/model-service',
          items: [op('get-suppliers', 'get', '/v1/api/admin/model-service/suppliers')],
        },
      ],
      'zh',
    );
    expect(tree.map((node) => node.label)).toEqual(['管理', '成员']);
    expect(tree[0].children[0].label).toBe('模型服务');
    expect(tree[0].children[0].children[0].label).toBe('列出供应商');
    expect(catalogAncestorIds(tree, 'get-suppliers')).toEqual(['admin', 'admin/model-service']);
  });

  test('lifts the selected plane to resource branches and keeps host routes', () => {
    const menu = buildSideCatalog(
      [
        {
          group: 'org/models',
          items: [op('get-models', 'get', '/v1/api/org/models')],
        },
        {
          group: 'admin/model-service',
          items: [op('get-suppliers', 'get', '/v1/api/admin/model-service/suppliers')],
        },
        {
          group: 'git',
          items: [op('get-git', 'get', '/git/repos')],
        },
      ],
      'zh',
    );
    expect(menu.map((node) => node.label)).toEqual(['模型服务', '模型', '代码仓库']);
    expect(catalogAncestorIds(menu, 'get-suppliers')).toEqual(['admin/model-service']);
    expect(docsPlaneForPath('/v1/api/org/models')).toBe('front');
    expect(docsPlaneForPath('/v1/api/admin/model-service/suppliers')).toBe('back');
    expect(docsPlaneForPath('/git/repos')).toBe('back');
    expect(docsPlaneForPath('/health')).toBe('back');
  });

  test('adds a resource group under a module', () => {
    const menu = buildSideCatalog(
      [
        {
          group: 'admin/model-service',
          items: [
            op('get-suppliers', 'get', '/v1/api/admin/model-service/suppliers'),
            op('probe', 'post', '/v1/api/admin/model-service/suppliers/{id}/probe'),
            op('get-models', 'get', '/v1/api/admin/model-service/models'),
          ],
        },
        {
          group: 'org/members',
          items: [
            op('login', 'post', '/v1/api/org/members/login'),
            op('list-orgs', 'get', '/v1/api/org/members/orgs'),
            op('departments', 'get', '/v1/api/org/members/orgs/{org_id}/departments'),
          ],
        },
        {
          group: 'org/im',
          items: [
            op('list-conversations', 'get', '/v1/api/org/im/{org_id}/conversations'),
            op('messages', 'get', '/v1/api/org/im/{org_id}/conversations/{conversation_id}/messages'),
          ],
        },
        {
          group: 'admin/identity',
          items: [
            op('nodes', 'get', '/v1/api/admin/identity/cloud/nodes'),
            op('skills', 'get', '/v1/api/admin/identity/cloud/skills'),
            op('session', 'post', '/v1/api/admin/identity/sessions/login'),
            op('session-out', 'post', '/v1/api/admin/identity/sessions/logout'),
          ],
        },
      ],
      'zh',
    );
    const service = menu.find((node) => node.label === '模型服务');
    expect(service?.children.map((node) => node.label)).toEqual(['供应商', '模型']);
    expect(service?.children[0].children.map((node) => node.id)).toEqual([
      'get-suppliers',
      'probe',
    ]);
    expect(catalogAncestorIds(menu, 'get-suppliers')).toEqual([
      'admin/model-service',
      'admin/model-service/suppliers',
    ]);

    const members = menu.find((node) => node.label === '成员');
    expect(members?.children.map((node) => node.label)).toEqual(['登录', '组织', '部门']);

    const im = menu.find((node) => node.label === '消息');
    expect(im?.children.every((node) => node.operation)).toBe(true);

    const identity = menu.find((node) => node.label === '身份');
    expect(identity?.children.map((node) => node.label)).toEqual(['节点', '技能', '登录', '退出登录']);
  });

  test('opens 后台 on a single /v1/api/admin prefix', () => {
    const doubled = op('doubled', 'get', '/v1/api/admin/v1/api/admin/im/{org_id}/service-identities');
    const suppliers = op('get-suppliers', 'get', '/v1/api/admin/model-service/suppliers');
    expect(preferCatalogOp([doubled, suppliers], 'back')?.id).toBe('get-suppliers');
    expect(preferCatalogOp([op('models', 'get', '/v1/api/org/models')], 'front')?.id).toBe('models');
  });
});
