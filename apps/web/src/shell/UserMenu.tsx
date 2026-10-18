import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  setLocale,
  setTheme,
  usePrefs,
  type Locale,
  type Theme,
} from '@/prefs/store';
import { logoutUser, setUserSession } from '@/lib/identityApi';
import { clearKeepAliveCaches } from './KeepAliveOutlet';
import { BrandMark } from './BrandMark';
import { ProfileDialog } from './ProfileDialog';
import { useProfile } from './profileStore';
import { Tooltip } from './Tooltip';

const USER_NAME_KEY = 'shell.localUser' as const;
const MENU_GAP = 8;

type MenuPos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

type UserMenuProps = {
  /** Icon-only trigger for the collapsed activity bar footer. */
  compact?: boolean;
  /** Replaces the admin sign-out path. The org center uses its own session. */
  onSignOut?: () => void | Promise<void>;
  /** Corner avatar opens downward; the activity-bar avatar opens upward. */
  menuPlacement?: 'above' | 'below';
  /** Compact triggers show the display name on hover unless this is false. */
  tooltip?: boolean;
  /** Visible account label. Omit to use the local console nickname. */
  name?: string;
  /** Extra rows under the identity block. The personal center uses this for password change. */
  accountActions?: { id: string; label: string; onSelect: () => void }[];
};

export function UserMenu({
  compact = false,
  onSignOut,
  menuPlacement = 'above',
  tooltip = true,
  name,
  accountActions = [],
}: UserMenuProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { theme, locale } = usePrefs();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const profile = useProfile();
  const userName = name ?? (profile.name || t(USER_NAME_KEY));

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = compact || menuPlacement === 'below' ? 248 : Math.max(rect.width, 248);
    const left =
      menuPlacement === 'below'
        ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
        : compact
          ? Math.min(rect.left, window.innerWidth - width - 8)
          : rect.left;
    setPos(
      menuPlacement === 'below'
        ? { left, top: rect.bottom + MENU_GAP, width }
        : { left, bottom: window.innerHeight - rect.top + MENU_GAP, width },
    );
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, compact, menuPlacement]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
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

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(userName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const signOut = async () => {
    setOpen(false);
    if (onSignOut) {
      await onSignOut();
      return;
    }
    try {
      await logoutUser();
    } catch {
      /* clear local session anyway */
    }
    setUserSession(null, null);
    clearKeepAliveCaches();
    navigate('/admin/login', { replace: true });
  };

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="os-user-menu__dropdown"
            role="menu"
            style={{
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
            }}
          >
            <div className="os-user-menu__identity">
              <span
                className="os-user-menu__avatar os-user-menu__avatar--lg"
                aria-hidden
              >
                <UserAvatar src={profile.avatarDataUrl} size={20} />
              </span>
              <span className="os-user-menu__identity-name">{userName}</span>
              <button
                type="button"
                className="os-user-menu__icon-btn"
                aria-label={copied ? t('shell.copied') : t('shell.copyName')}
                title={copied ? t('shell.copied') : t('shell.copyName')}
                onClick={copyName}
              >
                <CopyIcon />
              </button>
            </div>

            <div className="os-user-menu__list" role="none">
              <button
                type="button"
                className="os-user-menu__row"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
              >
                <UserIcon />
                <span>{t('shell.profile.edit')}</span>
              </button>
              {accountActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="os-user-menu__row"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                >
                  <KeyIcon />
                  <span>{action.label}</span>
                </button>
              ))}
              <div className="os-user-menu__row os-user-menu__row--static" role="none">
                <PaletteIcon />
                <span>{t('shell.appearance')}</span>
                <div
                  className="os-user-menu__segmented"
                  role="group"
                  aria-label={t('shell.appearance')}
                >
                  {(
                    [
                      { value: 'light' as Theme, label: t('shell.themeLightShort') },
                      { value: 'dark' as Theme, label: t('shell.themeDarkShort') },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'os-user-menu__segment',
                        theme === option.value && 'is-active',
                      )}
                      aria-pressed={theme === option.value}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="os-user-menu__row os-user-menu__row--static" role="none">
                <LangIcon />
                <span>{t('shell.language')}</span>
                <div
                  className="os-user-menu__segmented"
                  role="group"
                  aria-label={t('shell.language')}
                >
                  {(
                    [
                      { value: 'zh' as Locale, label: t('shell.localeZh') },
                      { value: 'en' as Locale, label: t('shell.localeEn') },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'os-user-menu__segment',
                        locale === option.value && 'is-active',
                      )}
                      aria-pressed={locale === option.value}
                      onClick={() => setLocale(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="os-user-menu__logout"
              role="menuitem"
              onClick={signOut}
            >
              <LogoutIcon />
              <span>{t('shell.logout')}</span>
            </button>
          </div>,
          document.body,
        )
      : null;

  const compactTrigger = (
    <button
      ref={triggerRef}
      type="button"
      className="os-user-menu__trigger os-user-menu__trigger--compact"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      aria-label={t('shell.userMenu')}
      onClick={() => setOpen((value) => !value)}
    >
      <span className="os-user-menu__avatar" aria-hidden>
        <UserAvatar src={profile.avatarDataUrl} size={20} />
      </span>
    </button>
  );

  return (
    <>
      <div
        className={cn(
          'os-user-menu',
          compact ? 'os-user-menu--compact' : 'os-user-menu--sidebar',
        )}
        ref={rootRef}
        data-open={open ? 'true' : undefined}
      >
        {compact ? (
          tooltip ? (
            <Tooltip label={open ? '' : userName}>{compactTrigger}</Tooltip>
          ) : (
            compactTrigger
          )
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className="os-user-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={t('shell.userMenu')}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="os-user-menu__avatar" aria-hidden>
              <UserAvatar src={profile.avatarDataUrl} size={18} />
            </span>
            <span className="os-user-menu__name">{userName}</span>
          </button>
        )}
        {menu}
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

function UserAvatar({ src, size }: { src: string | null; size: number }) {
  if (src) {
    return <img src={src} alt="" width={size} height={size} />;
  }
  return <BrandMark size={size} alt="" />;
}

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19a6.5 6.5 0 0 1 13 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M4 12h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="m7 8.5-3.5 3.5L7 15.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="15" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10.5 13.2 20 4.5M16.5 7.5l2 2M14 9.5l2 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5a8.5 8.5 0 1 0 0 17h1.2a2.3 2.3 0 0 0 0-4.6H12a2.2 2.2 0 0 1 0-4.4h3.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="9.5" cy="7.2" r="1" fill="currentColor" />
      <circle cx="13.2" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function LangIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4.5 12h15M12 4.5c2.2 2.4 3.3 5 3.3 7.5s-1.1 5.1-3.3 7.5c-2.2-2.4-3.3-5-3.3-7.5s1.1-5.1 3.3-7.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}
