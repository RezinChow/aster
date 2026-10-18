/**
 * One SSH process in a host PTY.
 * The reader only fills a buffer. Callers pull it. Keystrokes are written
 * in the order they are queued. Resize is ioctl'd onto the PTY.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFleetNodeSsh } from '../lib/fleetSsh';
import { userInfo } from 'node:os';

export const PTY_DRAIN_CAP = 32 * 1024;

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../scripts/fleet-ssh-pty.c');
const binary = path.resolve(here, '../../scripts/fleet-ssh-pty');

export function fleetSshPtyBinary(): string {
  const sourceTime = statSync(source).mtimeMs;
  const built = existsSync(binary) && statSync(binary).mtimeMs >= sourceTime;
  if (!built) {
    execFileSync('cc', ['-O2', '-o', binary, source], { stdio: 'inherit' });
  }
  return binary;
}

export class FleetSshSession {
  readonly command: string[];
  readonly finished: Promise<number | null>;
  private exitCode: number | null = null;
  private readonly chunks: Buffer[] = [];
  private queued = 0;
  private readonly child: ChildProcessWithoutNullStreams;
  private closed = false;
  private settled = false;
  private resolveFinished: (code: number | null) => void;

  constructor(target: { host: string; user?: string | null }, cols = 80, rows = 24) {
    const plan = planFleetNodeSsh(
      { hostname: target.host, addresses: [target.host] },
      { user: target.user, defaultUser: userInfo().username },
    );
    if (!plan.ok || plan.command == null) {
      throw new Error(
        !plan.ok && plan.reason === 'revoked'
          ? 'revoked node cannot start SSH'
          : 'node address cannot be an SSH target',
      );
    }
    this.command = plan.command;
    this.resolveFinished = () => {};
    this.finished = new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
    const safeCols = Math.max(2, Math.floor(cols));
    const safeRows = Math.max(2, Math.floor(rows));
    this.child = spawn(
      fleetSshPtyBinary(),
      [String(safeCols), String(safeRows), ...this.command],
      { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] },
    ) as ChildProcessWithoutNullStreams;
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.chunks.push(chunk);
      this.queued += chunk.length;
    });
    const finish = (code: number | null) => {
      if (this.settled) return;
      this.settled = true;
      this.closed = true;
      this.exitCode = code;
      this.resolveFinished(code);
    };
    this.child.on('exit', (code) => finish(code));
    this.child.on('error', () => finish(null));
  }

  get exited(): number | null {
    return this.exitCode;
  }

  write(data: string) {
    if (this.closed || data.length === 0) return;
    this.child.stdin.write(data);
  }

  resize(cols: number, rows: number) {
    const safeCols = Math.floor(cols);
    const safeRows = Math.floor(rows);
    if (safeCols < 2 || safeRows < 2) return;
    const control = this.child.stdio[3];
    if (control && 'write' in control) {
      control.write(`resize ${safeCols} ${safeRows}\n`);
    }
  }

  drain(max = PTY_DRAIN_CAP): Buffer {
    const limit = Math.max(0, Math.min(max, PTY_DRAIN_CAP));
    const taken: Buffer[] = [];
    let count = 0;
    while (this.chunks.length > 0 && count < limit) {
      const next = this.chunks[0]!;
      if (count + next.length <= limit) {
        taken.push(this.chunks.shift()!);
        count += next.length;
      } else {
        const need = limit - count;
        taken.push(next.subarray(0, need));
        this.chunks[0] = next.subarray(need);
        count += need;
      }
    }
    this.queued -= count;
    return Buffer.concat(taken);
  }

  close() {
    this.closed = true;
    this.child.kill('SIGHUP');
  }
}
