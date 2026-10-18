import { apiRequest as request } from '@/lib/apiClient';
import {
  getStoredOrgId,
  getUserToken,
  setUserSession,
} from '@/lib/userSession';

export { getStoredOrgId, getUserToken, setUserSession };

export type Org = {
  id: string;
  name: string;
  status: string;
  root_department_id: string | null;
  cloud_organization_id?: string | null;
  /** Platform operator tenant — only this home Org may switch Shell view across Orgs. */
  is_official?: boolean;
};

export type Department = {
  id: string;
  org_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
};

export type AdminRole = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  permissions: string[];
  is_system: boolean;
};

export type User = {
  id: string;
  org_id: string;
  email: string;
  display_name: string;
  primary_department_id: string;
  status: string;
  admin_roles: AdminRole[];
};

export type UserAuth = {
  token: string;
  user: User;
};

export type CloudSubjectLink = {
  linkId: string;
  providerKey: string;
  issuer: string;
  subject: string;
  principalId: string;
  aggregateVersion: number;
};

export type MeUser = {
  user: User;
  org_id: string;
  roles: AdminRole[];
  homeOrgIsOfficial?: boolean;
  home_org_is_official?: boolean;
  cloudSubjectLink?: CloudSubjectLink | null;
  cloudOrganizationId?: string | null;
};

export type PermissionCatalogItem = {
  key: string;
  group: string;
  description: string;
};

/** Restore org id from the current session when a token exists but the org is missing. */
export async function ensureUserSession(): Promise<string | null> {
  const token = getUserToken();
  if (!token) return null;
  const existing = getStoredOrgId();
  if (existing) return existing;
  try {
    const me = await meUser();
    setUserSession(token, me.org_id);
    return me.org_id;
  } catch {
    setUserSession(null, null);
    return null;
  }
}

function normalizeUser(raw: User): User {
  return {
    ...raw,
    admin_roles: Array.isArray(raw.admin_roles) ? raw.admin_roles : [],
  };
}

export function listOrgs() {
  return request<Org[]>('/identity/orgs').then((items) =>
    items.map((org) => {
      const raw = org as Org & { isOfficial?: boolean };
      return {
        ...org,
        is_official: Boolean(raw.is_official ?? raw.isOfficial),
      };
    }),
  );
}

export function createOrg(input: { name: string }) {
  return request<Org>('/identity/orgs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOrg(
  orgId: string,
  input: { name?: string; status?: string },
) {
  return request<Org>(`/identity/orgs/${orgId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function loginUser(input: {
  org_id: string;
  email: string;
  password: string;
}) {
  return request<UserAuth>('/identity/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: false,
  }).then((auth) => ({
    ...auth,
    user: normalizeUser(auth.user),
  }));
}

export function meUser() {
  return request<MeUser>('/identity/session').then((me) => {
    const raw = me as MeUser & {
      cloud_subject_link?: CloudSubjectLink | null;
      cloud_organization_id?: string | null;
    };
    const link = raw.cloudSubjectLink ?? raw.cloud_subject_link ?? null;
    return {
      ...me,
      user: normalizeUser(me.user),
      roles: Array.isArray(me.roles) ? me.roles : [],
      cloudSubjectLink: link
        ? {
            linkId: String(
              (link as { linkId?: string; link_id?: string }).linkId ??
                (link as { link_id?: string }).link_id ??
                '',
            ),
            providerKey: String(
              (link as { providerKey?: string; provider_key?: string })
                .providerKey ??
                (link as { provider_key?: string }).provider_key ??
                '',
            ),
            issuer: String(link.issuer ?? ''),
            subject: String(link.subject ?? ''),
            principalId: String(
              (link as { principalId?: string; principal_id?: string })
                .principalId ??
                (link as { principal_id?: string }).principal_id ??
                '',
            ),
            aggregateVersion: Number(
              (link as { aggregateVersion?: number; aggregate_version?: number })
                .aggregateVersion ??
                (link as { aggregate_version?: number }).aggregate_version ??
                0,
            ),
          }
        : null,
      cloudOrganizationId:
        raw.cloudOrganizationId ?? raw.cloud_organization_id ?? null,
      homeOrgIsOfficial: Boolean(
        raw.homeOrgIsOfficial ?? raw.home_org_is_official,
      ),
    };
  });
}

export function logoutUser() {
  return request<{ ok: boolean }>('/identity/session', {
    method: 'DELETE',
  });
}

export function listDepartments(orgId: string) {
  return request<Department[]>(`/identity/orgs/${orgId}/departments`);
}

export function createDepartment(
  orgId: string,
  input: { name: string; parent_id: string },
) {
  return request<Department>(`/identity/orgs/${orgId}/departments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDepartment(
  orgId: string,
  departmentId: string,
  input: { name?: string; sort_order?: number },
) {
  return request<Department>(
    `/identity/orgs/${orgId}/departments/${departmentId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function deleteDepartment(orgId: string, departmentId: string) {
  return request<{ ok: boolean }>(
    `/identity/orgs/${orgId}/departments/${departmentId}`,
    { method: 'DELETE' },
  );
}

export function listUsers(orgId: string, departmentId?: string) {
  const query = departmentId
    ? `?department_id=${encodeURIComponent(departmentId)}`
    : '';
  return request<User[]>(`/identity/orgs/${orgId}/users${query}`).then((users) =>
    users.map(normalizeUser),
  );
}

export function createUser(
  orgId: string,
  input: {
    email: string;
    display_name?: string;
    password?: string;
    primary_department_id: string;
    admin_role_code?: string;
  },
) {
  return request<User>(`/identity/orgs/${orgId}/users`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(normalizeUser);
}

export function updateUser(
  orgId: string,
  userId: string,
  input: {
    display_name?: string;
    primary_department_id?: string;
    status?: string;
    admin_role_codes?: string[];
  },
) {
  return request<User>(`/identity/orgs/${orgId}/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then(normalizeUser);
}

export function listAdminRoles(orgId: string) {
  return request<AdminRole[]>(`/identity/orgs/${orgId}/admin-roles`);
}

export function createAdminRole(
  orgId: string,
  input: { code: string; name: string; permissions: string[] },
) {
  return request<AdminRole>(`/identity/orgs/${orgId}/admin-roles`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminRole(
  orgId: string,
  roleId: string,
  input: { name?: string; permissions?: string[] },
) {
  return request<AdminRole>(`/identity/orgs/${orgId}/admin-roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteAdminRole(orgId: string, roleId: string) {
  return request<{ ok: boolean }>(
    `/identity/orgs/${orgId}/admin-roles/${roleId}`,
    { method: 'DELETE' },
  );
}

export function listPermissionCatalog() {
  return request<PermissionCatalogItem[]>('/identity/permission-catalog');
}

export type Position = {
  id: string;
  name: string;
  sort_order: number;
};

export type DirectoryMember = {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  department_id: string;
  status: string;
  position_id: string | null;
  position_name: string | null;
};

export function listPositions(orgId: string) {
  return request<Position[]>(`/identity/orgs/${orgId}/positions`);
}

export function createPosition(orgId: string, name: string) {
  return request<Position>(`/identity/orgs/${orgId}/positions`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renamePosition(orgId: string, positionId: string, name: string) {
  return request<Position>(`/identity/orgs/${orgId}/positions/${positionId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deletePosition(orgId: string, positionId: string) {
  return request<{ ok: boolean }>(`/identity/orgs/${orgId}/positions/${positionId}`, {
    method: 'DELETE',
  });
}

export function setUserPosition(orgId: string, userId: string, positionId: string | null) {
  return request<{ ok: boolean }>(`/identity/orgs/${orgId}/users/${userId}/position`, {
    method: 'PUT',
    body: JSON.stringify({ position_id: positionId }),
  });
}

export function listDirectoryMembers(orgId: string) {
  return request<DirectoryMember[]>(`/identity/orgs/${orgId}/directory-members`);
}

export type CustomerKind = 'individual' | 'organization';

export type Customer = {
  id: string;
  kind: CustomerKind;
  name: string;
  phone: string | null;
  status: string;
  plan: string;
  subscription_status: string;
  seats_used: number;
  seats_total: number;
  owner_name: string;
  owner_phone: string | null;
  logo: string;
  industry: string;
  created_at: string;
};

export type CustomerPerson = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  status: string;
};

export function listCustomers() {
  return request<Customer[]>('/identity/customers');
}

export function listCustomerPeople(customerId: string) {
  return request<CustomerPerson[]>(
    `/identity/customers/${encodeURIComponent(customerId)}/people`,
  );
}
