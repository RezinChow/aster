"""GPU-only finite capture; persist only eligible IPv4 TCP header metadata."""
import datetime
import hashlib
import json
from pathlib import Path
import select
import socket
import struct
import time


def main():
    target = Path('/code/Power/.git/optimization-20261021/tcp-headers2.json')
    if target.exists():
        raise RuntimeError('existing evidence retained')
    start = time.monotonic()
    rows = []
    skipped = 0
    with socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3)) as capture:
        capture.bind(('bond0', 0))
        print(json.dumps({'capture_ready': True, 'duration_seconds': 35, 'snapshot_bytes': 54}), flush=True)
        while time.monotonic() - start < 35 and len(rows) < 3000:
            ready, _, _ = select.select([capture], [], [], 0.2)
            if not ready:
                continue
            packet, address = capture.recvfrom(54)
            # Exactly Ethernet(14)+IPv4(20)+TCP(20) for eligible TCP packets.
            # Truncation precedes the userspace protocol filter, so another
            # protocol's prefix can be received; no raw bytes are persisted.
            if len(packet) < 54 or packet[12:14] != b'\x08\x00' or packet[14] != 0x45 or packet[23] != 6:
                skipped += 1
                continue
            if struct.unpack('!H', packet[20:22])[0] & 0x1FFF:
                continue
            source, dest, seq, ack, flags, window = struct.unpack('!HHIIHH', packet[34:50])
            if 8080 not in (source, dest):
                continue
            rows.append({'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                         'elapsed_ms': round(1000 * (time.monotonic() - start), 3),
                         'direction': 'outgoing' if address[2] == socket.PACKET_OUTGOING else 'incoming',
                         'peer_ip_sha256': hashlib.sha256(socket.inet_ntoa(packet[30:34] if source == 8080 else packet[26:30]).encode()).hexdigest(),
                         'peer_port': dest if source == 8080 else source,
                         'seq': seq, 'ack': ack, 'flags': flags & 0x1FF,
                         'ttl': packet[22], 'ip_id': struct.unpack('!H', packet[18:20])[0],
                         'ip_total_length': struct.unpack('!H', packet[16:18])[0], 'window': window})
        statistics = struct.unpack('II', capture.getsockopt(263, 6, 8))
    result = {'scope': 'read-only GPU bond0 header metadata, all port8080 peers; not unique attribution to a user',
              'snapshot_bytes': 54, 'application_bytes_persisted': False,
              'snapshot_precedes_userspace_protocol_filter': True, 'raw_capture_persisted': False,
              'elapsed_seconds': time.monotonic() - start, 'kernel_packets': statistics[0],
              'kernel_drops': statistics[1], 'other_layouts_skipped': skipped, 'packets': rows}
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'saved_private_metadata': target.name, 'packets': len(rows),
                      'kernel_drops': statistics[1], 'capture_socket_closed': True}), flush=True)


if __name__ == '__main__':
    main()
