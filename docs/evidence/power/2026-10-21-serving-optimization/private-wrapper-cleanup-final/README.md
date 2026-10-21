# Private wrapper cleanup

The authorized cleanup stopped the sixteen qualified private Power/Gateway
processes at 05:28:27 UTC. It released Power ports 19500–19507 and Gateway ports
19890–19897. The seventeen production native/Power/Gateway identities remained
equal to the completed eight-card qualification receipt.

The existing controller was invoked once:

```text
python3 supervisor-shared.py stop --gpu 0 1 2 3 4 5 6 7 --slots 2
```

Before stopping, the operation checked each private PID, start ticks, complete
argv, executable hash, listener ownership and service-user UID against its
qualified receipt. The controller stops Gateway before Power and retains
configuration, isolated homes, logs and process receipts. Only its live PID
state files are removed.

| Evidence | Purpose |
| --- | --- |
| [Cleanup receipt](shared-private-wrapper-cleanup-final.json) | Sixteen exits, released ports and production identities before/after |
| [Final read-only check](shared-private-wrapper-cleanup-readonly-final.json) | Later confirmation of the same production identities, sixteen healthy native/Power endpoints and no private listeners |
| [Local verification](local-verification.json) | Exact SHA-256 verification of the seven downloaded allowlisted files |
| [Cleanup source](shared-private-wrapper-cleanup.py) | Fixed scope and qualification/controller pins around the existing stop command |
| [Cleanup process receipt](shared-private-wrapper-cleanup-process.json) and [log](shared-private-wrapper-cleanup.log) | Operation provenance and exit summary |
| [Controller source](supervisor-shared.py) and [fixtures](supervisor_shared_tests.py) | The exact pinned controller used by the operation |

The cleanup receipt SHA-256 is
`50e1c5187cc8151084cb0e21eb618b2d7a03f536a7d1df35ccf97ab29f46d7d1`.
The later read-only receipt SHA-256 is
`2a72c88a0548f01b7e232613da47a3c8dfd5117c15c4d18b1c6c4d966868e981`.

The safe download copied only these source, fixture and content-free proof
files. Production ACLs, credentials, private configuration and isolated home
contents were excluded. No new model request was issued for cleanup or the
final read-only check.

## Explicitly not claimed

- Production process identity proves continuity; the root operator's separate
  typed geometry and authenticated probes prove their respective contracts.
- Production idleness is not inferred from private wrapper cleanup.
- The Gateway check here concerns its active systemd identity and listener;
  the separate public qualification supplies its authenticated HTTP proof.
