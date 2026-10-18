import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  ConsoleConfirmDialog,
  ConsoleDropdownMenu,
  ConsoleEmptyState,
  FileDropzone,
  FilterChip,
  FormDialog,
  ConsoleFormField,
  Input,
  ListToolbar,
  SearchSelect,
  Tabs,
  TabsList,
  TabsTrigger,
  ConsoleTextarea,
  useToast,
  type ConsoleDropdownMenuItem,
} from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { I18nDataTable } from '@/components/I18nDataTable';
import { IconMore } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  APP_RELEASE_MAX_BYTES,
  deleteAppRelease,
  downloadAppRelease,
  listAppReleases,
  publishAppRelease,
  uploadAppRelease,
  withdrawAppRelease,
  type AppChannel,
  type AppRelease,
  type AppReleaseStatus,
} from '@/lib/appReleaseApi';

const DESKTOP_PLATFORMS = ['macos', 'windows', 'linux'] as const;
const MOBILE_PLATFORMS = ['ios', 'android'] as const;

function platformsFor(channel: AppChannel) {
  return channel === 'desktop' ? DESKTOP_PLATFORMS : MOBILE_PLATFORMS;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUploaded(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ').slice(0, 16);
  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorKey(err: unknown): MessageKey {
  const message = err instanceof Error ? err.message : '';
  if (/already exists/i.test(message)) return 'settings.apps.duplicate';
  if (/version is invalid/i.test(message)) return 'settings.apps.versionInvalid';
  if (/file is required/i.test(message)) return 'settings.apps.fileRequired';
  if (/too large/i.test(message)) return 'settings.apps.fileTooLarge';
  if (/withdraw the published/i.test(message)) return 'settings.apps.publishedDelete';
  return 'org.error.generic';
}

function statusTone(status: AppReleaseStatus): 'success' | 'neutral' {
  return status === 'published' ? 'success' : 'neutral';
}

type Pending = { kind: 'publish' | 'withdraw' | 'delete'; row: AppRelease };

export function AppsSection() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [channel, setChannel] = useState<AppChannel>('desktop');
  const [platform, setPlatform] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AppRelease[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  async function load(next = channel) {
    const list = await listAppReleases(next);
    setRows(list);
    setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setFailed(false);
    listAppReleases(channel)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [channel]);

  async function act(work: () => Promise<void>, success: MessageKey) {
    try {
      await work();
      await load();
      toast.push({ tone: 'success', title: t(success) });
    } catch (err) {
      toast.push({ tone: 'danger', title: t(errorKey(err)) });
    }
  }

  const platforms = platformsFor(channel);
  const channelRows = useMemo(
    () => [...(rows ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [rows],
  );
  const needle = search.trim().toLowerCase();
  const visible = channelRows.filter((row) => {
    if (platform !== 'all' && row.platform !== platform) return false;
    if (!needle) return true;
    const platformLabel = t(`settings.apps.platform.${row.platform}` as MessageKey).toLowerCase();
    return [row.version, row.file_name, row.notes, platformLabel].join(' ').toLowerCase().includes(needle);
  });
  const filtered = needle.length > 0 || platform !== 'all';

  function chooseChannel(next: string) {
    if (next !== 'desktop' && next !== 'mobile') return;
    setChannel(next);
    setPlatform('all');
  }

  function rowMenu(row: AppRelease): ConsoleDropdownMenuItem[] {
    const items: ConsoleDropdownMenuItem[] = [
      {
        id: 'download',
        label: t('settings.apps.download'),
        onSelect: () => {
          void downloadAppRelease(row).catch((err) => {
            toast.push({ tone: 'danger', title: t(errorKey(err)) });
          });
        },
      },
    ];
    if (row.status === 'published') {
      items.push({
        id: 'withdraw',
        label: t('settings.apps.withdraw'),
        onSelect: () => setPending({ kind: 'withdraw', row }),
      });
    } else {
      items.push({
        id: 'publish',
        label: t('settings.apps.publish'),
        onSelect: () => setPending({ kind: 'publish', row }),
      });
      items.push({
        id: 'delete',
        label: t('settings.apps.delete'),
        tone: 'danger',
        separator: true,
        onSelect: () => setPending({ kind: 'delete', row }),
      });
    }
    return items;
  }

  const confirm =
    pending?.kind === 'delete'
      ? {
          title: t('settings.apps.deleteConfirm').replace('{version}', pending.row.version),
          description: undefined,
          label: t('settings.apps.delete'),
          tone: 'danger' as const,
        }
      : pending?.kind === 'withdraw'
        ? {
            title: t('settings.apps.withdrawConfirm').replace('{version}', pending.row.version),
            description: t('settings.apps.withdrawConfirmBody'),
            label: t('settings.apps.withdraw'),
            tone: 'danger' as const,
          }
        : {
            title: t('settings.apps.publishConfirm').replace('{version}', pending?.row.version ?? ''),
            description: t('settings.apps.publishConfirmBody'),
            label: t('settings.apps.publish'),
            tone: 'default' as const,
          };

  return (
    <div className="space-y-3">
      <Tabs value={channel} onValueChange={chooseChannel} className="gap-0">
        <TabsList className="os-market-shelf-tabs os-apps-channel-tabs" aria-label={t('settings.apps')}>
          {(['desktop', 'mobile'] as const).map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="os-market-shelf-tab os-apps-channel-tab !h-auto !rounded-none !bg-transparent !px-3.5 !py-2.5 !shadow-none"
            >
              {t(item === 'desktop' ? 'settings.apps.desktop' : 'settings.apps.mobile')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('settings.apps.search')}
        filters={
          <>
            <FilterChip
              label={t('settings.apps.platform.all')}
              count={channelRows.length}
              active={platform === 'all'}
              onClick={() => setPlatform('all')}
            />
            {platforms.map((item) => (
              <FilterChip
                key={item}
                label={t(`settings.apps.platform.${item}`)}
                count={channelRows.filter((row) => row.platform === item).length}
                active={platform === item}
                onClick={() => setPlatform(item)}
              />
            ))}
          </>
        }
        primaryAction={
          <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
            {t('settings.apps.upload')}
          </Button>
        }
      />
      {failed ? (
        <AppErrorBanner
          message={t('org.error.generic')}
          onRetry={() => {
            setRows(null);
            setFailed(false);
            void load().catch(() => setFailed(true));
          }}
        />
      ) : (
        <I18nDataTable
          aria-label={t('settings.apps')}
          rows={visible}
          loading={rows === null}
          rowKey={(row) => row.id}
          onRefresh={async () => {
            try {
              await load();
            } catch (err) {
              toast.push({ tone: 'danger', title: t(errorKey(err)) });
              setFailed(true);
            }
          }}
          empty={
            filtered ? (
              <ConsoleEmptyState
                variant="no-match"
                title={t('settings.apps.noMatch')}
                clearFiltersLabel={t('admin.empty.clearFilters')}
                onClearFilters={() => {
                  setSearch('');
                  setPlatform('all');
                }}
              />
            ) : (
              <ConsoleEmptyState variant="no-data" title={t('settings.apps.empty')} />
            )
          }
          columns={[
            {
              id: 'version',
              header: t('settings.apps.col.version'),
              sortable: true,
              getSortValue: (row) => row.version,
              cell: (row) => (
                <div className="min-w-0">
                  <div className="font-mono text-sm text-ink">{row.version}</div>
                  {row.notes ? (
                    <div className="truncate text-xs text-ink-muted" title={row.notes}>
                      {row.notes}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              id: 'platform',
              header: t('settings.apps.platform'),
              sortable: true,
              getSortValue: (row) => row.platform,
              cell: (row) => t(`settings.apps.platform.${row.platform}` as MessageKey),
            },
            {
              id: 'file',
              header: t('settings.apps.col.file'),
              cell: (row) => (
                <span className="font-mono text-xs text-ink" title={row.file_name}>
                  {row.file_name}
                </span>
              ),
            },
            {
              id: 'size',
              header: t('settings.apps.col.size'),
              sortable: true,
              getSortValue: (row) => row.size_bytes,
              cell: (row) => <span className="tabular-nums">{formatBytes(row.size_bytes)}</span>,
            },
            {
              id: 'status',
              header: t('settings.apps.col.status'),
              sortable: true,
              getSortValue: (row) => row.status,
              cell: (row) => (
                <Badge tone={statusTone(row.status)}>{t(`settings.apps.status.${row.status}`)}</Badge>
              ),
            },
            {
              id: 'uploaded',
              header: t('settings.apps.col.uploaded'),
              sortable: true,
              getSortValue: (row) => row.created_at,
              cell: (row) => formatUploaded(row.created_at, locale),
            },
          ]}
          rowActions={(row) => (
            <ConsoleDropdownMenu
              align="end"
              aria-label={t('settings.apps.more')}
              items={rowMenu(row)}
              trigger={
                <span className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted">
                  <IconMore width={16} height={16} />
                </span>
              }
            />
          )}
        />
      )}
      <UploadDialog
        open={uploadOpen}
        channel={channel}
        platform={platform === 'all' ? platforms[0] : platform}
        onOpenChange={setUploadOpen}
        onUploaded={(nextPlatform) => {
          setPlatform((current) => (current === 'all' ? 'all' : nextPlatform));
          return act(async () => undefined, 'settings.apps.uploaded');
        }}
      />
      {pending ? (
        <ConsoleConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.label}
          cancelLabel={t('settings.apps.cancel')}
          tone={confirm.tone}
          onConfirm={() => {
            const current = pending;
            const success =
              current.kind === 'publish'
                ? 'settings.apps.published'
                : current.kind === 'withdraw'
                  ? 'settings.apps.withdrawn'
                  : 'settings.apps.deleted';
            const work =
              current.kind === 'publish'
                ? () => publishAppRelease(current.row.id).then(() => undefined)
                : current.kind === 'withdraw'
                  ? () => withdrawAppRelease(current.row.id).then(() => undefined)
                  : () => deleteAppRelease(current.row.id).then(() => undefined);
            return act(work, success);
          }}
        />
      ) : null}
    </div>
  );
}

function UploadDialog({
  open,
  channel,
  platform,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  channel: AppChannel;
  platform: string;
  onOpenChange: (open: boolean) => void;
  onUploaded: (platform: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [version, setVersion] = useState('');
  const [picked, setPicked] = useState(platform);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [versionError, setVersionError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const platformOptions = platformsFor(channel).map((item) => ({
    value: item,
    label: t(`settings.apps.platform.${item}`),
  }));

  useEffect(() => {
    if (!open) return;
    setVersion('');
    setPicked(platform);
    setNotes('');
    setFile(null);
    setVersionError(undefined);
    setFileError(undefined);
    setBusy(false);
  }, [open, platform]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = version.trim();
    if (!trimmed) {
      setVersionError(t('settings.apps.versionRequired'));
      return;
    }
    if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(trimmed)) {
      setVersionError(t('settings.apps.versionInvalid'));
      return;
    }
    if (!file) {
      setFileError(t('settings.apps.fileRequired'));
      return;
    }
    if (file.size > APP_RELEASE_MAX_BYTES) {
      setFileError(t('settings.apps.fileTooLarge'));
      return;
    }
    setBusy(true);
    try {
      await uploadAppRelease({ channel, platform: picked, version: trimmed, notes: notes.trim(), file });
      await onUploaded(picked);
      onOpenChange(false);
    } catch (err) {
      const key = errorKey(err);
      if (key === 'settings.apps.versionInvalid' || key === 'settings.apps.duplicate') setVersionError(t(key));
      else if (key === 'settings.apps.fileRequired' || key === 'settings.apps.fileTooLarge') setFileError(t(key));
      else toast.push({ tone: 'danger', title: t(key) });
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings.apps.upload')}
      closeLabel={t('dialog.close')}
      cancelLabel={t('settings.apps.cancel')}
      submitLabel={t('settings.apps.upload')}
      submitting={busy}
      onSubmit={(event) => void onSubmit(event)}
    >
      <ConsoleFormField label={t('settings.apps.version')} required error={versionError}>
        <Input
          value={version}
          disabled={busy}
          placeholder="1.2.3"
          autoFocus
          onChange={(event) => {
            setVersion(event.target.value);
            setVersionError(undefined);
          }}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('settings.apps.platform')}>
        <SearchSelect
          value={picked}
          options={platformOptions}
          onChange={setPicked}
          searchable={false}
          allowClear={false}
          disabled={busy}
          aria-label={t('settings.apps.platform')}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('settings.apps.notes')}>
        <ConsoleTextarea
          value={notes}
          disabled={busy}
          rows={4}
          onChange={(event) => setNotes(event.target.value)}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('settings.apps.file')} required error={fileError}>
        <FileDropzone
          disabled={busy}
          label={file ? file.name : t('settings.apps.drop')}
          hint={file ? formatBytes(file.size) : t('settings.apps.fileHint')}
          onFiles={(files) => {
            setFile(files[0] ?? null);
            setFileError(undefined);
          }}
        />
      </ConsoleFormField>
    </FormDialog>
  );
}
