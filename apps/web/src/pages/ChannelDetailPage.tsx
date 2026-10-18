import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Badge, Button } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { IconEdit } from '@/components/UiIcons';
import { channelCoverageLabel } from '@/data/channelCoverage';
import {
  getChannelPartner,
  resolveChannelPartner,
  type ChannelPartner,
  type ChannelPartnerStatus,
} from '@/data/channelPartners';
import { effectiveShare } from '@/data/channelShares';
import { listCloudOrganizations } from '@/lib/cloudApi';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ChannelPartnerDialog } from '@/pages/channels/ChannelPartnerDialog';
import { levelLabel } from '@/pages/channels/ChannelTerritoryFields';
import { PartnerLogo } from '@/pages/channels/PartnerLogo';

const STATUS_LABEL: Record<ChannelPartnerStatus, MessageKey> = {
  active: 'channels.partnerStatus.active',
  inactive: 'channels.partnerStatus.inactive',
};

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

function createdLabel(value: string): string {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value;
}

function websiteHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, '');
  }
}

export function ChannelDetailPage() {
  const { id = '' } = useParams();
  const { locale, t } = useI18n();
  const [partner, setPartner] = useState<ChannelPartner | null>(() =>
    id ? (getChannelPartner(id) ?? null) : null,
  );
  const [resolved, setResolved] = useState(() => !id || Boolean(getChannelPartner(id)));
  const [missing, setMissing] = useState(!id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const stored = id ? getChannelPartner(id) : undefined;
    if (stored) {
      setPartner(stored);
      setMissing(false);
      setResolved(true);
    } else if (!id) {
      setPartner(null);
      setMissing(true);
      setResolved(true);
    }
    let cancelled = false;
    void (async () => {
      try {
        const organizations = await listCloudOrganizations();
        if (cancelled) return;
        const next = resolveChannelPartner(id, organizations);
        setCloudError(null);
        if (next) {
          setPartner(next);
          setMissing(false);
        } else if (!stored) {
          setPartner(null);
          setMissing(true);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        setCloudError(error instanceof Error ? error.message : t('admin.error.title'));
        if (!stored) {
          setPartner(null);
          setMissing(true);
        }
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, t]);

  if (!resolved) return null;
  if (missing || !partner) {
    return <Navigate to="/admin/channels" replace />;
  }

  const share = effectiveShare(partner.id, partner.level);

  return (
    <AdminPageShell
      title={partner.name || t('channels.title')}
      description={partner.legalName || t('channels.description')}
      backTo="/admin/channels"
      actions={
        <Button type="button" size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
          <IconEdit />
          {t('channels.form.editTitle')}
        </Button>
      }
    >
      {cloudError ? (
        <AppErrorBanner className="mb-3" message={cloudError} onRetry={reload} />
      ) : null}
      <div className="mb-4 flex items-center gap-3">
        <PartnerLogo name={partner.name} logoUrl={partner.logoUrl} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{partner.name}</span>
            {partner.status ? (
              <Badge tone={partner.status === 'active' ? 'success' : 'neutral'}>
                {t(STATUS_LABEL[partner.status])}
              </Badge>
            ) : (
              <Dash />
            )}
          </div>
          <div className="truncate font-mono text-xs text-ink-faint">{partner.id}</div>
        </div>
      </div>
      <dl className="os-work-expand">
        <div>
          <dt>{t('channels.col.tenant')}</dt>
          <dd className="font-mono text-xs">{partner.id}</dd>
        </div>
        <div>
          <dt>{t('channels.field.level')}</dt>
          <dd>{levelLabel(partner.level, t) || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.share')}</dt>
          <dd>{share ? <span className="tabular-nums">{share}%</span> : <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.region')}</dt>
          <dd>{channelCoverageLabel(partner, locale, t('channels.field.nationwide')) || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.legalName')}</dt>
          <dd>{partner.legalName || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.website')}</dt>
          <dd>
            {partner.website ? (
              <a href={partner.website} target="_blank" rel="noreferrer" className="hover:underline">
                {websiteHost(partner.website)}
              </a>
            ) : (
              <Dash />
            )}
          </dd>
        </div>
        <div>
          <dt>{t('channels.field.region')}</dt>
          <dd>{partner.region || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.industry')}</dt>
          <dd>{partner.industry || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.contactName')}</dt>
          <dd>{partner.contactName || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.contactEmail')}</dt>
          <dd>{partner.contactEmail || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.field.phone')}</dt>
          <dd>{partner.phone || <Dash />}</dd>
        </div>
        <div>
          <dt>{t('channels.col.created')}</dt>
          <dd className="tabular-nums">
            {partner.createdAt ? createdLabel(partner.createdAt) : <Dash />}
          </dd>
        </div>
        <div>
          <dt>{t('channels.field.notes')}</dt>
          <dd>{partner.notes || <Dash />}</dd>
        </div>
      </dl>
      <ChannelPartnerDialog
        open={editorOpen}
        partner={partner}
        onOpenChange={setEditorOpen}
        onSaved={(next) => {
          setPartner(next);
          setMissing(false);
        }}
      />
    </AdminPageShell>
  );
}
