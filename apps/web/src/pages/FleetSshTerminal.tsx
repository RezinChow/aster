import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal, useTerminal } from '@wterm/react';
import '@/styles/wterm-terminal.css';
import {
  createOrderedPtyWriter,
  OUTPUT_DRAIN_CAP,
  ptyOutputBytes,
} from '@/lib/orderedPtyWriter';
import { fleetSshBridgeWs, planFleetNodeSsh } from '@/lib/fleetSsh';
import { useI18n } from '@/i18n/useI18n';

const OUTPUT_IDLE_MS = 32;
const MIN_COLS = 2;
const MIN_ROWS = 2;
/** PTY winsize follows the settled window, not every drag frame. */
const RESIZE_SETTLE_MS = 150;

/**
 * SSH pane for one confirmed user and host.
 * wterm paints cells. Keystrokes are ordered into the host PTY with no local
 * echo. Output is pulled and painted. Resize is mirrored to the PTY.
 * The account passed in is the account that is dialed.
 */
export function FleetSshTerminal({
  host,
  user,
}: {
  host: string;
  user: string;
}) {
  const { t } = useI18n();
  const { ref, write, focus } = useTerminal();
  const hostRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const writerRef = useRef<ReturnType<typeof createOrderedPtyWriter> | null>(null);
  const writeRef = useRef(write);
  const focusRef = useRef(focus);
  const tRef = useRef(t);
  const geometryRef = useRef<{ cols: number; rows: number } | null>(null);
  const openRef = useRef<(() => void) | null>(null);
  const resizeTimerRef = useRef(0);
  writeRef.current = write;
  focusRef.current = focus;
  tRef.current = t;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const plan = planFleetNodeSsh(
      { hostname: host, addresses: [host] },
      { user },
    );
    if (!plan.ok || plan.command == null || plan.destination !== `${user}@${host}`) {
      setError(tRef.current('fleet.ssh.rejected'));
      return;
    }
    let disposed = false;
    let opened = false;
    let openedCols = 0;
    let openedRows = 0;
    let outputTimer = 0;
    let outputInFlight = false;
    let outputAgain = false;
    const socket = new WebSocket(fleetSshBridgeWs());
    socketRef.current = socket;

    const pullOutput = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || disposed || socket.readyState !== WebSocket.OPEN) return;
      if (outputInFlight) {
        outputAgain = true;
        return;
      }
      outputInFlight = true;
      socket.send(JSON.stringify({ type: 'drain', sessionId }));
    };

    const writer = createOrderedPtyWriter(async (data) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || socket.readyState !== WebSocket.OPEN) {
        throw new Error(tRef.current('fleet.ssh.exited').replace('{code}', ''));
      }
      socket.send(JSON.stringify({ type: 'write', sessionId, data }));
      window.clearTimeout(outputTimer);
      pullOutput();
    }, () => {
      if (!disposed) setError(tRef.current('fleet.ssh.exited').replace('{code}', ''));
    });
    writerRef.current = writer;

    const openSession = () => {
      if (disposed || opened || socket.readyState !== WebSocket.OPEN) return;
      const size = geometryRef.current;
      if (!size) return;
      opened = true;
      openedCols = size.cols;
      openedRows = size.rows;
      socket.send(JSON.stringify({
        type: 'open',
        host,
        user,
        cols: size.cols,
        rows: size.rows,
      }));
    };
    openRef.current = openSession;

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        type?: string;
        sessionId?: string;
        bytes?: number[];
        code?: number | null;
      };
      if (message.type === 'error') {
        if (!disposed) setError(tRef.current('fleet.ssh.rejected'));
        return;
      }
      if (message.type === 'exit' && message.sessionId === sessionIdRef.current) {
        if (!disposed) {
          setError(tRef.current('fleet.ssh.exited').replace('{code}', String(message.code ?? '')));
        }
        return;
      }
      if (message.type === 'opened' && message.sessionId) {
        opened = true;
        sessionIdRef.current = message.sessionId;
        const size = geometryRef.current;
        if (
          size &&
          socket.readyState === WebSocket.OPEN &&
          (size.cols !== openedCols || size.rows !== openedRows)
        ) {
          socket.send(JSON.stringify({
            type: 'resize',
            sessionId: message.sessionId,
            cols: size.cols,
            rows: size.rows,
          }));
        }
        writer.start();
        pullOutput();
        focusRef.current();
        return;
      }
      if (message.type !== 'output' || message.sessionId !== sessionIdRef.current) {
        return;
      }
      outputInFlight = false;
      const bytes = ptyOutputBytes(message.bytes);
      if (bytes && bytes.byteLength > 0) {
        const live = ref.current;
        if (live) live.write(bytes);
        else writeRef.current(bytes);
      }
      if (disposed) return;
      const delay =
        bytes && bytes.byteLength >= OUTPUT_DRAIN_CAP ? 0 : OUTPUT_IDLE_MS;
      if (outputAgain) {
        outputAgain = false;
        pullOutput();
        return;
      }
      outputTimer = window.setTimeout(pullOutput, delay);
    });

    socket.addEventListener('open', () => {
      if (disposed) return;
      openSession();
    });
    socket.addEventListener('error', () => {
      if (!disposed) setError(tRef.current('fleet.ssh.bridge'));
    });
    socket.addEventListener('close', () => {
      if (!disposed && !opened) setError(tRef.current('fleet.ssh.bridge'));
    });

    return () => {
      disposed = true;
      window.clearTimeout(outputTimer);
      window.clearTimeout(resizeTimerRef.current);
      const sessionId = sessionIdRef.current;
      if (sessionId && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'close', sessionId }));
      }
      socket.close();
      socketRef.current = null;
      sessionIdRef.current = null;
      writerRef.current = null;
      openRef.current = null;
    };
  }, [host, user]);

  const onData = useCallback((data: string) => {
    writerRef.current?.push(data);
  }, []);

  const onResize = useCallback((cols: number, rows: number) => {
    const safeCols = Math.floor(cols);
    const safeRows = Math.floor(rows);
    if (safeCols < MIN_COLS || safeRows < MIN_ROWS) return;
    geometryRef.current = { cols: safeCols, rows: safeRows };
    const sessionId = sessionIdRef.current;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!sessionId) {
      openRef.current?.();
      return;
    }
    window.clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = window.setTimeout(() => {
      const currentId = sessionIdRef.current;
      const live = socketRef.current;
      const size = geometryRef.current;
      if (!currentId || !live || live.readyState !== WebSocket.OPEN || !size) return;
      live.send(JSON.stringify({
        type: 'resize',
        sessionId: currentId,
        cols: size.cols,
        rows: size.rows,
      }));
    }, RESIZE_SETTLE_MS);
  }, []);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden"
      data-fleet-ssh-terminal="true"
      data-fleet-ssh-engine="wterm"
    >
      {error ? (
        <p className="p-3 text-sm text-danger" role="alert" data-fleet-ssh-error="true">
          {error}
        </p>
      ) : null}
      <Terminal
        ref={ref}
        autoResize
        cursorBlink
        onData={onData}
        onResize={onResize}
      />
    </div>
  );
}
