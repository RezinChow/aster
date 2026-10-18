import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, ConsoleDialog, FileDropzone, useToast } from '@a3s-lab/ui';
import {
  PARTNER_CSV_HEADERS,
  importPartnerInputs,
  previewPartnerCsv,
  type PartnerIssue,
} from '@/data/channelPartners';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

const ISSUE_KEY: Record<PartnerIssue, MessageKey> = {
  name: 'channels.import.reason.name',
  email: 'channels.import.reason.email',
  website: 'channels.import.reason.website',
  logo: 'channels.import.reason.logo',
  status: 'channels.import.reason.status',
  level: 'channels.import.reason.level',
  province: 'channels.import.reason.province',
  city: 'channels.import.reason.city',
  region: 'channels.import.reason.region',
  duplicate: 'channels.import.reason.duplicate',
};

function fill(template: string, vars: Record<string, number>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function downloadTemplate() {
  const blob = new Blob([`${PARTNER_CSV_HEADERS.join(',')}\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'channel-partners.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ChannelImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [csvText, setCsvText] = useState('');
  const [readError, setReadError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCsvText('');
    setReadError(false);
  }, [open]);

  const preview = useMemo(
    () => (csvText ? previewPartnerCsv(csvText) : null),
    [csvText],
  );
  const readyCount = preview?.rows.filter((row) => row.input).length ?? 0;

  function confirm() {
    const result = importPartnerInputs(
      (preview?.rows ?? []).flatMap((row) => (row.input ? [row.input] : [])),
    );
    if (result.created === 0) {
      toast.push({ tone: 'danger', title: t('channels.import.none') });
      return;
    }
    toast.push({
      tone: 'success',
      title: fill(t('channels.toast.imported'), { created: result.created }),
      description:
        result.skipped > 0
          ? fill(t('channels.toast.skipped'), { skipped: result.skipped })
          : undefined,
    });
    onImported();
    onOpenChange(false);
  }

  return (
    <ConsoleDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('channels.import.title')}
      description={t('channels.import.body')}
      closeLabel={t('dialog.close')}
      footer={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('channels.import.cancel')}
          </Button>
          <Button type="button" size="sm" disabled={readyCount === 0} onClick={confirm}>
            {t('channels.import.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={downloadTemplate}>
            {t('channels.import.template')}
          </Button>
        </div>
        <FileDropzone
          accept=".csv,text/csv"
          label={t('channels.import.drop')}
          hint={t('channels.import.dropHint')}
          onFiles={(files) => {
            const file = files[0];
            if (!file) return;
            setReadError(false);
            const reader = new FileReader();
            reader.onload = () => {
              setCsvText(typeof reader.result === 'string' ? reader.result : '');
            };
            reader.onerror = () => {
              setCsvText('');
              setReadError(true);
            };
            reader.readAsText(file);
          }}
        />
        {readError ? (
          <p className="text-sm text-ink-muted">{t('channels.import.readError')}</p>
        ) : null}
        {preview?.error === 'header' ? (
          <p className="text-sm text-ink-muted">{t('channels.import.header')}</p>
        ) : null}
        {preview?.error === 'empty' ? (
          <p className="text-sm text-ink-muted">{t('channels.import.emptyFile')}</p>
        ) : null}
        {preview && !preview.error ? (
          <div className="space-y-2">
            <p className="text-xs tabular-nums text-ink-faint">
              {t('channels.import.ready')} {readyCount}
              <span className="px-2">·</span>
              {t('channels.import.skip')} {preview.rows.length - readyCount}
            </p>
            <ul className="max-h-64 overflow-auto rounded-lg border border-[color:var(--color-border)]">
              {preview.rows.map((row) => (
                <li
                  key={row.line}
                  className="flex items-center gap-3 border-b border-[color:var(--color-border)] px-3 py-2 last:border-b-0"
                >
                  <span className="w-8 shrink-0 font-mono text-[11px] text-ink-faint">
                    {row.line}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {row.name || '—'}
                  </span>
                  <Badge tone={row.issue ? 'neutral' : 'success'}>
                    {row.issue ? t(ISSUE_KEY[row.issue]) : t('channels.import.ready')}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ConsoleDialog>
  );
}
