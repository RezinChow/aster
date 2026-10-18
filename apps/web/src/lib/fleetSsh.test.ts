import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import {
  FLEET_SSH_BRIDGE_HTTP,
  fleetSshBridgeWs,
  fleetSshCorsOrigin,
  planFleetNodeSsh,
  requestFleetNodeSshSession,
} from './fleetSsh';
import { FleetSshSession } from '../server/fleetSshSession';

const worker = {
  state: 'ready',
  hostname: 'worker-a.example.net',
  addresses: ['10.1.2.3', '127.0.0.1', '169.254.0.1'],
};

function argvText(command: string[]) {
  return command.join(' ');
}

describe('fleet node ssh', () => {
  test('one plan picks the host, the confirmed user, and the ssh argv', () => {
    const account = userInfo().username;
    const picked = planFleetNodeSsh(worker, { user: 'alice' });
    expect(picked.ok).toBe(true);
    if (!picked.ok || picked.command == null) throw new Error('expected a session');
    expect(picked.host).toBe('10.1.2.3');
    expect(picked.destination).toBe('alice@10.1.2.3');
    expect(picked.command[0]).toBe('ssh');
    expect(picked.command).toContain('-tt');
    expect(picked.command).toContain('BatchMode=yes');
    expect(picked.command).toContain('ConnectTimeout=8');
    expect(picked.command).toContain('StrictHostKeyChecking=accept-new');
    expect(picked.command.at(-1)).toBe('alice@10.1.2.3');
    expect(argvText(picked.command)).not.toContain('@orb');

    const byName = planFleetNodeSsh(
      { state: 'ready', hostname: 'worker-a.example.net', addresses: ['127.0.0.1', '169.254.0.1'] },
      { user: 'alice' },
    );
    expect(byName.ok && byName.command?.at(-1)).toBe('alice@worker-a.example.net');

    expect(planFleetNodeSsh({ state: 'revoked', addresses: ['10.1.2.3'] }).ok).toBe(false);
    expect(planFleetNodeSsh({ state: 'revoked', hostname: 'worker-a' }).ok).toBe(false);
    if (!planFleetNodeSsh({ state: 'revoked', addresses: ['10.1.2.3'] }).ok) {
      expect(planFleetNodeSsh({ state: 'revoked', addresses: ['10.1.2.3'] })).toEqual({
        ok: false,
        reason: 'revoked',
      });
    }
    expect(planFleetNodeSsh({ hostname: 'unknown' })).toEqual({ ok: false, reason: 'no-address' });
    expect(planFleetNodeSsh({ hostname: 'ops@node' })).toEqual({ ok: false, reason: 'no-address' });
    expect(planFleetNodeSsh({ hostname: '', addresses: [] })).toEqual({
      ok: false,
      reason: 'no-address',
    });

    const implied = planFleetNodeSsh(worker, { defaultUser: account });
    expect(implied.ok && implied.command?.at(-1)).toBe(`${account}@10.1.2.3`);
    expect(requestFleetNodeSshSession(worker, 'alice').at(-1)).toBe('alice@10.1.2.3');

    const explicit = new FleetSshSession({ host: '10.1.2.3', user: 'alice' }, 80, 24);
    const omitted = new FleetSshSession({ host: '10.1.2.3' }, 80, 24);
    try {
      expect(explicit.command).toEqual(picked.command);
      expect(omitted.command.at(-1)).toBe(`${account}@10.1.2.3`);
      expect(argvText(explicit.command)).not.toContain('@orb');
      expect(argvText(omitted.command)).not.toContain('@orb');
    } finally {
      explicit.close();
      omitted.close();
    }
  });

  test('the cluster page confirms user@host and the terminal keeps the wterm contract', () => {
    const page = readFileSync(new URL('../pages/FleetPage.tsx', import.meta.url), 'utf8');
    const terminal = readFileSync(
      new URL('../pages/FleetSshTerminal.tsx', import.meta.url),
      'utf8',
    );
    const writer = readFileSync(new URL('./orderedPtyWriter.ts', import.meta.url), 'utf8');
    const messages = readFileSync(new URL('../i18n/messages.ts', import.meta.url), 'utf8');
    const sshWindow = readFileSync(
      new URL('../pages/FleetSshWindow.tsx', import.meta.url),
      'utf8',
    );
    expect(page).toContain('planFleetNodeSsh(');
    expect(page).toContain('<FleetSshWindow');
    expect(page).not.toContain('fleet-ssh-user');
    expect(sshWindow).toContain('data-fleet-ssh-window');
    expect(sshWindow).toContain('data-fleet-ssh-destination');
    expect(sshWindow).toContain('os-hub-viewer');
    expect(page).toContain('data-fleet-ssh-reason');
    expect(page).toContain("t('fleet.ssh.revoked')");
    expect(page).toContain("t('fleet.ssh.noAddress')");
    expect(page).not.toContain("requestFleetNodeSshSession(");
    expect(page).not.toMatch(/['"]node['"]/);
    expect(terminal).toContain('@wterm/react');
    expect(terminal).toContain('wterm-terminal.css');
    expect(terminal).not.toContain('@wterm/react/css');
    expect(terminal).not.toContain('clientWidth / 8');
    expect(terminal).toContain('RESIZE_SETTLE_MS');
    expect(terminal).toContain('createOrderedPtyWriter');
    expect(terminal).toContain("type: 'drain'");
    expect(terminal).toContain("message.type === 'exit'");
    expect(terminal).toContain("type: 'close'");
    expect(terminal).toContain("t('fleet.ssh.bridge')");
    expect(terminal).toContain("t('fleet.ssh.rejected')");
    expect(terminal).toContain("t('fleet.ssh.exited')");
    expect(terminal).toContain('onResize');
    expect(terminal).toContain('}, [host, user]);');
    expect(terminal).not.toContain(', wt]');
    const bridge = readFileSync(
      new URL('../server/fleetSshBridge.ts', import.meta.url),
      'utf8',
    );
    expect(fleetSshCorsOrigin('http://127.0.0.1:3100')).toBe('http://127.0.0.1:3100');
    expect(fleetSshCorsOrigin('http://localhost:3100')).toBe('http://localhost:3100');
    expect(fleetSshCorsOrigin('https://evil.example')).toBe('http://127.0.0.1:3100');
    expect(FLEET_SSH_BRIDGE_HTTP).toBe('/fleet-ssh');
    expect(fleetSshBridgeWs({ protocol: 'http:', host: '127.0.0.1:3100' })).toBe(
      'ws://127.0.0.1:3100/fleet-ssh',
    );
    expect(page).toContain('FLEET_SSH_BRIDGE_HTTP');
    expect(bridge).toContain('Access-Control-Allow-Origin');
    expect(bridge).toContain('fleetSshCorsOrigin(');
    expect(bridge).toContain('socket.data.sessionIds');
    expect(bridge).not.toContain('sessions.clear()');
    expect(terminal).not.toContain('@xterm/xterm');
    expect(terminal).not.toContain("@orb");
    expect(terminal).not.toMatch(/\?\?\s*['"]node['"]/);
    expect(writer).toContain('pending += data');
    expect(writer).not.toContain('@xterm/xterm');
    for (const key of [
      'fleet.ssh.revoked',
      'fleet.ssh.noAddress',
      'fleet.ssh.user',
      'fleet.ssh.destination',
      'fleet.ssh.connect',
      'fleet.ssh.minimize',
      'fleet.ssh.restore',
      'fleet.ssh.maximize',
      'fleet.ssh.minimized',
      'fleet.ssh.bridge',
      'fleet.ssh.rejected',
      'fleet.ssh.exited',
    ]) {
      const hits = messages.split(`'${key}':`).length - 1;
      expect(hits).toBe(2);
    }
  });
});
