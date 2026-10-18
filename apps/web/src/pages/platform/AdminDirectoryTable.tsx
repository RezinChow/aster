import { useRef, useState } from 'react';
import { FormDialog, ConsoleFormField, Input, SearchSelect, useToast } from '@a3s-lab/ui';
import { IconEdit, IconRotateCcw, IconSearch, IconX } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { setUserPosition, updateUser, type AdminRole, type Department, type Position } from '@/lib/identityApi';
import {
  departmentOptionList,
  DIRECTORY_SELECT_DEBOUNCE_MS,
  directoryErrorKey,
  type DirectoryPerson,
} from './adminDirectory';

const DASH = '—';
const STATUSES = ['active', 'invited', 'disabled', 'resigned'] as const;
const REFRESH_SPIN_MS = 700;

const COLUMNS = ['member', 'phone', 'email', 'department', 'position', 'role', 'status'] as const;

function statusKey(status: string): MessageKey | null {
  if (status === 'active') return 'users.status.active';
  if (status === 'invited') return 'users.status.invited';
  if (status === 'disabled') return 'users.status.disabled';
  if (status === 'resigned') return 'users.status.resigned';
  return null;
}

function sameCodes(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((code, index) => code === b[index]);
}

function personLabel(row: Pick<DirectoryPerson, 'display_name' | 'email'>) {
  return row.display_name.trim() || row.email.trim() || '';
}

function personInitial(name: string) {
  const text = name.trim();
  return text ? [...text][0]! : DASH;
}

/** 后台用户表。行样式与控制台目录页一致，记录的是可登录控制台的用户。 */
export function AdminDirectoryTable({
  orgId,
  rows,
  departments,
  positions,
  roles,
  canManage,
  ariaLabel,
  onRefresh,
}: {
  orgId: string;
  rows: DirectoryPerson[];
  departments: readonly Department[];
  positions: readonly Position[];
  roles: readonly AdminRole[];
  canManage: boolean;
  ariaLabel: string;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const [editTarget, setEditTarget] = useState<DirectoryPerson | null>(null);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [status, setStatus] = useState('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const names = new Map(departments.map((row) => [row.id, row.name]));
  const needle = query.trim().toLocaleLowerCase();
  const visible = rows.filter((row) => {
    if (!needle) return true;
    const key = statusKey(row.status);
    return [
      row.display_name,
      row.phone ?? '',
      row.email,
      names.get(row.department_id) ?? '',
      row.position_name ?? '',
      row.admin_roles.map((role) => role.name).join(' '),
      key ? t(key) : row.status,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle);
  });

  function openEdit(row: DirectoryPerson) {
    setEditTarget(row);
    setName(row.display_name);
    setDepartmentId(row.department_id);
    setPositionId(row.position_id ?? '');
    setRoleCodes(row.admin_roles.map((role) => role.code));
    setStatus(row.status);
    setError(null);
  }

  async function save() {
    if (!editTarget) return;
    const patch: {
      display_name?: string;
      primary_department_id?: string;
      status?: string;
      admin_role_codes?: string[];
    } = {};
    const trimmed = name.trim();
    if (trimmed !== editTarget.display_name) patch.display_name = trimmed;
    if (departmentId && departmentId !== editTarget.department_id) patch.primary_department_id = departmentId;
    if (status !== editTarget.status) patch.status = status;
    if (!sameCodes(roleCodes, editTarget.admin_roles.map((role) => role.code))) {
      patch.admin_role_codes = roleCodes;
    }
    const nextPosition = positionId || null;
    const positionChanged = nextPosition !== (editTarget.position_id ?? null);
    if (Object.keys(patch).length === 0 && !positionChanged) {
      setEditTarget(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (Object.keys(patch).length > 0) await updateUser(orgId, editTarget.id, patch);
      if (positionChanged) await setUserPosition(orgId, editTarget.id, nextPosition);
      await onRefresh();
      toast.push({ tone: 'success', title: t('users.toast.saved') });
      setEditTarget(null);
    } catch (err) {
      setError(directoryErrorKey(err));
    } finally {
      setBusy(false);
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
    } catch (err) {
      toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
    } finally {
      const wait = Math.max(0, REFRESH_SPIN_MS - (Date.now() - started));
      window.setTimeout(() => {
        refreshLock.current = false;
        setRefreshing(false);
      }, wait);
    }
  }

  const editLabel = editTarget ? personLabel(editTarget) : '';

  return (
    <div className="os-team-members" data-ui="admin.directory-table">
      <div className="os-team-toolbar">
        <label className="os-team-search">
          <IconSearch width={14} height={14} strokeWidth={1.7} />
          <input
            value={query}
            aria-label={t('users.search')}
            placeholder={t('users.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label={t('org.members.searchClear')} onClick={() => setQuery('')}>
              <IconX width={14} height={14} strokeWidth={1.7} />
            </button>
          ) : null}
        </label>
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
      <div className="os-team-table-scroll">
        {visible.length === 0 ? (
          <p className="os-team-empty">{rows.length > 0 ? t('org.members.noMatch') : t('users.empty.title')}</p>
        ) : (
          <table className="os-team-table" aria-label={ariaLabel}>
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col">
                    {t(column === 'member' ? 'users.col.user' : `org.members.col.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const label = personLabel(row) || DASH;
                const statusLabel = statusKey(row.status);
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="os-team-person">
                        <span className="os-team-avatar" aria-hidden>
                          {personInitial(label)}
                        </span>
                        <span className="os-team-person__name">{label}</span>
                        {canManage ? (
                          <button
                            type="button"
                            className="os-team-row-action"
                            aria-label={t('users.edit')}
                            onClick={() => openEdit(row)}
                          >
                            <IconEdit width={14} height={14} strokeWidth={1.7} />
                          </button>
                        ) : null}
                      </span>
                    </td>
                    <td>{row.phone?.trim() || DASH}</td>
                    <td>{row.email.trim() || DASH}</td>
                    <td>{names.get(row.department_id) || DASH}</td>
                    <td>{row.position_name?.trim() || DASH}</td>
                    <td>
                      {row.admin_roles.length > 0 ? (
                        <span className="os-team-chips">
                          {row.admin_roles.map((role) => (
                            <span key={role.code} className="os-team-chip">
                              {role.name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="os-team-muted">{t('users.noRoles')}</span>
                      )}
                    </td>
                    <td className="os-team-muted">{statusLabel ? t(statusLabel) : row.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <FormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        size="sm"
        title={editLabel ? t('org.members.editTitle').replace('{name}', editLabel) : t('users.edit')}
        closeLabel={t('dialog.close')}
        cancelLabel={t('org.profile.cancel')}
        submitLabel={t('org.profile.save')}
        submitting={busy}
        submitDisabled={!departmentId || !status}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <ConsoleFormField label={t('users.invite.displayName')} error={error ? t(error) : undefined}>
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
            value={departmentId}
            onChange={setDepartmentId}
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
            multiple
            searchable
            searchDebounceMs={DIRECTORY_SELECT_DEBOUNCE_MS}
            value={roleCodes}
            onChange={setRoleCodes}
            placeholder={t('users.invite.roleNone')}
            searchPlaceholder={t('org.members.roleSearch')}
            emptyText={t('org.members.roleEmpty')}
            aria-label={t('users.invite.role')}
            options={roles.map((item) => ({ value: item.code, label: item.name }))}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('org.members.col.status')} required>
          <SearchSelect
            searchable={false}
            allowClear={false}
            value={status}
            onChange={setStatus}
            placeholder={t('users.col.statusPlaceholder')}
            aria-label={t('org.members.col.status')}
            options={STATUSES.map((item) => ({ value: item, label: t(statusKey(item)!) }))}
          />
        </ConsoleFormField>
      </FormDialog>
    </div>
  );
}
