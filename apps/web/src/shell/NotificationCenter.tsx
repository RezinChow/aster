import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cn } from '@a3s-lab/ui';
import {
  overviewAttention,
  type OverviewAttention,
  type OverviewAttentionKind,
  type OverviewSeverity,
} from '@/data/overview';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { Tooltip } from './Tooltip';

const MENU_GAP = 8;
const PANEL_WIDTH = 340;

const SEVERITY_ORDER: OverviewSeverity[] = ['danger', 'warn', 'info'];

const KIND_ORDER: OverviewAttentionKind[] = [
  'task',
  'mail',
  'usage',
  'entitlement',
  'infra',
];

const KIND_LABEL: Record<OverviewAttentionKind, MessageKey> = {
  task: 'shell.notifications.kind.task',
  mail: 'shell.notifications.kind.mail',
  usage: 'shell.notifications.kind.usage',
  entitlement: 'shell.notifications.kind.entitlement',
  infra: 'shell.notifications.kind.infra',
};

const SEVERITY_LABEL: Record<OverviewSeverity, MessageKey> = {
  danger: 'shell.notifications.severity.danger',
  warn: 'shell.notifications.severity.warn',
  info: 'shell.notifications.severity.info',
};

type PanelPos = {
  left: number;
  bottom: number;
  width: number;
};

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
    template,
  );
}

function BellIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10.3 20a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  );
}

function KindIcon({ kind }: { kind: OverviewAttentionKind }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  switch (kind) {
    case 'task':
      return (
        <svg {...props}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="m4.2 6.4 1.2 1.2 2.2-2.4" />
          <path d="m4.2 12.4 1.2 1.2 2.2-2.4" />
          <path d="m4.2 18.4 1.2 1.2 2.2-2.4" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'usage':
      return (
        <svg {...props}>
          <path d="M4 19V10" />
          <path d="M10 19V6" />
          <path d="M16 19v-6" />
          <path d="M22 19V8" />
        </svg>
      );
    case 'entitlement':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5L15 15" />
        </svg>
      );
    case 'infra':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="7" height="7" rx="1.5" />
          <rect x="14" y="4" width="7" height="7" rx="1.5" />
          <rect x="3" y="13" width="7" height="7" rx="1.5" />
          <rect x="14" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
  }
}

function groupBySeverity(items: OverviewAttention[]) {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    items: items
      .filter((item) => item.severity === severity)
      .sort(
        (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
      ),
  })).filter((group) => group.items.length > 0);
}

/** 管理后台 ActivityBar 的通知中心，条目来自平台概览的关注项。 */
export function NotificationCenter() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const adminItems = overviewAttention;
  const listed = adminItems.length;
  const label = t('shell.notifications');
  const groups = useMemo(() => groupBySeverity(adminItems), [adminItems]);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    let left = rect.right + MENU_GAP;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    const bottom = window.innerHeight - rect.bottom;
    setPos({
      left: Math.max(8, left),
      bottom: Math.max(8, bottom),
      width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onReposition = () => updatePosition();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className="os-notifications__panel"
            role="dialog"
            aria-labelledby={`${panelId}-title`}
            style={{
              left: pos.left,
              bottom: pos.bottom,
              width: pos.width,
            }}
          >
            <div className="os-notifications__head">
              <h2 id={`${panelId}-title`} className="os-notifications__title">
                {t('shell.notifications')}
              </h2>
              <p className="os-notifications__meta">
                {listed > 0
                  ? fill(t('shell.notifications.meta'), { count: listed })
                  : t('shell.notifications.empty')}
              </p>
            </div>

            {listed > 0 ? (
              <div className="os-notifications__scroll">
                {groups.map((group) => (
                  <section
                    key={group.severity}
                    className="os-notifications__section"
                    aria-label={t(SEVERITY_LABEL[group.severity])}
                  >
                    <h3
                      className="os-notifications__section-label"
                      data-severity={group.severity}
                    >
                      {t(SEVERITY_LABEL[group.severity])}
                      <span>{group.items.length}</span>
                    </h3>
                    <ul className="os-notifications__list">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <NotificationItem
                            item={item}
                            label={fill(t(item.messageKey), { count: item.count })}
                            kindLabel={t(KIND_LABEL[item.kind])}
                            onClose={close}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="os-notifications__empty">
                {t('shell.notifications.empty')}
              </p>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn('os-notifications', open && 'is-open')}
      data-open={open ? 'true' : undefined}
    >
      <Tooltip label={label}>
        <button
          ref={triggerRef}
          type="button"
          className={cn('os-activity-bar__item', open && 'is-current')}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <BellIcon />
          {listed > 0 ? (
            <span className="os-notifications__badge" aria-hidden>
              {listed > 9 ? '9+' : listed}
            </span>
          ) : null}
        </button>
      </Tooltip>
      {panel}
    </div>
  );
}

function NotificationItem({
  item,
  label,
  kindLabel,
  stay = false,
  onClose,
}: {
  item: OverviewAttention;
  label: string;
  kindLabel: string;
  stay?: boolean;
  onClose: () => void;
}) {
  const body = (
    <>
      <span className="os-notifications__icon" data-kind={item.kind}>
        <KindIcon kind={item.kind} />
      </span>
      <span className="os-notifications__copy">
        <span className="os-notifications__text">{label}</span>
        <span className="os-notifications__kind">{kindLabel}</span>
      </span>
    </>
  );
  if (stay) {
    return (
      <button type="button" className="os-notifications__item" onClick={onClose}>
        {body}
      </button>
    );
  }
  return (
    <Link to={item.href} className="os-notifications__item" onClick={onClose}>
      {body}
    </Link>
  );
}
