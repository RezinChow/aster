const USER_TOKEN_KEY = 'a3s_user_token';
const USER_ORG_KEY = 'a3s_user_org';
const CLOUD_PERSON_KEY = 'a3s_cloud_person';

export type CloudPersonCredential = {
  accessToken: string;
  organizationId: string;
  principalId: string;
  subject: string;
};

/** Console user session. Anything else in this slot is a stale credential. */
const USER_TOKEN_PREFIX = 'a3s_us_';

export function getUserToken(): string | null {
  const token = localStorage.getItem(USER_TOKEN_KEY);
  if (!token) return null;
  if (!token.startsWith(USER_TOKEN_PREFIX)) {
    localStorage.removeItem(USER_TOKEN_KEY);
    return null;
  }
  return token;
}

export function setUserSession(token: string | null, orgId?: string | null) {
  if (
    !token ||
    token !== localStorage.getItem(USER_TOKEN_KEY) ||
    (orgId !== undefined && orgId !== localStorage.getItem(USER_ORG_KEY))
  ) {
    setCloudPersonCredential(null);
  }
  if (token) localStorage.setItem(USER_TOKEN_KEY, token);
  else localStorage.removeItem(USER_TOKEN_KEY);
  if (orgId) localStorage.setItem(USER_ORG_KEY, orgId);
  if (orgId === null) localStorage.removeItem(USER_ORG_KEY);
}

export function getStoredOrgId(): string | null {
  return localStorage.getItem(USER_ORG_KEY);
}

export function getCloudPersonCredential(): CloudPersonCredential | null {
  const raw = localStorage.getItem(CLOUD_PERSON_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isCloudPersonCredential(parsed)) {
      localStorage.removeItem(CLOUD_PERSON_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(CLOUD_PERSON_KEY);
    return null;
  }
}

export function setCloudPersonCredential(value: CloudPersonCredential | null) {
  if (value) localStorage.setItem(CLOUD_PERSON_KEY, JSON.stringify(value));
  else localStorage.removeItem(CLOUD_PERSON_KEY);
}

function isCloudPersonCredential(value: unknown): value is CloudPersonCredential {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.accessToken === 'string' &&
    /^a3s_[0-9a-f]{64}$/.test(row.accessToken) &&
    typeof row.organizationId === 'string' &&
    row.organizationId.length > 0 &&
    typeof row.principalId === 'string' &&
    row.principalId.length > 0 &&
    typeof row.subject === 'string' &&
    row.subject.length > 0
  );
}

export function clearUserSession() {
  setUserSession(null, null);
  setCloudPersonCredential(null);
}
