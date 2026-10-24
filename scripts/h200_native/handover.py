"""A new allocation may follow only the exact previous allocation's end."""


def require_terminal_allocation(job, replica, expected_job_uid, expected_replica_uid):
    if (job.get('metadata', {}).get('uid') != expected_job_uid
            or replica.get('metadata', {}).get('uid') != expected_replica_uid):
        raise RuntimeError('previous allocation identity changed; no new submission')
    terminal = ('Succeeded', 'Failed', 'Stopped')
    if (job.get('status', {}).get('phase') not in terminal
            or replica.get('status', {}).get('phase') not in terminal):
        raise RuntimeError('previous allocation is still live or uncertain; observe the same job')
