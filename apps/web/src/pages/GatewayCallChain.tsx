import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@a3s-lab/ui';
import type { MessageKey } from '@/i18n/messages';
type LocalGatewayService = {
  name: string;
  strategy: string | null;
  upstreams: string[];
  healthPath: string | null;
  health?: { healthy: number; total: number } | null;
  routers: { rule: string }[];
};

type Translate = (key: MessageKey) => string;

function Arrow() {
  return <div className="hidden h-px w-8 shrink-0 self-center bg-border sm:block" aria-hidden />;
}

function NodeShell({
  kind,
  title,
  subtitle,
  badge,
  accent = false,
}: {
  kind: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-[10.5rem] max-w-[16rem] rounded-md border px-3 py-2.5 ${
        accent
          ? 'border-primary/40 bg-[color:var(--color-control-fill)]'
          : 'border-border/80 bg-surface'
      }`}
    >
      <div className="text-xs text-ink-muted">{kind}</div>
      <div className="mt-1 truncate text-sm font-medium text-ink" title={title}>
        {title}
      </div>
      {subtitle ? (
        <div className="mt-0.5 break-all font-mono text-[11px] text-ink-muted" title={subtitle}>
          {subtitle}
        </div>
      ) : null}
      {badge ? <div className="mt-2">{badge}</div> : null}
    </div>
  );
}

export function GatewayCallChain({
  service,
  entrypoint,
  t,
}: {
  service: LocalGatewayService;
  entrypoint: string;
  t: Translate;
}) {
  const rules = service.routers.map((router) => router.rule).join(' · ');
  return (
    <div className="space-y-3">
      <div className="text-xs text-ink-muted">
        {t('gateway.topology.title')}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        <NodeShell
          kind={t('gateway.topology.entrypoint')}
          title={entrypoint || t('gateway.topology.entrypoint')}
          subtitle={rules || undefined}
        />
        <Arrow />
        <NodeShell
          kind={t('gateway.topology.service')}
          title={service.name}
          subtitle={service.strategy ?? undefined}
          badge={<Badge tone="primary">{t('gateway.kind.proxy')}</Badge>}
        />
        <Arrow />
        <NodeShell
          kind={t('gateway.topology.upstream')}
          title={service.upstreams[0] ?? '—'}
          subtitle={
            service.healthPath
              ? t('gateway.topology.health').replace('{path}', service.healthPath)
              : undefined
          }
          accent
          badge={
            service.upstreams.length > 1 ? (
              <Badge tone={'neutral' as BadgeTone}>
                {t('gateway.topology.upstreams').replace('{n}', String(service.upstreams.length))}
              </Badge>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
