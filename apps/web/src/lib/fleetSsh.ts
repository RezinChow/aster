/**
 * One SSH plan for a cluster node.
 * The host is the node's usable reported IPv4, otherwise its usable hostname.
 * The user is the account the operator typed, otherwise the console host's
 * OS account. Revoked nodes and nodes without a usable host do not start.
 */

export type FleetNodeSshIdentity = {
  state?: string | null;
  hostname?: string | null;
  addresses?: readonly string[] | null;
};

export type FleetNodeSshRefusal = 'revoked' | 'no-address';

export type FleetNodeSshPlan =
  | {
      ok: true;
      host: string;
      user: string;
      destination: string;
      command: string[];
    }
  | {
      ok: true;
      host: string;
      user: '';
      destination: '';
      command: null;
    }
  | {
      ok: false;
      reason: FleetNodeSshRefusal;
    };

const USER_NAME = /^[a-z_][a-z0-9_-]{0,31}$/i;

/** Same-origin path. The console dev server proxies it to the host SSH bridge. */
export const FLEET_SSH_BRIDGE_HTTP = '/fleet-ssh';

export function fleetSshBridgeWs(locationLike?: {
  protocol: string;
  host: string;
}): string {
  const here = locationLike ?? (typeof location === 'undefined' ? undefined : location);
  if (!here) return 'ws://127.0.0.1:3100/fleet-ssh';
  const protocol = here.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${here.host}/fleet-ssh`;
}

const LOOPBACK_PAGE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

/** Origin the console page may use when reading the bridge's default user. */
export function fleetSshCorsOrigin(origin: string | null | undefined): string {
  if (origin && LOOPBACK_PAGE.test(origin)) return origin;
  return 'http://127.0.0.1:3100';
}

export function planFleetNodeSsh(
  node: FleetNodeSshIdentity,
  options?: { user?: string | null; defaultUser?: string | null },
): FleetNodeSshPlan {
  if (node.state === 'revoked') return { ok: false, reason: 'revoked' };
  const host = selectHost(node);
  if (!host) return { ok: false, reason: 'no-address' };
  const typed = options?.user?.trim() ?? '';
  const fallback = options?.defaultUser?.trim() ?? '';
  const user = typed || fallback;
  if (!user) {
    return { ok: true, host, user: '', destination: '', command: null };
  }
  if (!USER_NAME.test(user)) {
    return { ok: true, host, user: '', destination: '', command: null };
  }
  return {
    ok: true,
    host,
    user,
    destination: `${user}@${host}`,
    command: sshCommand(user, host),
  };
}

export function fleetNodeSshHost(node: FleetNodeSshIdentity): string | null {
  if (node.state === 'revoked') return null;
  return selectHost(node);
}

export function fleetNodeSshCommand(input: { host: string; user: string }): string[] {
  const plan = planFleetNodeSsh(
    { hostname: input.host, addresses: [input.host] },
    { user: input.user },
  );
  if (!plan.ok || plan.command == null) {
    throw new Error(
      !plan.ok && plan.reason === 'revoked'
        ? 'revoked node cannot start SSH'
        : 'node address cannot be an SSH target',
    );
  }
  return plan.command;
}

/** Command the cluster SSH action asks the host PTY to run. */
export function requestFleetNodeSshSession(
  node: FleetNodeSshIdentity,
  user: string,
  defaultUser?: string,
): string[] {
  const plan = planFleetNodeSsh(node, { user, defaultUser });
  if (!plan.ok || plan.command == null) {
    throw new Error(
      !plan.ok && plan.reason === 'revoked'
        ? 'revoked node cannot start SSH'
        : 'node has no SSH address',
    );
  }
  return plan.command;
}

function selectHost(node: FleetNodeSshIdentity): string | null {
  const address = (node.addresses ?? []).find(isUsableIpv4);
  if (address) return address;
  const hostname = node.hostname?.trim() ?? '';
  if (!hostname || hostname === 'unknown' || hostname.includes('@')) return null;
  if (!isSshHostname(hostname)) return null;
  return hostname;
}

function sshCommand(user: string, host: string): string[] {
  return [
    'ssh',
    '-tt',
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=8',
    '-o',
    'StrictHostKeyChecking=accept-new',
    `${user}@${host}`,
  ];
}

function isUsableIpv4(value: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  const parts = value.split('.').map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part > 255)) return false;
  const [first, second] = parts;
  if (first === 0 || first === 127 || first >= 224) return false;
  if (first === 169 && second === 254) return false;
  return true;
}

function isSshHostname(value: string): boolean {
  if (!value || value.length > 253 || value.includes('@') || /\s/.test(value)) {
    return false;
  }
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(value);
}
