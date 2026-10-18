import { useEffect, useSyncExternalStore } from 'react';
import type { MessageKey } from '@/i18n/messages';
import {
  listAdminRoles,
  listDepartments,
  listDirectoryMembers,
  listOrgs,
  listPositions,
  listUsers,
  meUser,
  type AdminRole,
  type Department,
  type DirectoryMember,
  type MeUser,
  type Org,
  type Position,
  type User,
} from '@/lib/identityApi';
import { getUserToken } from '@/lib/userSession';

export const IDENTITY_MANAGE = 'identity.manage';
export const IDENTITY_READ = 'identity.read';

/** 目录页弹窗里可搜索下拉共用的防抖，与 studio 组织页的下拉契约一致。 */
export const DIRECTORY_SELECT_DEBOUNCE_MS = 200;

export function directoryGrants(
  roles: { permissions: readonly string[] }[] | null | undefined,
  required: string,
) {
  return (roles ?? []).some((role) =>
    role.permissions.some(
      (key) => key === required || (key === IDENTITY_MANAGE && required === IDENTITY_READ),
    ),
  );
}

const STORAGE_KEY = 'kense.admin.directory.org';

export type DirectoryPerson = {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  department_id: string;
  status: string;
  position_id: string | null;
  position_name: string | null;
  admin_roles: AdminRole[];
};

type Snapshot = {
  status: 'loading' | 'ready' | 'error';
  error: 'auth' | 'load' | null;
  me: MeUser | null;
  orgs: Org[];
  orgId: string | null;
};

let snapshot: Snapshot = {
  status: 'loading',
  error: null,
  me: null,
  orgs: [],
  orgId: null,
};
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let loadedFor: string | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function setSnapshot(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function readStoredOrg(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrg(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}

/** 官方租户可以改看其他组织的通讯录；普通管理员只看自己的登录组织。 */
export function directoryOrgId(
  homeOrgId: string,
  official: boolean,
  orgs: readonly { id: string }[],
  stored: string | null,
): string {
  if (official && stored && orgs.some((org) => org.id === stored)) return stored;
  if (orgs.some((org) => org.id === homeOrgId)) return homeOrgId;
  return orgs[0]?.id ?? homeOrgId;
}

export function subtreeIds(rows: readonly { id: string; parent_id: string | null }[], selectedId: string) {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = children.get(row.parent_id) ?? [];
    list.push(row.id);
    children.set(row.parent_id, list);
  }
  const ids = new Set<string>();
  const walk = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const child of children.get(id) ?? []) walk(child);
  };
  walk(selectedId);
  return ids;
}

export function rootDepartmentId(rows: readonly { id: string; parent_id: string | null }[]) {
  return rows.find((row) => row.parent_id === null)?.id ?? rows[0]?.id ?? null;
}

export function departmentOptionList(rows: readonly Department[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const label = (id: string) => {
    const names: string[] = [];
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return names.join(' / ');
  };
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh'))
    .map((row) => ({ value: row.id, label: label(row.id) }));
}

/** 用户带管理员角色，通讯录行带手机号和职位。部门以用户主部门为准。 */
export function mergeDirectoryPeople(users: readonly User[], members: readonly DirectoryMember[]): DirectoryPerson[] {
  const extra = new Map(members.map((row) => [row.id, row]));
  return users.map((user) => {
    const member = extra.get(user.id);
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      phone: member?.phone ?? null,
      department_id: user.primary_department_id,
      status: user.status,
      position_id: member?.position_id ?? null,
      position_name: member?.position_name ?? null,
      admin_roles: user.admin_roles ?? [],
    };
  });
}

export function directoryErrorKey(err: unknown): MessageKey {
  const message = err instanceof Error ? err.message : '';
  if (/root department/i.test(message)) return 'org.members.deptRoot';
  if (/child departments/i.test(message)) return 'org.members.deptHasChildren';
  if (/still has users/i.test(message)) return 'org.members.deptHasMembers';
  if (/position still has members/i.test(message)) return 'org.positions.hasMembers';
  if (/position name already exists/i.test(message)) return 'org.positions.duplicate';
  if (/position name is required/i.test(message)) return 'org.positions.nameInvalid';
  if (/admin role code already exists/i.test(message)) return 'org.roles.duplicate';
  if (/admin role code is required/i.test(message)) return 'directory.roles.codeInvalid';
  if (/admin role name is required/i.test(message)) return 'org.roles.nameInvalid';
  if (/system admin roles cannot be deleted/i.test(message)) return 'directory.roles.systemLocked';
  if (/system admin role permissions are fixed/i.test(message)) return 'directory.roles.permissionsFixed';
  if (/admin role code is reserved/i.test(message)) return 'directory.roles.reserved';
  if (/unknown admin permission/i.test(message)) return 'directory.roles.unknownPermission';
  if (/at least one active identity manager/i.test(message)) return 'directory.roles.lastAdmin';
  if (/missing admin permission/i.test(message)) return 'directory.error.forbidden';
  if (/email already exists/i.test(message)) return 'org.error.emailExists';
  if (/department name/i.test(message)) return 'org.members.deptNameInvalid';
  if (/password must be at least 8/i.test(message)) return 'org.security.newRequired';
  return 'org.error.generic';
}

function sessionRoles(me: MeUser | null) {
  if (!me) return [];
  return me.roles.length > 0 ? me.roles : me.user.admin_roles;
}

export function ensureAdminDirectory(): Promise<void> {
  const token = getUserToken();
  if (!token) {
    if (snapshot.status !== 'error' || snapshot.error !== 'auth') {
      setSnapshot({ status: 'error', error: 'auth', me: null, orgs: [], orgId: null });
    }
    loadedFor = null;
    return Promise.resolve();
  }
  if (snapshot.status === 'ready' && loadedFor === token) return Promise.resolve();
  if (inflight && loadedFor === token) return inflight;
  loadedFor = token;
  inflight = (async () => {
    try {
      const me = await meUser();
      let orgs: Org[] = [];
      try {
        orgs = await listOrgs();
      } catch {
        orgs = [];
      }
      if (getUserToken() !== token) return;
      setSnapshot({
        status: 'ready',
        error: null,
        me,
        orgs,
        orgId: directoryOrgId(me.org_id, Boolean(me.homeOrgIsOfficial), orgs, readStoredOrg()),
      });
    } catch {
      if (getUserToken() !== token) return;
      loadedFor = null;
      setSnapshot({
        status: 'error',
        error: getUserToken() ? 'load' : 'auth',
        me: null,
        orgs: [],
        orgId: null,
      });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function retryAdminDirectory() {
  loadedFor = null;
  inflight = null;
  setSnapshot({ status: 'loading', error: null, me: snapshot.me, orgs: snapshot.orgs, orgId: snapshot.orgId });
  void ensureAdminDirectory();
}

export function selectAdminDirectoryOrg(orgId: string) {
  const current = snapshot;
  if (current.status !== 'ready' || !current.me?.homeOrgIsOfficial) return;
  if (!current.orgs.some((org) => org.id === orgId)) return;
  writeStoredOrg(orgId);
  setSnapshot({ ...current, orgId });
}

export function useAdminDirectory() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void ensureAdminDirectory();
  }, []);
  const org = snap.orgs.find((item) => item.id === snap.orgId) ?? null;
  return {
    status: snap.status,
    error: snap.error,
    orgId: snap.orgId,
    orgName: org?.name ?? '',
    orgs: snap.orgs,
    canSwitch: Boolean(snap.me?.homeOrgIsOfficial) && snap.orgs.length > 1,
    canRead: directoryGrants(sessionRoles(snap.me), IDENTITY_READ),
    canManage: directoryGrants(sessionRoles(snap.me), IDENTITY_MANAGE),
    select: selectAdminDirectoryOrg,
    retry: retryAdminDirectory,
  };
}

export async function loadDirectoryBundle(orgId: string) {
  const [users, members, departments, positions, roles] = await Promise.all([
    listUsers(orgId),
    listDirectoryMembers(orgId),
    listDepartments(orgId),
    listPositions(orgId),
    listAdminRoles(orgId),
  ]);
  return {
    people: mergeDirectoryPeople(users, members),
    departments,
    positions,
    roles,
  };
}

export type DirectoryBundle = {
  people: DirectoryPerson[];
  departments: Department[];
  positions: Position[];
  roles: AdminRole[];
};
