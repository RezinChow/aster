import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getStoredOrgId,
  listOrgs,
  meUser,
  setUserSession,
  getUserToken,
  type Org,
} from '@/lib/identityApi';
import {
  createCloudEnvironment,
  createCloudProject,
  ensureCloudDefaultWorkspace,
  ensureCloudOrganizationWorkspace,
  listCloudEnvironments,
  listCloudProjects,
  markCloudScopeConfigured,
  type CloudEnvironment,
  type CloudProject,
} from '@/lib/cloudApi';
import { translate } from '@/i18n/messages';
import { usePrefs } from '@/prefs/store';
import {
  listChannelPartners,
  subscribeChannelPartners,
  type ChannelPartner,
} from '@/data/channelPartners';
import type { ScopeOption } from '@/shell/ScopeSwitcher';

const PROJECT_KEY = 'kense.os.cloudProjectId';
const ENV_KEY = 'kense.os.cloudEnvId';
const PRINCIPAL_KEY = 'kense.os.cloudPrincipalId';
const CLOUD_ORG_KEY = 'kense.os.cloudOrganizationId';
const CHANNEL_KEY = 'kense.os.channelOrganizationId';
const HOME_ORG_KEY = 'kense.os.homeOrgId';

export type CloudScopeState = {
  orgId: string;
  orgLabel: string;
  orgOptions: ScopeOption[];
  /** Home Org is the official platform operator — may switch view across Orgs. */
  canSwitchOrgs: boolean;
  homeOrgId: string;
  projectId: string;
  projectOptions: ScopeOption[];
  projectLabel: string;
  envId: string;
  envOptions: ScopeOption[];
  envLabel: string;
  cloudReady: boolean;
  cloudError: string | null;
  cloudPrincipalId: string | null;
  cloudOrganizationId: string | null;
  setOrgId: (orgId: string) => void;
  setProjectId: (projectId: string) => void;
  setEnvId: (envId: string) => void;
  createProject: (name: string) => Promise<CloudProject>;
  createEnvironment: (name: string) => Promise<CloudEnvironment>;
  /** Reload Identity Org list (e.g. after OEM channel creates a new Org). */
  reloadOrgs: () => Promise<void>;
  /** Re-fetch Cloud projects/envs for the current Org. */
  reloadCloudScope: () => void;
};

function readStored(key: string): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) ?? '';
}

function writeStored(key: string, value: string) {
  if (typeof window === 'undefined') return;
  if (value) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
}

function orgScopedKey(base: string, orgId: string): string {
  return orgId ? `${base}.${orgId}` : base;
}

function toOrgOptions(orgs: Org[]): ScopeOption[] {
  return orgs.map((org) => ({ value: org.id, label: org.name }));
}

function toProjectOptions(projects: CloudProject[]): ScopeOption[] {
  return projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));
}

function toEnvOptions(envs: CloudEnvironment[]): ScopeOption[] {
  return envs.map((env) => ({ value: env.id, label: env.name }));
}

function pickDefault<T extends { id: string; name: string }>(
  items: T[],
  preferredId?: string,
): T | undefined {
  if (preferredId) {
    const preferred = items.find((item) => item.id === preferredId);
    if (preferred) return preferred;
  }
  const byName = items.find((item) =>
    /^(default|production|prod|main|dev)$/i.test(item.name.trim()),
  );
  return byName ?? items[0];
}

/**
 * Shell scope: identity Org stays on the signed-in tenant.
 * Official operators pick a saved channel partner in the shell.
 * Project and environment stay on the signed-in Cloud organization.
 */
export function useCloudScope(sessionReady: boolean): CloudScopeState {
  const { locale } = usePrefs();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgIdState] = useState('');
  const [partners, setPartners] = useState<ChannelPartner[]>([]);
  const [channelId, setChannelIdState] = useState('');
  const [homeOrgId, setHomeOrgId] = useState(() => readStored(HOME_ORG_KEY));
  const [canSwitchOrgs, setCanSwitchOrgs] = useState(false);
  const boundCloudOrgRef = useRef<string | null>(readStored(CLOUD_ORG_KEY) || null);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [projectId, setProjectIdState] = useState('');
  const [envs, setEnvs] = useState<CloudEnvironment[]>([]);
  const [envId, setEnvIdState] = useState('');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudReloadKey, setCloudReloadKey] = useState(0);
  const [cloudPrincipalId, setCloudPrincipalId] = useState<string | null>(
    () => readStored(PRINCIPAL_KEY) || null,
  );
  const [cloudOrganizationId, setCloudOrganizationId] = useState<string | null>(
    () => readStored(CLOUD_ORG_KEY) || null,
  );

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;

    Promise.all([listOrgs(), meUser()])
      .then(([items, me]) => {
        if (cancelled) return;
        applyOrgsAndMe(items, me);
      })
      .catch(() => {
        if (cancelled) return;
        setOrgs([]);
        setCanSwitchOrgs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionReady]);

  function applyOrgsAndMe(
    items: Org[],
    me: Awaited<ReturnType<typeof meUser>>,
  ) {
    setOrgs(items);

    const homeId = me.user.org_id || me.org_id || '';
    const official =
      Boolean(me.homeOrgIsOfficial) ||
      Boolean(me.home_org_is_official) ||
      Boolean(items.find((org) => org.id === homeId)?.is_official);
    setHomeOrgId(homeId);
    setCanSwitchOrgs(official);
    writeStored(HOME_ORG_KEY, homeId);

    const principal = me.cloudSubjectLink?.principalId ?? null;
    const cloudOrg = me.cloudOrganizationId ?? null;
    setCloudPrincipalId(principal);
    writeStored(PRINCIPAL_KEY, principal ?? '');
    setCloudOrganizationId(cloudOrg);
    writeStored(CLOUD_ORG_KEY, cloudOrg ?? '');

    const stored = getStoredOrgId();
    const next = official
      ? homeId || items[0]?.id || ''
      : homeId || stored || items[0]?.id || '';
    const token = getUserToken();
    boundCloudOrgRef.current = cloudOrg;
    setOrgIdState((current) => {
      if (official) {
        if (token && next) setUserSession(token, next);
        return next;
      }
      if (current && items.some((org) => org.id === current)) {
        if (token) setUserSession(token, current);
        return current;
      }
      if (token && next) setUserSession(token, next);
      return next;
    });
  }

  async function reloadOrgs() {
    if (!sessionReady) return;
    try {
      const [items, me] = await Promise.all([listOrgs(), meUser()]);
      applyOrgsAndMe(items, me);
    } catch {
      /* keep current */
    }
  }

  useEffect(() => {
    if (!sessionReady || !canSwitchOrgs) {
      setPartners([]);
      if (!canSwitchOrgs) setChannelIdState('');
      return;
    }
    const sync = () => {
      const items = listChannelPartners();
      setPartners(items);
      setChannelIdState((current) => {
        const stored = readStored(CHANNEL_KEY);
        const picked =
          (current && items.some((item) => item.id === current) && current) ||
          (stored && items.some((item) => item.id === stored) && stored) ||
          '';
        if (picked !== stored) writeStored(CHANNEL_KEY, picked);
        return picked;
      });
    };
    sync();
    return subscribeChannelPartners(sync);
  }, [sessionReady, canSwitchOrgs]);

  const workspaceScopeId = canSwitchOrgs ? (cloudOrganizationId ?? '') : orgId;

  useEffect(() => {
    if (!sessionReady || !workspaceScopeId) {
      setProjects([]);
      setProjectIdState('');
      setEnvs([]);
      setEnvIdState('');
      setCloudReady(false);
      return;
    }

    let cancelled = false;
    setCloudError(null);
    setCloudReady(false);
    setProjects([]);
    setEnvs([]);
    setProjectIdState('');
    setEnvIdState('');

    const preferredProjectId = readStored(orgScopedKey(PROJECT_KEY, workspaceScopeId));

    void (async () => {
      try {
        if (canSwitchOrgs) {
          await ensureCloudOrganizationWorkspace(workspaceScopeId);
        } else {
          await ensureCloudDefaultWorkspace();
        }
        if (cancelled) return;
        const items = await listCloudProjects(
          canSwitchOrgs ? workspaceScopeId : undefined,
        );
        if (cancelled) return;
        setCloudReady(true);
        markCloudScopeConfigured(true);
        setProjects(items);
        const picked = pickDefault(items, preferredProjectId);
        const next = picked?.id ?? '';
        setProjectIdState(next);
        writeStored(orgScopedKey(PROJECT_KEY, workspaceScopeId), next);
        writeStored(PROJECT_KEY, next);
        if (!next) {
          writeStored(orgScopedKey(ENV_KEY, workspaceScopeId), '');
          writeStored(ENV_KEY, '');
        }
      } catch (error: unknown) {
        if (cancelled) return;
        setCloudReady(false);
        markCloudScopeConfigured(false);
        setProjects([]);
        setProjectIdState('');
        const message =
          error instanceof Error
            ? error.message
            : translate(locale, 'shell.workspace.loadProjectsFailed');
        if (/not configured/i.test(message)) {
          setCloudError(null);
        } else {
          setCloudError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionReady, workspaceScopeId, canSwitchOrgs, cloudReloadKey, locale]);

  useEffect(() => {
    if (!sessionReady || !workspaceScopeId || !cloudReady || !projectId) {
      setEnvs([]);
      setEnvIdState('');
      return;
    }

    let cancelled = false;
    const preferredEnvId = readStored(orgScopedKey(ENV_KEY, workspaceScopeId));

    listCloudEnvironments(
      projectId,
      canSwitchOrgs ? workspaceScopeId : undefined,
    )
      .then((items) => {
        if (cancelled) return;
        setEnvs(items);
        const picked = pickDefault(items, preferredEnvId);
        const next = picked?.id ?? '';
        setEnvIdState(next);
        writeStored(orgScopedKey(ENV_KEY, workspaceScopeId), next);
        writeStored(ENV_KEY, next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setEnvs([]);
        setEnvIdState('');
        setCloudError(
          error instanceof Error
            ? error.message
            : translate(locale, 'shell.workspace.loadEnvsFailed'),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [sessionReady, workspaceScopeId, canSwitchOrgs, cloudReady, projectId, locale]);

  const channelLabel = partners.find((item) => item.id === channelId)?.name ?? '';
  const orgLabel = useMemo(
    () => (canSwitchOrgs ? channelLabel : (orgs.find((org) => org.id === orgId)?.name ?? '')),
    [canSwitchOrgs, channelLabel, orgs, orgId],
  );
  const projectLabel =
    projects.find((project) => project.id === projectId)?.name ?? '';
  const envLabel = envs.find((env) => env.id === envId)?.name ?? '';

  const channelOptions = partners.map((item) => ({
    value: item.id,
    label: item.name,
    logoUrl: item.logoUrl || undefined,
  }));
  const channelScope = canSwitchOrgs ? cloudOrganizationId ?? undefined : undefined;

  return {
    orgId: canSwitchOrgs ? channelId : orgId,
    orgLabel,
    orgOptions: canSwitchOrgs ? channelOptions : toOrgOptions(orgs.filter((org) => org.id === (homeOrgId || orgId))),
    canSwitchOrgs,
    homeOrgId,
    projectId,
    projectOptions: toProjectOptions(projects),
    projectLabel,
    envId,
    envOptions: toEnvOptions(envs),
    envLabel,
    cloudReady,
    cloudError,
    cloudPrincipalId,
    cloudOrganizationId,
    setOrgId: (next) => {
      if (!canSwitchOrgs) return;
      if (next === channelId) return;
      setChannelIdState(next);
      writeStored(CHANNEL_KEY, next);
    },
    setProjectId: (next) => {
      if (next === projectId) return;
      setProjectIdState(next);
      writeStored(orgScopedKey(PROJECT_KEY, workspaceScopeId), next);
      writeStored(PROJECT_KEY, next);
      setEnvs([]);
      setEnvIdState('');
      writeStored(orgScopedKey(ENV_KEY, workspaceScopeId), '');
      writeStored(ENV_KEY, '');
    },
    setEnvId: (next) => {
      if (next === envId) return;
      setEnvIdState(next);
      writeStored(orgScopedKey(ENV_KEY, workspaceScopeId), next);
      writeStored(ENV_KEY, next);
    },
    createProject: async (name: string) => {
      const created = await createCloudProject(name.trim(), channelScope);
      setProjects((prev) => {
        if (prev.some((item) => item.id === created.id)) return prev;
        return [...prev, created];
      });
      setProjectIdState(created.id);
      writeStored(orgScopedKey(PROJECT_KEY, workspaceScopeId), created.id);
      writeStored(PROJECT_KEY, created.id);
      try {
        const env = await createCloudEnvironment(created.id, 'production', channelScope);
        setEnvs([env]);
        setEnvIdState(env.id);
        writeStored(orgScopedKey(ENV_KEY, workspaceScopeId), env.id);
        writeStored(ENV_KEY, env.id);
      } catch {
        setEnvs([]);
        setEnvIdState('');
      }
      return created;
    },
    createEnvironment: async (name: string) => {
      if (!projectId) {
        throw new Error(translate(locale, 'shell.workspace.selectProjectFirst'));
      }
      const created = await createCloudEnvironment(projectId, name.trim(), channelScope);
      setEnvs((prev) => {
        if (prev.some((item) => item.id === created.id)) return prev;
        return [...prev, created];
      });
      setEnvIdState(created.id);
      writeStored(orgScopedKey(ENV_KEY, workspaceScopeId), created.id);
      writeStored(ENV_KEY, created.id);
      return created;
    },
    reloadOrgs,
    reloadCloudScope: () => {
      setCloudError(null);
      setCloudReloadKey((n) => n + 1);
    },
  };
}
