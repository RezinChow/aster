import unittest

from handover import require_terminal_allocation


def observed(uid, phase):
    return dict(metadata=dict(uid=uid), status=dict(phase=phase))


class HandoverTests(unittest.TestCase):
    def test_old_job_and_replica_must_both_be_terminal_with_exact_uids(self):
        for phase in ['Succeeded', 'Failed', 'Stopped']:
            require_terminal_allocation(observed('job', phase), observed('replica', phase), 'job', 'replica')
        for job, replica in [(observed('job', 'Running'), observed('replica', 'Running')),
                             (observed('job', 'Succeeded'), observed('replica', 'Running')),
                             (observed('other', 'Succeeded'), observed('replica', 'Succeeded')),
                             (observed('job', 'Succeeded'), observed('other', 'Succeeded')),
                             (observed('job', 'Unknown'), observed('replica', 'Succeeded')),
                             ({}, {})]:
            with self.assertRaises(RuntimeError):
                require_terminal_allocation(job, replica, 'job', 'replica')


if __name__ == '__main__':
    unittest.main()
