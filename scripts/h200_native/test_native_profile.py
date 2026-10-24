"""Profile ownership must reject recycled and foreign PIDs before any signal."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import native_profile


class ProfileOwnershipTests(unittest.TestCase):
    @patch.object(native_profile.os, 'getuid', return_value=0, create=True)
    def test_receipt_requires_the_live_exact_process_and_binary(self, _uid):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            _uid.return_value = root.stat().st_uid
            binary = root / 'native'
            proc = root / 'proc'
            process = proc / '7'
            process.mkdir(parents=True)
            fields = ['S'] + ['0'] * 18 + ['123']
            (process / 'stat').write_text('7 (native with spaces) ' + ' '.join(fields))
            receipt = dict(pid=7, start_ticks=123, uid=os.getuid(), binary=str(binary))
            path = root / 'profile-target-process.json'
            path.write_text(json.dumps(receipt))
            self.assertEqual(native_profile.verified_target(root, binary, proc), receipt)
            for change in [dict(start_ticks=124), dict(uid=os.getuid() + 1),
                           dict(binary=str(root / 'other')), dict(pid=True), dict(extra=0)]:
                path.write_text(json.dumps(receipt | change))
                with self.assertRaises(RuntimeError):
                    native_profile.verified_target(root, binary, proc)

    def test_pid_reuse_after_pidfd_open_never_receives_a_signal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'profile-target-process.json').touch()
            with patch.object(native_profile, 'verified_target',
                              side_effect=[dict(pid=7), RuntimeError('recycled PID')]), \
                 patch.object(native_profile.os, 'pidfd_open', return_value=21, create=True), \
                 patch.object(native_profile.signal, 'pidfd_send_signal', create=True) as send, \
                 patch.object(native_profile.os, 'close') as close:
                with self.assertRaisesRegex(RuntimeError, 'recycled'):
                    native_profile.stop_target(root, root / 'native')
                send.assert_not_called()
                close.assert_called_once_with(21)


if __name__ == '__main__':
    unittest.main()
