import { useEffect, useMemo, useState } from 'react';
import {
  buildTreeNodes,
  Button,
  DirectorySplit,
  FormDialog,
  ConsoleFormField,
  Input,
  PageLoading,
  useShowPageLoading,
  PopConfirm,
  SearchSelect,
  Tree,
  useToast,
  type TreeNode,
} from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { IconEdit, IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  createDepartment,
  createUser,
  deleteDepartment,
  setUserPosition,
  updateDepartment,
  type Department,
} from '@/lib/identityApi';
import { AccountPage } from '@/pages/platform/AccountPage';
import { usePageLoadKey } from '@/shell/pageLoad';
import { Tooltip } from '@/shell/Tooltip';
import {
  departmentOptionList,
  DIRECTORY_SELECT_DEBOUNCE_MS,
  directoryErrorKey,
  loadDirectoryBundle,
  rootDepartmentId,
  subtreeIds,
  useAdminDirectory,
  type DirectoryBundle,
} from './adminDirectory';
import { AdminDirectoryTable } from './AdminDirectoryTable';

type DeptDraft = { mode: 'create'; parentId: string } | { mode: 'rename'; id: string; name: string };

/** 后台用户：当前身份组织里可登录控制台的用户，不读用户中心的团队成员。 */
export function AdminMembersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const directory = useAdminDirectory();
  const orgId = directory.orgId;
  const [data, setData] = useState<DirectoryBundle | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DeptDraft | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptError, setDeptError] = useState<MessageKey | null>(null);
  const [deptBusy, setDeptBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const pageLoad = usePageLoadKey();

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const keep = pageLoad.keep(orgId);
    if (!keep) {
      setData(null);
      setFailed(false);
      setSelectedId(null);
    }
    loadDirectoryBundle(orgId)
      .then((bundle) => {
        if (cancelled) return;
        pageLoad.done(orgId);
        setData(bundle);
        setFailed(false);
        setSelectedId((current) => {
          if (keep && current && bundle.departments.some((row) => row.id === current)) return current;
          return rootDepartmentId(bundle.departments);
        });
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

  const departments = data?.departments ?? [];
  const departmentIds = useMemo(
    () => (selectedId ? subtreeIds(departments, selectedId) : null),
    [departments, selectedId],
  );
  const visible = useMemo(
    () => (data?.people ?? []).filter((row) => !departmentIds || departmentIds.has(row.department_id)),
    [data, departmentIds],
  );
  const nodes = useMemo(
    () =>
      buildTreeNodes(departments, {
        sort: (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh'),
      }),
    [departments],
  );
  const selected = departments.find((row) => row.id === selectedId) ?? null;

  const firstLoad = useShowPageLoading(!data && !failed);
  if (!orgId) return null;
  if (firstLoad) return <PageLoading variant="contain" />;

  async function reload(prefer?: string) {
    if (!orgId) return;
    const bundle = await loadDirectoryBundle(orgId);
    setData(bundle);
    setFailed(false);
    setSelectedId((current) => {
      const next = prefer ?? current;
      if (next && bundle.departments.some((row) => row.id === next)) return next;
      return rootDepartmentId(bundle.departments);
    });
  }

  function openDraft(next: DeptDraft) {
    setDraft(next);
    setDeptName(next.mode === 'rename' ? next.name : '');
    setDeptError(null);
  }

  async function saveDepartment() {
    if (!orgId || !draft) return;
    const name = deptName.trim();
    if (!name) {
      setDeptError('org.members.deptNameInvalid');
      return;
    }
    setDeptBusy(true);
    setDeptError(null);
    try {
      const saved =
        draft.mode === 'create'
          ? await createDepartment(orgId, { parent_id: draft.parentId, name })
          : await updateDepartment(orgId, draft.id, { name });
      await reload(saved.id);
      toast.push({
        tone: 'success',
        title: t(draft.mode === 'create' ? 'org.members.deptCreated' : 'org.members.deptRenamed'),
      });
      setDraft(null);
    } catch (err) {
      setDeptError(directoryErrorKey(err));
    } finally {
      setDeptBusy(false);
    }
  }

  async function removeDepartment(id: string) {
    if (!orgId || !data) return;
    try {
      const parent = data.departments.find((row) => row.id === id)?.parent_id ?? undefined;
      await deleteDepartment(orgId, id);
      await reload(parent ?? undefined);
      toast.push({ tone: 'success', title: t('org.members.deptDeleted') });
    } catch (err) {
      toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
    }
  }

  const table = data ? (
    <AdminDirectoryTable
      orgId={orgId}
      rows={visible}
      departments={data.departments}
      positions={data.positions}
      roles={data.roles}
      canManage={directory.canManage}
      ariaLabel={t('users.title')}
      onRefresh={() => reload()}
    />
  ) : null;

  return (
    <AccountPage
      className="os-team-directory"
      title={t('users.title')}
      description={selected?.name ? `${t('users.description')} · ${selected.name}` : t('users.description')}
      actions={
        directory.canManage ? (
          <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
            <IconPlus width={16} height={16} />
            {t('users.invite')}
          </Button>
        ) : null
      }
    >
      {failed ? <AppErrorBanner message={t('org.error.generic')} /> : null}
      {departments.length > 0 ? (
        <DirectorySplit
          className="os-org-directory"
          treeLabel={t('org.members.tree')}
          detailLabel={t('users.title')}
          tree={
            <>
              <p className="os-org-tree__label">{t('org.members.tree')}</p>
              <Tree
                nodes={nodes}
                selectedId={selectedId}
                onSelect={setSelectedId}
                aria-label={t('org.members.tree')}
                renderAction={
                  directory.canManage
                    ? (node) => (
                        <DeptActions
                          node={node}
                          root={departments.some((row) => row.id === node.id && row.parent_id === null)}
                          onAdd={() => openDraft({ mode: 'create', parentId: node.id })}
                          onRename={() => openDraft({ mode: 'rename', id: node.id, name: node.label })}
                          onDelete={() => removeDepartment(node.id)}
                        />
                      )
                    : undefined
                }
              />
            </>
          }
          detail={table}
        />
      ) : (
        table
      )}
      <FormDialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        size="sm"
        title={t(draft?.mode === 'rename' ? 'org.members.deptRenameTitle' : 'org.members.deptCreateTitle')}
        closeLabel={t('dialog.close')}
        cancelLabel={t('org.profile.cancel')}
        submitLabel={t('org.profile.save')}
        submitting={deptBusy}
        submitDisabled={!deptName.trim()}
        onSubmit={(event) => {
          event.preventDefault();
          void saveDepartment();
        }}
      >
        <ConsoleFormField label={t('org.members.deptName')} required error={deptError ? t(deptError) : undefined}>
          <Input
            value={deptName}
            autoFocus
            disabled={deptBusy}
            aria-label={t('org.members.deptName')}
            placeholder={t('org.members.deptNamePlaceholder')}
            onChange={(event) => {
              setDeptName(event.target.value);
              setDeptError(null);
            }}
          />
        </ConsoleFormField>
      </FormDialog>
      {data ? (
        <InviteDialog
          open={inviteOpen}
          orgId={orgId}
          departments={data.departments}
          positions={data.positions}
          roles={data.roles}
          departmentId={selectedId ?? rootDepartmentId(data.departments) ?? ''}
          onOpenChange={setInviteOpen}
          onCreated={() => reload(selectedId ?? undefined)}
        />
      ) : null}
    </AccountPage>
  );
}

function DeptActions({
  node,
  root,
  onAdd,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  root: boolean;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <span className="os-org-tree__actions">
      <Tooltip label={t('org.members.deptAdd')} side="top">
        <button
          type="button"
          className="os-org-tree__icon"
          aria-label={t('org.members.deptAdd')}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          <IconPlus width={14} height={14} strokeWidth={1.7} />
        </button>
      </Tooltip>
      <Tooltip label={t('org.members.deptRename')} side="top">
        <button
          type="button"
          className="os-org-tree__icon"
          aria-label={`${t('org.members.deptRename')} ${node.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onRename();
          }}
        >
          <IconEdit width={14} height={14} strokeWidth={1.7} />
        </button>
      </Tooltip>
      {root ? null : (
        <PopConfirm
          title={t('org.members.deptDeleteTitle')}
          description={t('org.members.deptDeleteDesc')}
          confirmLabel={t('org.members.deptDelete')}
          cancelLabel={t('org.profile.cancel')}
          onConfirm={onDelete}
        >
          <Tooltip label={t('org.members.deptDelete')} side="top">
            <button
              type="button"
              className="os-org-tree__icon"
              aria-label={`${t('org.members.deptDelete')} ${node.label}`}
            >
              <IconTrash width={14} height={14} strokeWidth={1.7} />
            </button>
          </Tooltip>
        </PopConfirm>
      )}
    </span>
  );
}

function InviteDialog({
  open,
  orgId,
  departments,
  positions,
  roles,
  departmentId,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  orgId: string;
  departments: Department[];
  positions: DirectoryBundle['positions'];
  roles: DirectoryBundle['roles'];
  departmentId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [deptId, setDeptId] = useState(departmentId);
  const [positionId, setPositionId] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setName('');
    setPassword('');
    setDeptId(departmentId);
    setPositionId('');
    setRoleCode('');
    setError(null);
    setBusy(false);
  }, [open, departmentId]);

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !deptId) return;
    if (password.trim() && password.trim().length < 8) {
      setError('org.security.newRequired');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await createUser(orgId, {
        email: trimmed,
        display_name: name.trim() || undefined,
        password: password.trim() || undefined,
        primary_department_id: deptId,
        admin_role_code: roleCode || undefined,
      });
      if (positionId) {
        try {
          await setUserPosition(orgId, user.id, positionId);
        } catch (err) {
          await onCreated().catch(() => undefined);
          toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
          onOpenChange(false);
          return;
        }
      }
      await onCreated().catch(() => undefined);
      toast.push({ tone: 'success', title: t('users.toast.invited') });
      onOpenChange(false);
    } catch (err) {
      setError(directoryErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('users.invite')}
      closeLabel={t('dialog.close')}
      cancelLabel={t('org.profile.cancel')}
      submitLabel={t('users.invite.submit')}
      submitting={busy}
      submitDisabled={!email.trim() || !deptId}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ConsoleFormField label={t('users.invite.email')} required error={error ? t(error) : undefined}>
        <Input
          value={email}
          disabled={busy}
          autoFocus
          placeholder={t('users.invite.emailPlaceholder')}
          aria-label={t('users.invite.email')}
          onChange={(event) => setEmail(event.target.value)}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('users.invite.displayName')}>
        <Input
          value={name}
          disabled={busy}
          placeholder={t('users.invite.displayNamePlaceholder')}
          aria-label={t('users.invite.displayName')}
          onChange={(event) => setName(event.target.value)}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('users.invite.department')} required>
        <SearchSelect
          searchable
          searchDebounceMs={DIRECTORY_SELECT_DEBOUNCE_MS}
          allowClear={false}
          value={deptId}
          onChange={setDeptId}
          placeholder={t('users.invite.departmentPlaceholder')}
          searchPlaceholder={t('users.search')}
          emptyText={t('org.members.roleEmpty')}
          aria-label={t('users.invite.department')}
          options={departmentOptionList(departments)}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('org.members.col.position')}>
        <SearchSelect
          searchable
          searchDebounceMs={DIRECTORY_SELECT_DEBOUNCE_MS}
          allowClear
          clearValue=""
          value={positionId}
          onChange={setPositionId}
          placeholder={t('org.positions.unset')}
          searchPlaceholder={t('org.members.positionSearch')}
          emptyText={t('org.members.positionEmpty')}
          aria-label={t('org.members.col.position')}
          options={positions.map((item) => ({ value: item.id, label: item.name }))}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('users.invite.role')}>
        <SearchSelect
          searchable
          searchDebounceMs={DIRECTORY_SELECT_DEBOUNCE_MS}
          allowClear
          clearValue=""
          value={roleCode}
          onChange={setRoleCode}
          placeholder={t('users.invite.roleNone')}
          searchPlaceholder={t('org.members.roleSearch')}
          emptyText={t('org.members.roleEmpty')}
          aria-label={t('users.invite.role')}
          options={roles.map((item) => ({ value: item.code, label: item.name }))}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('users.invite.password')} hint={t('users.invite.passwordHint')}>
        <Input
          type="password"
          value={password}
          disabled={busy}
          aria-label={t('users.invite.password')}
          onChange={(event) => setPassword(event.target.value)}
        />
      </ConsoleFormField>
    </FormDialog>
  );
}
