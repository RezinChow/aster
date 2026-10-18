import { useI18n } from '@/i18n/useI18n';
import { Tooltip } from './Tooltip';

type SidebarToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * Floating seam control (VS Code / Slack style) — not inside ActivityBar.
 * Only rendered when the active domain has a sidebar.
 */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const { t } = useI18n();
  const label = collapsed
    ? t('shell.expandSidebar')
    : t('shell.collapseSidebar');

  return (
    <Tooltip label={label} side="right" className="os-sidebar-toggle-anchor">
      <button
        type="button"
        className="os-sidebar-toggle"
        aria-label={label}
        aria-pressed={!collapsed}
        aria-controls="os-sidebar"
        onClick={onToggle}
      >
        <ChevronIcon collapsed={collapsed} />
      </button>
    </Tooltip>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={
        collapsed
          ? 'os-sidebar-toggle__chevron is-collapsed'
          : 'os-sidebar-toggle__chevron'
      }
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
