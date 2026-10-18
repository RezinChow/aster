import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { FrameCorners, Minus, X } from '@phosphor-icons/react';
import { IconTerminal } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { FleetSshTerminal } from '@/pages/FleetSshTerminal';
import '@/styles/fleet-ssh-window.css';

const MIN_WINDOW = { w: 320, h: 180 };
const DEFAULT_SIZE = { w: 880, h: 520 };

/**
 * Movable SSH window. The title bar drags, the edges resize, and the
 * terminal connects as soon as the console account is known.
 */
export function FleetSshWindow({
  name,
  host,
  user,
  accountFailed,
  onClose,
}: {
  name: string;
  host: string;
  user: string | null;
  accountFailed: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [pos, setPos] = useState(() => {
    const width = Math.min(DEFAULT_SIZE.w, window.innerWidth - 16);
    const height = Math.min(DEFAULT_SIZE.h, window.innerHeight - 16);
    return {
      x: Math.max(8, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(8, Math.round((window.innerHeight - height) / 2)),
      w: width,
      h: height,
    };
  });
  const [maximized, setMaximized] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const restoreRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{
    dir: 'e' | 's' | 'se';
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragOffset.current) {
        setPos((current) => ({
          ...current,
          x: Math.min(
            Math.max(event.clientX - dragOffset.current!.dx, 8),
            window.innerWidth - MIN_WINDOW.w,
          ),
          y: Math.min(
            Math.max(event.clientY - dragOffset.current!.dy, 8),
            window.innerHeight - 44,
          ),
        }));
        return;
      }
      const start = resizeStart.current;
      if (!start) return;
      setPos((current) => {
        const next = { ...current };
        if (start.dir === 'e' || start.dir === 'se') {
          next.w = Math.min(
            Math.max(event.clientX - start.x + start.w, MIN_WINDOW.w),
            window.innerWidth - current.x - 4,
          );
        }
        if (start.dir === 's' || start.dir === 'se') {
          next.h = Math.min(
            Math.max(event.clientY - start.y + start.h, MIN_WINDOW.h),
            window.innerHeight - current.y - 4,
          );
        }
        return next;
      });
    };
    const onUp = () => {
      dragOffset.current = null;
      resizeStart.current = null;
      document.body.classList.remove('os-window-dragging');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const startDrag = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (maximized) return;
    document.body.classList.add('os-window-dragging');
    dragOffset.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y };
  };

  const startResize = (dir: 'e' | 's' | 'se') => (event: ReactPointerEvent) => {
    if (maximized || minimized) return;
    event.preventDefault();
    document.body.classList.add('os-window-dragging');
    resizeStart.current = { dir, x: event.clientX, y: event.clientY, w: pos.w, h: pos.h };
  };

  const toggleMaximize = () => {
    if (maximized) {
      const saved = restoreRef.current;
      if (saved) setPos(saved);
      setMaximized(false);
      return;
    }
    restoreRef.current = pos;
    setMaximized(true);
    setMinimized(false);
  };

  const frameStyle = maximized
    ? { left: 8, top: 8, width: window.innerWidth - 16, height: window.innerHeight - 16 }
    : { left: pos.x, top: pos.y, width: pos.w, height: pos.h };

  const destination = user ? `${user}@${host}` : host;

  const windowEl = createPortal(
    <div
      className="os-hub-viewer fleet-ssh-window"
      role="dialog"
      aria-label={`${t('fleet.action.ssh')} · ${name}`}
      data-fleet-ssh-window="true"
      data-maximized={maximized ? 'true' : undefined}
      hidden={minimized}
      style={frameStyle}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <header
        className="os-hub-viewer__bar"
        onPointerDown={startDrag}
        onDoubleClick={() => {
          if (!minimized) toggleMaximize();
        }}
      >
        <IconTerminal />
        <strong className="fleet-ssh-window__title">{name}</strong>
        <span className="fleet-ssh-window__dest" data-fleet-ssh-destination="true">
          {destination}
        </span>
        <span className="os-hub-viewer__spacer" aria-hidden="true" />
        <button
          type="button"
          aria-label={t('fleet.ssh.minimize')}
          title={t('fleet.ssh.minimize')}
          onClick={() => setMinimized(true)}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          aria-label={maximized ? t('fleet.ssh.restore') : t('fleet.ssh.maximize')}
          title={maximized ? t('fleet.ssh.restore') : t('fleet.ssh.maximize')}
          onClick={toggleMaximize}
        >
          <FrameCorners size={14} />
        </button>
        <button type="button" aria-label={t('dialog.close')} title={t('dialog.close')} onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <div className="os-hub-viewer__body">
        {user ? (
          <FleetSshTerminal host={host} user={user} />
        ) : accountFailed ? (
          <p className="fleet-ssh-window__alert" role="alert" data-fleet-ssh-error="true">
            {t('fleet.ssh.bridge')}
          </p>
        ) : null}
      </div>
      {!maximized && !minimized ? (
        <>
          <span className="os-hub-viewer__rz" data-dir="e" onPointerDown={startResize('e')} aria-hidden="true" />
          <span className="os-hub-viewer__rz" data-dir="s" onPointerDown={startResize('s')} aria-hidden="true" />
          <span className="os-hub-viewer__rz" data-dir="se" onPointerDown={startResize('se')} aria-hidden="true" />
        </>
      ) : null}
    </div>,
    document.body,
  );

  const taskbar = minimized
    ? createPortal(
        <div className="os-hub-taskbar" role="toolbar" aria-label={t('fleet.ssh.minimized')}>
          <button
            type="button"
            className="os-hub-taskbar__item"
            data-active="true"
            onClick={() => setMinimized(false)}
            title={t('fleet.ssh.restore')}
          >
            <IconTerminal />
            <span>{name}</span>
          </button>
          <button
            type="button"
            className="os-hub-taskbar__close"
            aria-label={t('dialog.close')}
            title={t('dialog.close')}
            onClick={onClose}
          >
            <X size={12} />
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {windowEl}
      {taskbar}
    </>
  );
}
