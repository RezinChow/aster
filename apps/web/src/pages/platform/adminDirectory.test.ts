import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  departmentOptionList,
  directoryErrorKey,
  directoryGrants,
  directoryOrgId,
  mergeDirectoryPeople,
  subtreeIds,
  IDENTITY_MANAGE,
  IDENTITY_READ,
} from './adminDirectory';
import type { AdminRole, DirectoryMember, User } from '@/lib/identityApi';

const role = (code: string, name: string): AdminRole => ({
  id: code,
  org_id: 'org',
  code,
  name,
  permissions: ['console.login'],
  is_system: code === 'super_admin',
});

function user(id: string, departmentId: string, roles: AdminRole[] = []): User {
  return {
    id,
    org_id: 'org',
    email: `${id}@kense.local`,
    display_name: id,
    primary_department_id: departmentId,
    status: 'active',
    admin_roles: roles,
  };
}

function member(id: string, departmentId: string, positionId: string | null): DirectoryMember {
  return {
    id,
    email: `${id}@kense.local`,
    display_name: id,
    phone: '13800000000',
    department_id: departmentId,
    status: 'active',
    position_id: positionId,
    position_name: positionId ? '经理' : null,
  };
}

describe('admin directory', () => {
  test('official operators can reopen a stored identity org', () => {
    expect(directoryOrgId('home', true, [{ id: 'home' }, { id: 'other' }], 'other')).toBe('other');
    expect(directoryOrgId('home', false, [{ id: 'home' }, { id: 'other' }], 'other')).toBe('home');
    expect(directoryOrgId('home', true, [{ id: 'home' }], 'missing')).toBe('home');
    expect(directoryOrgId('home', false, [], 'other')).toBe('home');
  });

  test('department subtree includes the selected node and descendants only', () => {
    const rows = [
      { id: 'root', parent_id: null },
      { id: 'a', parent_id: 'root' },
      { id: 'b', parent_id: 'root' },
      { id: 'a1', parent_id: 'a' },
    ];
    expect([...subtreeIds(rows, 'a')].sort()).toEqual(['a', 'a1']);
    expect(subtreeIds(rows, 'b')).toEqual(new Set(['b']));
  });

  test('people keep console roles and pick up phone and position', () => {
    const admin = role('super_admin', '超级管理员');
    const [person] = mergeDirectoryPeople(
      [user('u1', 'dept-user', [admin])],
      [member('u1', 'dept-member', 'pos-1')],
    );
    expect(person?.department_id).toBe('dept-user');
    expect(person?.phone).toBe('13800000000');
    expect(person?.position_id).toBe('pos-1');
    expect(person?.position_name).toBe('经理');
    expect(person?.admin_roles.map((item) => item.code)).toEqual(['super_admin']);
  });

  test('department options show the ancestor path', () => {
    expect(
      departmentOptionList([
        { id: 'root', org_id: 'org', parent_id: null, name: '全员', sort_order: 0 },
        { id: 'eng', org_id: 'org', parent_id: 'root', name: '研发', sort_order: 1 },
      ]),
    ).toEqual([
      { value: 'root', label: '全员' },
      { value: 'eng', label: '全员 / 研发' },
    ]);
  });

  test('api failures map onto console directory copy', () => {
    expect(directoryErrorKey(new Error('position still has members; reassign them first'))).toBe(
      'org.positions.hasMembers',
    );
    expect(directoryErrorKey(new Error('system admin roles cannot be deleted'))).toBe(
      'directory.roles.systemLocked',
    );
    expect(directoryErrorKey(new Error('email already exists in org'))).toBe('org.error.emailExists');
    expect(directoryErrorKey(new Error('admin role code is reserved'))).toBe('directory.roles.reserved');
    expect(directoryErrorKey(new Error('unknown admin permission'))).toBe('directory.roles.unknownPermission');
    expect(directoryErrorKey(new Error('system admin role permissions are fixed'))).toBe(
      'directory.roles.permissionsFixed',
    );
    expect(directoryErrorKey(new Error('at least one active identity manager is required'))).toBe(
      'directory.roles.lastAdmin',
    );
    expect(directoryErrorKey(new Error('missing admin permission'))).toBe('directory.error.forbidden');
  });

  test('directory manage implies read and does not make an auditor an admin', () => {
    const admin = [{ permissions: ['console.login', IDENTITY_MANAGE] }];
    const auditor = [{ permissions: ['console.login', IDENTITY_READ] }];
    const reader = [{ permissions: [IDENTITY_READ] }];
    expect(directoryGrants(admin, IDENTITY_READ)).toBe(true);
    expect(directoryGrants(admin, IDENTITY_MANAGE)).toBe(true);
    expect(directoryGrants(auditor, IDENTITY_READ)).toBe(true);
    expect(directoryGrants(auditor, IDENTITY_MANAGE)).toBe(false);
    expect(directoryGrants(reader, IDENTITY_MANAGE)).toBe(false);
  });

  test('admin member, position, and role pages do not use the personal center', () => {
    const files = [
      'AdminMembersPage.tsx',
      'AdminPositionsPage.tsx',
      'AdminRolesPage.tsx',
      'AdminDirectoryTable.tsx',
      'PlatformOrgDirectory.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source.includes('useOrgCenter')).toBe(false);
      expect(source.includes("from '@/lib/orgApi'")).toBe(false);
      expect(source.includes('/v1/api/org')).toBe(false);
    }
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('element={<AdminMembersPage />}');
    expect(app).toContain('element={<AdminPositionsPage />}');
    expect(app).toContain('element={<AdminRolesPage />}');
    const sidebar = readFileSync(new URL('../../shell/Sidebar.tsx', import.meta.url), 'utf8');
    expect(sidebar.includes('OrgCenterSwitcher')).toBe(false);
    expect(sidebar.includes('AdminDirectorySwitcher')).toBe(false);
  });
});
