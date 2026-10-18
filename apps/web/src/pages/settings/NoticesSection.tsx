import { useEffect, useState } from 'react';
import { Button, ConsoleFormField, ConsoleTextarea, Input, useToast } from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  listPublications,
  publicationErrorKey,
  publishPublication,
  savePublication,
  withdrawPublication,
  type Publication,
  type PublicationKind,
  type PublicationWrite,
} from '@/lib/publicationApi';

const KINDS: PublicationKind[] = ['terms', 'privacy', 'copyright', 'support'];

const KIND_LABEL: Record<PublicationKind, MessageKey> = {
  terms: 'settings.notices.terms',
  privacy: 'settings.notices.privacy',
  copyright: 'settings.notices.copyright',
  support: 'settings.notices.support',
};

function writeFrom(row: Publication): PublicationWrite {
  return {
    titleZh: row.titleZh,
    titleEn: row.titleEn,
    bodyZh: row.bodyZh,
    bodyEn: row.bodyEn,
    effectiveOn: row.effectiveOn,
    contactEmail: row.contactEmail,
    contactHours: row.contactHours,
    contactTicketUrl: row.contactTicketUrl,
  };
}

function sameWrite(row: Publication, draft: PublicationWrite): boolean {
  const current = writeFrom(row);
  return (Object.keys(current) as Array<keyof PublicationWrite>).every(
    (key) => current[key] === draft[key],
  );
}

export function NoticesSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<Publication[]>([]);
  const [kind, setKind] = useState<PublicationKind>('terms');
  const [draft, setDraft] = useState<PublicationWrite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPublications()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        const first = list.find((row) => row.kind === 'terms') ?? list[0];
        if (first) {
          setKind(first.kind);
          setDraft(writeFrom(first));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('settings.notices.error.body'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const current = rows.find((row) => row.kind === kind) ?? null;

  function selectKind(next: PublicationKind) {
    const row = rows.find((item) => item.kind === next);
    setKind(next);
    setDraft(row ? writeFrom(row) : null);
    setError(null);
  }

  function replaceRow(saved: Publication) {
    setRows((items) => items.map((item) => (item.kind === saved.kind ? saved : item)));
    setDraft(writeFrom(saved));
  }

  function explain(err: unknown): string {
    const message = err instanceof ApiRequestError || err instanceof Error ? err.message : '';
    const key = publicationErrorKey(message);
    return key ? t(key as MessageKey) : message || t('settings.notices.error.body');
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await savePublication(kind, draft);
      replaceRow(saved);
      toast.push({ title: t('settings.notices.saved'), tone: 'info' });
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = current && sameWrite(current, draft) ? current : await savePublication(kind, draft);
      const published = await publishPublication(saved.kind);
      replaceRow(published);
      toast.push({ title: t('settings.notices.published'), tone: 'info' });
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const saved = await withdrawPublication(kind);
      replaceRow(saved);
      toast.push({ title: t('settings.notices.withdrawn'), tone: 'info' });
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!current || !draft) {
    return error ? <AppErrorBanner message={error} /> : null;
  }

  const dirty = !sameWrite(current, draft);

  return (
    <div className="os-settings__fields">
      <div className="os-settings__inline">
        {KINDS.map((item) => (
          <Button
            key={item}
            type="button"
            variant={item === kind ? 'default' : 'outline'}
            onClick={() => selectKind(item)}
            disabled={busy}
          >
            {t(KIND_LABEL[item])}
          </Button>
        ))}
      </div>
      {error ? <AppErrorBanner message={error} /> : null}
      <section className="os-settings__group">
        <h4 className="os-settings__group-title">
          {t(KIND_LABEL[kind])}
          {' · '}
          {current.status === 'published'
            ? t('settings.notices.status.published')
            : t('settings.notices.status.draft')}
        </h4>
        <div className="os-settings__fields">
          <ConsoleFormField label={t('settings.notices.titleZh')}>
            <Input
              value={draft.titleZh}
              maxLength={120}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, titleZh: event.target.value })}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('settings.notices.titleEn')}>
            <Input
              value={draft.titleEn}
              maxLength={120}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('settings.notices.bodyZh')} className="is-wide">
            <ConsoleTextarea
              rows={8}
              value={draft.bodyZh}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, bodyZh: event.target.value })}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('settings.notices.bodyEn')} className="is-wide">
            <ConsoleTextarea
              rows={8}
              value={draft.bodyEn}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, bodyEn: event.target.value })}
            />
          </ConsoleFormField>
          {kind === 'support' ? (
            <>
              <ConsoleFormField label={t('settings.notices.email')}>
                <Input
                  type="email"
                  value={draft.contactEmail}
                  maxLength={200}
                  disabled={busy}
                  onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.notices.hours')}>
                <Input
                  value={draft.contactHours}
                  maxLength={200}
                  disabled={busy}
                  onChange={(event) => setDraft({ ...draft, contactHours: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.notices.ticket')} className="is-wide">
                <Input
                  value={draft.contactTicketUrl}
                  maxLength={500}
                  disabled={busy}
                  placeholder="https://"
                  onChange={(event) => setDraft({ ...draft, contactTicketUrl: event.target.value })}
                />
              </ConsoleFormField>
            </>
          ) : (
            <ConsoleFormField label={t('settings.notices.effective')}>
              <Input
                type="date"
                value={draft.effectiveOn}
                disabled={busy}
                onChange={(event) => setDraft({ ...draft, effectiveOn: event.target.value })}
              />
            </ConsoleFormField>
          )}
          <p className="os-settings__placeholder">
            {t('settings.notices.address')} {current.path}
          </p>
          <div className="os-settings__inline">
            <Button type="button" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? t('settings.notices.saving') : t('settings.notices.save')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void publish()}>
              {t('settings.notices.publish')}
            </Button>
            {current.status === 'published' ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void withdraw()}>
                {t('settings.notices.withdraw')}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
