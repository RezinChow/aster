import { useEffect, useMemo, useState } from 'react';
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
import { IconEdit, IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { createPosition, deletePosition, renamePosition } from '@/lib/identityApi';
import { AccountPage } from '@/pages/platform/AccountPage';
import { usePageLoadKey } from '@/shell/pageLoad';
import { Tooltip } from '@/shell/Tooltip';
import { directoryErrorKey, loadDirectoryBundle, useAdminDirectory, type DirectoryBundle } from './adminDirectory';
import { AdminDirectoryTable } from './AdminDirectoryTable';

const ALL = 'all';
type NameDraft = { mode: 'create' } | { mode: 'rename'; id: string; name: string };

/** 管理后台职位。职位只是头衔，权限在管理员角色上。 */
export function AdminPositionsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const directory = useAdminDirectory();
  const orgId = directory.orgId;
  const [data, setData] = useState<DirectoryBundle | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(ALL);
  const [draft, setDraft] = useState<NameDraft | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const pageLoad = usePageLoadKey();

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const keep = pageLoad.keep(orgId);
    if (!keep) {
      setData(null);
      setFailed(false);
      setSelectedId(ALL);
    }
    loadDirectoryBundle(orgId)
      .then((bundle) => {
        if (cancelled) return;
        pageLoad.done(orgId);
        setData(bundle);
        setFailed(false);
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

  const positions = data?.positions ?? [];
  const visible = useMemo(
    () => (data?.people ?? []).filter((row) => selectedId === ALL || row.position_id === selectedId),
    [data, selectedId],
  );
  const selected = positions.find((row) => row.id === selectedId) ?? null;

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
      if (next === ALL || bundle.positions.some((row) => row.id === next)) return next;
      return ALL;
    });
  }

  function openDraft(next: NameDraft) {
    setDraft(next);
    setName(next.mode === 'rename' ? next.name : '');
    setNameError(null);
  }

  async function savePosition() {
    if (!orgId || !draft) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('org.positions.nameInvalid');
      return;
    }
    setBusy(true);
    setNameError(null);
    try {
      const saved =
        draft.mode === 'create'
          ? await createPosition(orgId, trimmed)
          : await renamePosition(orgId, draft.id, trimmed);
      await reload(saved.id);
      toast.push({
        tone: 'success',
        title: t(draft.mode === 'create' ? 'org.positions.created' : 'org.positions.renamed'),
      });
      setDraft(null);
    } catch (err) {
      setNameError(directoryErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  async function removePosition(id: string) {
    if (!orgId) return;
    try {
      await deletePosition(orgId, id);
      await reload(ALL);
      toast.push({ tone: 'success', title: t('org.positions.deleted') });
    } catch (err) {
      toast.push({ tone: 'danger', title: t(directoryErrorKey(err)) });
    }
  }

  return (
    <AccountPage
      className="os-team-directory"
      title={t('org.nav.positions')}
      description={selected?.name ?? t('org.positions.all')}
    >
      {failed ? <AppErrorBanner message={t('org.error.generic')} /> : null}
      <DirectorySplit
        className="os-org-directory"
        treeLabel={t('org.nav.positions')}
        detailLabel={t('org.nav.positions')}
        tree={
          <>
            <div className="os-org-tree__heading">
              <p className="os-org-tree__label">{t('org.nav.positions')}</p>
              {directory.canManage ? (
                <Tooltip label={t('org.positions.add')} side="top">
                  <button
                    type="button"
                    className="os-org-tree__icon"
                    aria-label={t('org.positions.add')}
                    onClick={() => openDraft({ mode: 'create' })}
                  >
                    <IconPlus width={14} height={14} strokeWidth={1.7} />
                  </button>
                </Tooltip>
              ) : null}
            </div>
            <div role="tree" aria-label={t('org.nav.positions')}>
              <div
                role="treeitem"
                aria-selected={selectedId === ALL}
                className={selectedId === ALL ? 'os-team-node is-selected' : 'os-team-node'}
              >
                <button type="button" className="os-team-node__label" onClick={() => setSelectedId(ALL)}>
                  {t('org.positions.all')}
                </button>
              </div>
              {positions.map((row) => (
                <div
                  key={row.id}
                  role="treeitem"
                  aria-selected={row.id === selectedId}
                  className={row.id === selectedId ? 'os-team-node is-selected' : 'os-team-node'}
                  style={{ paddingLeft: 16 }}
                >
                  <button type="button" className="os-team-node__label" onClick={() => setSelectedId(row.id)}>
                    {row.name}
                  </button>
                  {directory.canManage ? (
                    <span className="os-team-node__actions">
                      <Tooltip label={t('org.positions.rename')} side="top">
                        <button
                          type="button"
                          className="os-org-tree__icon"
                          aria-label={`${t('org.positions.rename')} ${row.name}`}
                          onClick={() => openDraft({ mode: 'rename', id: row.id, name: row.name })}
                        >
                          <IconEdit width={14} height={14} strokeWidth={1.7} />
                        </button>
                      </Tooltip>
                      <PopConfirm
                        title={t('org.positions.deleteTitle')}
                        description={t('org.positions.deleteDesc')}
                        confirmLabel={t('org.positions.delete')}
                        cancelLabel={t('org.profile.cancel')}
                        onConfirm={() => removePosition(row.id)}
                      >
                        <Tooltip label={t('org.positions.delete')} side="top">
                          <button
                            type="button"
                            className="os-org-tree__icon"
                            aria-label={`${t('org.positions.delete')} ${row.name}`}
                          >
                            <IconTrash width={14} height={14} strokeWidth={1.7} />
                          </button>
                        </Tooltip>
                      </PopConfirm>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        }
        detail={
          data ? (
            <AdminDirectoryTable
              orgId={orgId}
              rows={visible}
              departments={data.departments}
              positions={data.positions}
              roles={data.roles}
              canManage={directory.canManage}
              ariaLabel={t('org.nav.positions')}
              onRefresh={() => reload()}
            />
          ) : null
        }
      />
      <FormDialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        size="sm"
        title={t(draft?.mode === 'rename' ? 'org.positions.renameTitle' : 'org.positions.createTitle')}
        closeLabel={t('dialog.close')}
        cancelLabel={t('org.profile.cancel')}
        submitLabel={t('org.profile.save')}
        submitting={busy}
        submitDisabled={!name.trim()}
        onSubmit={(event) => {
          event.preventDefault();
          void savePosition();
        }}
      >
        <ConsoleFormField label={t('org.positions.name')} required error={nameError ? t(nameError) : undefined}>
          <Input
            value={name}
            autoFocus
            disabled={busy}
            aria-label={t('org.positions.name')}
            placeholder={t('org.positions.namePlaceholder')}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(null);
            }}
          />
        </ConsoleFormField>
      </FormDialog>
    </AccountPage>
  );
}

