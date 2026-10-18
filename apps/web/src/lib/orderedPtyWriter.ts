/**
 * Ordered, coalesced PTY writes.
 *
 * The terminal fires `onData` once per key or paste. Concurrent writes can
 * finish out of order. Queue bytes locally, send one in-flight write, and
 * fold everything that arrives during that round trip into the next write.
 */
export function createOrderedPtyWriter(
  write: (data: string) => Promise<void>,
  onError?: (error: unknown) => void,
) {
  let pending = '';
  let inFlight = false;
  let open = false;
  let reportedFailure = false;
  let autoRetried = false;

  const drain = () => {
    if (!open || inFlight || pending.length === 0) return;
    const data = pending;
    pending = '';
    inFlight = true;
    write(data).then(
      () => {
        reportedFailure = false;
        autoRetried = false;
        inFlight = false;
        drain();
      },
      (error: unknown) => {
        pending = data + pending;
        inFlight = false;
        if (!reportedFailure) {
          reportedFailure = true;
          onError?.(error);
        }
        if (!autoRetried) {
          autoRetried = true;
          drain();
        }
      },
    );
  };

  return {
    push(data: string) {
      if (data.length === 0) return;
      pending += data;
      drain();
    },
    start() {
      open = true;
      drain();
    },
  };
}

const DRAIN_CAP = 32 * 1024;

/** Bytes one UI pull may take. Matches the host PTY drain cap. */
export const OUTPUT_DRAIN_CAP = DRAIN_CAP;

export function ptyOutputBytes(message: unknown): Uint8Array | undefined {
  if (message instanceof ArrayBuffer) {
    return new Uint8Array(message.slice(0));
  }
  if (ArrayBuffer.isView(message)) {
    return new Uint8Array(
      message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength,
      ),
    );
  }
  if (
    Array.isArray(message) &&
    message.every((value) => typeof value === 'number')
  ) {
    return Uint8Array.from(message);
  }
  return undefined;
}
