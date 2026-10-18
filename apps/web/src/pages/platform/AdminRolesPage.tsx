import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  DirectorySplit,
  FormDialog,
  ConsoleFormField,
  Input,
  PageLoading,
  useShowPageLoading,
  PopConfirm,
  useToast,
} from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { IconEdit, IconLock, IconPlus, IconRotateCcw, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  createAdminRole,
  deleteAdminRole,
  listAdminRoles,
  listPermissionCatalog,
  updateAdminRole,
  type AdminRole,
  type PermissionCatalogItem,
} from '@/lib/identityApi';
import { AccountPage } from '@/pages/platform/AccountPage';
import { usePageLoadKey } from '@/shell/pageLoad';
import { Tooltip } from '@/shell/Tooltip';
import { directoryErrorKey, useAdminDirectory } from './adminDirectory';

const PERMISSION_LABEL: Record<string, MessageKey> = {
  'console.login': 'directory.permission.consoleLogin',
  'identity.read': 'directory.permission.identityRead',
  'identity.manage': 'directory.permission.identityManage',
};

const PERMISSION_GROUPS = ['session', 'directory'] as const;
const READ_PERMISSION = 'identity.read';
const SENSITIVE_PERMISSION = 'identity.manage';

const GROUP_LABEL: Record<(typeof PERMISSION_GROUPS)[number], MessageKey> = {
  session: 'directory.permission.group.session',
  directory: 'directory.permission.group.directory',
};

/** 管理后台角色。权限是控制台登录和组织目录管理，不是个人中心的组织角色。 */
export function AdminRolesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const directory = useAdminDirectory();
  const orgId = directory.orgId;
  const [rows, setRows] = useState<AdminRole[] | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminRole | 'new' | null>(null);
  const pageLoad = usePageLoadKey();

  function keepSelection(list: AdminRole[], prefer?: string | null) {
    setRows(list);
    setFailed(false);
    setSelectedId((current) => {
      const want = prefer === undefined ? current : prefer;
      if (want && list.some((row) => row.id === want)) return want;
      return list[0]?.id ?? null;
    });
  }

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const keep = pageLoad.keep(orgId);
    if (!keep) {
      setRows(null);
      setFailed(false);
    }
    Promise.all([listAdminRoles(orgId), listPermissionCatalog()])
      .then(([roles, items]) => {
        if (cancelled) return;
        pageLoad.done(orgId);
        setCatalog(items);
        keepSelection(roles, keep ? undefined : null);
      })
      .catch(() => {
        if (cancelled) return;
        pageLoad.done(orgId);
        if (!keep) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, pageLoad]);

  const builtIn = (rows ?? []).filter((row) => row.is_system);
  const custom = (rows ?? []).filter((row) => !row.is_system);
  const selected = rows?.find((row) => row.id === selectedId) ?? null;

  const firstLoad = useShowPageLoading(rows === null && !failed);
  if (!orgId) return null;
  if (firstLoad) return <PageLoading variant="contain" />;

  async function reload(prefer?: string | null) {
    if (!orgId) return;
    const [roles, items] = await Promise.all([listAdminRoles(orgId), listPermissionCatalog()]);
    setCatalog(items);
    keepSelection(roles, prefer);
  }

  async function setPermissions(role: AdminRole, permissions: string[]) {
    const previous = role.permissions;
    setRows((current) => (current ?? []).map((row) => (row.id === role.id ? { ...row, permissions } : row)));
    try {
      const saved = await updateAdminRole(orgId!, role.id, { permissions });
      setRows((current) => (current ?? []).map((row) => (row.id === saved.id ? saved : row)));
    } catch (err) {
      setRows((current) => (current ?? []).map((row) => (row.id === role.id ? { ...row, permissions: previous } : row)));
      toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
      throw err;
    }
  }

  return (
    <AccountPage
      className="os-team-directory"
      title={t('org.nav.roles')}
      description={selected?.is_system ? t('directory.roles.systemLocked') : t('roles.description')}
    >
      {failed ? <AppErrorBanner message={t('org.error.generic')} /> : null}
      <DirectorySplit
        className="os-org-directory"
        treeLabel={t('org.nav.roles')}
        detailLabel={t('permissions.title')}
        tree={
          <>
            <div className="os-org-tree__heading">
              <p className="os-org-tree__label">{t('org.nav.roles')}</p>
              {directory.canManage ? (
                <Tooltip label={t('org.roles.create')} side="top">
                  <button
                    type="button"
                    className="os-org-tree__icon"
                    aria-label={t('org.roles.create')}
                    onClick={() => setDraft('new')}
                  >
                    <IconPlus width={14} height={14} strokeWidth={1.7} />
                  </button>
                </Tooltip>
              ) : null}
            </div>
            <div role="tree" aria-label={t('org.nav.roles')}>
              {builtIn.length > 0 ? (
                <>
                  <p className="os-team-section">{t('directory.roles.builtIn')}</p>
                  {builtIn.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      selected={role.id === selectedId}
                      onSelect={() => setSelectedId(role.id)}
                    />
                  ))}
                </>
              ) : null}
              {custom.length > 0 ? (
                <>
                  <p className="os-team-section">{t('org.roles.custom')}</p>
                  {custom.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      selected={role.id === selectedId}
                      onSelect={() => setSelectedId(role.id)}
                      onRename={directory.canManage ? () => setDraft(role) : undefined}
                      onDelete={
                        directory.canManage
                          ? async () => {
                              try {
                                await deleteAdminRole(orgId, role.id);
                                const rest = (rows ?? []).filter((row) => row.id !== role.id);
                                keepSelection(rest, rest[0]?.id ?? null);
                                toast.push({ tone: 'success', title: t('roles.toast.deleted') });
                              } catch (err) {
                                toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
                              }
                            }
                          : undefined
                      }
                    />
                  ))}
                </>
              ) : null}
            </div>
          </>
        }
        detail={
          <PermissionList
            role={selected}
            catalog={catalog}
            canEdit={directory.canManage && selected != null && !selected.is_system}
            onChange={(permissions) => (selected ? setPermissions(selected, permissions) : Promise.resolve())}
            onRefresh={async () => {
              try {
                await reload(selectedId);
              } catch (err) {
                toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
              }
            }}
          />
        }
      />
      <RoleDialog
        orgId={orgId}
        draft={draft}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        onSaved={async (id) => {
          await reload(id);
          toast.push({ tone: 'success', title: t(draft === 'new' ? 'roles.toast.created' : 'roles.toast.updated') });
          setDraft(null);
        }}
      />
    </AccountPage>
  );
}

function catalogGroup(item: PermissionCatalogItem) {
  if (item.group === 'session' || item.group === 'directory') return item.group;
  return item.key.startsWith('identity.') ? 'directory' : 'session';
}

function visibleGrants(stored: Iterable<string>) {
  const next = new Set(stored);
  if (next.has(SENSITIVE_PERMISSION)) next.add(READ_PERMISSION);
  return next;
}

function sameGrants(left: Iterable<string>, right: Iterable<string>) {
  const a = [...visibleGrants(left)].sort();
  const b = [...visibleGrants(right)].sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function withKey(grants: Set<string>, key: string, on: boolean) {
  const next = new Set(grants);
  if (on) {
    next.add(key);
    return [...next];
  }
  next.delete(key);
  // 管理包含查看。只删查看时，显示层会把它补回来，勾选就取消不掉。
  if (key === READ_PERMISSION) next.delete(SENSITIVE_PERMISSION);
  return [...next];
}

const REFRESH_SPIN_MS = 700;

function PermissionList({
  role,
  catalog,
  canEdit,
  onChange,
  onRefresh,
}: {
  role: AdminRole | null;
  catalog: PermissionCatalogItem[];
  canEdit: boolean;
  onChange: (permissions: string[]) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const refreshLock = useRef(false);
  const grants = visibleGrants(draft ?? role?.permissions ?? []);
  const dirty = role != null && draft != null && !sameGrants(draft, role.permissions);
  const labelFor = (key: string) => {
    const message = PERMISSION_LABEL[key];
    return message ? t(message) : key;
  };

  useEffect(() => {
    setDraft(null);
  }, [role?.id]);

  function commit(next: string[]) {
    if (!role || !canEdit) return;
    setDraft([...visibleGrants(next)]);
  }

  async function save() {
    if (!role || !canEdit || !dirty || saving || draft == null) return;
    setSaving(true);
    try {
      await onChange(draft);
      setDraft(null);
      toast.push({ tone: 'success', title: t('roles.toast.updated') });
    } catch {
      // setPermissions already surfaces the error and restores the saved grants.
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const started = Date.now();
    try {
      await onRefresh();
    } finally {
      const wait = Math.max(0, REFRESH_SPIN_MS - (Date.now() - started));
      window.setTimeout(() => {
        refreshLock.current = false;
        setRefreshing(false);
      }, wait);
    }
  }

  if (!role) {
    return <p className="os-team-empty">{t('permissions.title')}</p>;
  }

  return (
    <div className="os-org-perm">
      <div className="os-org-perm__head">
        <div className="os-org-perm__copy">
          <p className="os-org-perm__name">{role.name}</p>
          <p className="os-org-perm__meta">
            {role.is_system ? t('directory.roles.systemLocked') : t('roles.description')}
          </p>
        </div>
        <div className="os-org-perm__actions">
          {canEdit ? (
            <button
              type="button"
              className="os-org-perm__save"
              disabled={!dirty || saving}
              onClick={() => void save()}
            >
              {t('org.profile.save')}
            </button>
          ) : null}
          <button
            type="button"
            className={refreshing ? 'os-team-refresh is-refreshing' : 'os-team-refresh'}
            aria-label={t('table.refresh')}
            title={t('table.refresh')}
            aria-busy={refreshing || undefined}
            onClick={() => void refresh()}
          >
            <IconRotateCcw width={16} height={16} strokeWidth={1.7} />
          </button>
        </div>
      </div>
      <div className="os-org-perm__list" aria-label={t('org.roles.permissions')}>
        {PERMISSION_GROUPS.map((group) => {
          const items = catalog.filter((item) => catalogGroup(item) === group);
          const heldCount = items.filter((item) => grants.has(item.key)).length;
          const groupLabel = t(GROUP_LABEL[group]);
          return (
            <section key={group} className="os-org-perm__section">
              <div className="os-org-perm__group">
                <span className="os-org-perm__group-name">{groupLabel}</span>
                <span className="os-org-perm__count">
                  {heldCount}/{items.length}
                </span>
              </div>
              <div className="os-org-perm__grid" role="group" aria-label={groupLabel}>
                {items.map((item) => (
                  <PermissionRow
                    key={item.key}
                    label={labelFor(item.key)}
                    on={grants.has(item.key)}
                    canEdit={canEdit}
                    sensitive={item.key === SENSITIVE_PERMISSION}
                    onToggle={(checked) => void commit(withKey(grants, item.key, checked))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PermissionRow({
  label,
  on,
  canEdit,
  sensitive,
  onToggle,
}: {
  label: string;
  on: boolean;
  canEdit: boolean;
  sensitive: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  const row = (
    <button
      type="button"
      className="os-org-perm__item"
      data-locked={canEdit ? undefined : 'true'}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      disabled={!canEdit}
      onClick={() => {
        if (sensitive && !on) return;
        onToggle(!on);
      }}
    >
      <span className="os-org-perm__mark" data-on={on ? 'true' : undefined} aria-hidden="true">
        {on ? (
          <svg viewBox="0 0 16 16" width="16" height="16">
            <path
              d="M3.2 8.3 6.3 11.4 12.8 4.7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span>{label}</span>
    </button>
  );
  if (canEdit && sensitive && !on) {
    return (
      <PopConfirm
        className="os-org-perm__confirm"
        title={t('org.perm.grantOne').replace('{name}', label)}
        confirmLabel={t('org.perm.grant')}
        cancelLabel={t('org.profile.cancel')}
        onConfirm={() => onToggle(true)}
      >
        {row}
      </PopConfirm>
    );
  }
  return row;
}

function RoleRow({
  role,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  role: AdminRole;
  selected: boolean;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div role="treeitem" aria-selected={selected} className={selected ? 'os-team-node is-selected' : 'os-team-node'}>
      {role.is_system ? <IconLock width={14} height={14} strokeWidth={1.7} /> : null}
      <button type="button" className="os-team-node__label" onClick={onSelect}>
        {role.name}
      </button>
      {onRename || onDelete ? (
        <span className="os-team-node__actions">
          {onRename ? (
            <Tooltip label={t('org.info.edit')} side="top">
              <button
                type="button"
                className="os-org-tree__icon"
                aria-label={`${t('org.info.edit')} ${role.name}`}
                onClick={onRename}
              >
                <IconEdit width={14} height={14} strokeWidth={1.7} />
              </button>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <PopConfirm
              title={t('roles.deleteAsk').replace('{name}', role.name)}
              description={t('roles.deleteConfirm')}
              confirmLabel={t('roles.delete')}
              cancelLabel={t('org.profile.cancel')}
              onConfirm={onDelete}
            >
              <Tooltip label={t('roles.delete')} side="top">
                <button type="button" className="os-org-tree__icon" aria-label={`${t('roles.delete')} ${role.name}`}>
                  <IconTrash width={14} height={14} strokeWidth={1.7} />
                </button>
              </Tooltip>
            </PopConfirm>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function RoleDialog({
  orgId,
  draft,
  onOpenChange,
  onSaved,
}: {
  orgId: string;
  draft: AdminRole | 'new' | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = draft === 'new';

  useEffect(() => {
    if (!draft) return;
    setCode(draft === 'new' ? '' : draft.code);
    setName(draft === 'new' ? '' : draft.name);
    setError(null);
    setBusy(false);
  }, [draft]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName) {
      setError('org.roles.nameInvalid');
      return;
    }
    if (creating && !trimmedCode) {
      setError('directory.roles.codeInvalid');
      return;
    }
    setBusy(true);
    try {
      const saved = creating
        ? await createAdminRole(orgId, { code: trimmedCode, name: trimmedName, permissions: [] })
        : draft
          ? await updateAdminRole(orgId, draft.id, { name: trimmedName })
          : null;
      if (saved) await onSaved(saved.id);
    } catch (err) {
      const key = directoryErrorKey(err);
      if (key === 'org.error.generic') {
        toast.push({ tone: 'danger', title: t(key) });
        setError(null);
      } else {
        setError(key);
      }
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open={draft !== null}
      onOpenChange={onOpenChange}
      size="sm"
      title={t(creating ? 'org.roles.create' : 'org.info.edit')}
      closeLabel={t('dialog.close')}
      cancelLabel={t('org.profile.cancel')}
      submitLabel={t('org.profile.save')}
      submitting={busy}
      submitDisabled={!name.trim() || (creating && !code.trim())}
      onSubmit={(event) => void onSubmit(event)}
    >
      {creating ? (
        <ConsoleFormField
          label={t('roles.field.code')}
          required
          error={error && error !== 'org.roles.nameInvalid' ? t(error) : undefined}
        >
          <Input
            value={code}
            autoFocus
            disabled={busy}
            placeholder={t('roles.field.codePlaceholder')}
            aria-label={t('roles.field.code')}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
          />
        </ConsoleFormField>
      ) : null}
      <ConsoleFormField
        label={t('roles.field.name')}
        required
        error={error === 'org.roles.nameInvalid' || (!creating && error) ? t(error!) : undefined}
      >
        <Input
          value={name}
          autoFocus={!creating}
          disabled={busy}
          placeholder={t('roles.field.namePlaceholder')}
          aria-label={t('roles.field.name')}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
      </ConsoleFormField>
    </FormDialog>
  );
}
