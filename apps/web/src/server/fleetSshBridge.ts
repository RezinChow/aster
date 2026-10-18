/// <reference lib="dom" />
declare const Bun: {
  serve<TData>(options: {
    port: number;
    hostname: string;
    fetch: (request: Request, server: { upgrade: (request: Request, options: { data: TData }) => boolean }) => Response | undefined | Promise<Response | undefined>;
    websocket: {
      message: (socket: { data: TData } & { close: (code?: number) => void; send: (data: string) => void }, raw: string | Buffer) => void;
      open?: (socket: { data: TData }) => void;
      close?: (socket: { data: TData }) => void;
    };
  }): unknown;
};

/**
 * WebSocket bridge so the console can pull a host SSH PTY.
 * Listens on 127.0.0.1:13101.
 */
import { userInfo } from 'node:os';
import { fleetSshCorsOrigin } from '../lib/fleetSsh';
import { FleetSshSession } from './fleetSshSession';

const port = Number(process.env.A3S_FLEET_SSH_PORT ?? 13101);
const sessions = new Map<string, FleetSshSession>();

type SocketData = { sessionIds: string[] };

function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', fleetSshCorsOrigin(request.headers.get('origin')));
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Vary', 'Origin');
  return headers;
}

type ClientMessage = {
  type?: string;
  sessionId?: string;
  host?: string;
  user?: string;
  cols?: number;
  rows?: number;
  data?: string;
};

Bun.serve<SocketData>({
  port,
  hostname: '127.0.0.1',
  fetch(request, server) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (server.upgrade(request, { data: { sessionIds: [] } })) return undefined;
    return Response.json({ user: userInfo().username }, { headers: corsHeaders(request) });
  },
  websocket: {
    message(socket, raw) {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        return;
      }
      if (message.type === 'open' && message.host) {
        let session: FleetSshSession;
        try {
          session = new FleetSshSession(
            { host: message.host, user: message.user },
            message.cols ?? 80,
            message.rows ?? 24,
          );
        } catch (error) {
          socket.send(
            JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'rejected',
            }),
          );
          return;
        }
        const sessionId = `${message.host}-${Date.now().toString(36)}`;
        sessions.set(sessionId, session);
        socket.data.sessionIds.push(sessionId);
        void session.finished.then((code) => {
          socket.send(JSON.stringify({ type: 'exit', sessionId, code }));
          sessions.delete(sessionId);
        });
        socket.send(
          JSON.stringify({
            type: 'opened',
            sessionId,
            destination: session.command.at(-1),
          }),
        );
        return;
      }
      const session = message.sessionId
        ? sessions.get(message.sessionId)
        : undefined;
      if (!session || !message.sessionId) return;
      if (message.type === 'write' && typeof message.data === 'string') {
        session.write(message.data);
        return;
      }
      if (message.type === 'resize') {
        session.resize(message.cols ?? 0, message.rows ?? 0);
        return;
      }
      if (message.type === 'drain') {
        const bytes = session.drain();
        socket.send(
          JSON.stringify({
            type: 'output',
            sessionId: message.sessionId,
            bytes: [...bytes],
          }),
        );
        return;
      }
      if (message.type === 'close') {
        session.close();
        sessions.delete(message.sessionId);
      }
    },
    close(socket) {
      for (const sessionId of socket.data.sessionIds) {
        sessions.get(sessionId)?.close();
        sessions.delete(sessionId);
      }
      socket.data.sessionIds = [];
    },
  },
});

process.stdout.write(`fleet ssh bridge on 127.0.0.1:${port}\n`);
