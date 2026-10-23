# Static Web hosting implementation evidence

Date: 2026-10-24. Objective: 完成静态 Web 托管服务.
Execution plan: `specs/014-static-web-hosting/`.

## Result

Paused at the user's request; the user subsequently requested a local checkpoint
commit without further implementation. The first contract-consumption slice has passed 57 static-target
regressions and 340 Gateway configuration regressions, including 10 new
contract tests. WEB0 as a product is not yet complete; no roadmap gate is
promoted by this record.

## Initial state

- Root HEAD `3bb22139`; Cloud `2ff9eedb8a245d42e57b386849a10c5c2d815420`;
  API `7091f8081c697d57d9dfdaadec51c8c3a2600c75`.
- Existing Cloud projection contains canonical `sha256:` references and a
  fixed `delivery` block. Gateway only admitted bare hex digests and silently
  ignored unknown fields/blocks and duplicate static entries/target names.
- Cloud-managed mode still refuses static targets without a trusted object
  authority. That refusal is preserved by the first slice.
- Cloud still injects Unavailable hosted Web output materialization and its
  hosted build plan is an OCI component stub. These remain implementation work.

## What changed

- Gateway consumes the exact retained Cloud WEB0.1 fixture, normalizing only
  canonical `sha256:` or legacy bare hex into its existing runtime digest.
- Explicit delivery policy is validated against the implemented fixed
  manifest/nosniff/no-cache/immutable/SPA-exclusion contract. Unknown or changed
  policy is refused; absent policy preserves legacy standalone defaults.
- Target, manifest, entry and delivery boundaries reject unknown fields,
  nested blocks, invalid labels and duplicate identities. Duplicate target or
  entry names cannot silently replace an admitted declaration.
- Tests live in the sibling `config/static_bundle_contract_tests.rs`.
- Added a bounded, digest-verifying read-only deployment object adapter and S3
  client with bootstrap-only endpoint/credential references. Managed runtime and
  snapshot wiring is present, but its integration/recovery proof remains pending.
- Fixture SHA-256: `3ef4d56e09cf9aa6c8b381653ab6b2e266c9592dcdc36408614136a6b20431f8`.
  It is a byte-for-byte copy of the pinned Cloud contract, not an edited
  Gateway-only rendering.

## Commands and counts

- `cargo test --locked --offline -p a3s-gateway --lib static_bundle_contract_accepts_exact_cloud_projection -- --exact --nocapture`
  compiled the test binary but selected **0 tests**, because `--exact` requires
  the fully qualified name. This is explicitly not counted as a test pass.
- Red proof, before changing production behavior:
  `target/debug/deps/a3s_gateway-d9ae1514dd41283d.exe config::static_bundle_contract_tests::static_bundle_contract_accepts_exact_cloud_projection --exact --nocapture`
  → **0 passed, 1 failed**. Failure: `static bundle release_digest must be a
  lowercase sha256 hex digest` while validating the real Cloud fixture.
- Green: `cargo test --locked --offline -p a3s-gateway --lib static_bundle_contract_tests -- --nocapture`
  → **8 passed, 0 failed, 0 ignored**. Covers exact Cloud projection, legacy
  defaults, unknown algorithms/noncanonical values, delivery drift, unknown
  fields, duplicate/unknown blocks, duplicate entries/targets, and preserved
  managed-authority refusal.
- Added adversarial identity/type-coercion/nested-entry scenarios; these are
  included in the later 10-test contract population.
- First broader `static_` run → **54 passed, 1 failed**. The existing non-HTTP
  listener test used `abc` placeholder digests and now failed earlier at digest
  syntax admission. Re-ran that exact failure alone and reproduced it. Replaced
  only its placeholder digests with valid hex, retaining both exact TCP/UDP
  refusal assertions; the test continues testing the intended listener boundary.
  Raw output retained in `gateway-static-tests.log`.
- Final `cargo test --locked --offline -p a3s-gateway --lib static_ -- --nocapture`
  → **57 passed, 0 failed, 0 ignored**; raw output
  `gateway-static-tests-final.log`. Includes real loopback listener GET/SPA,
  middleware, HEAD/conditional/Range, sealed compression, cache and in-flight
  drain/replacement regressions.
- `cargo test --locked --offline -p a3s-gateway --lib config:: -- --test-threads=1`
  → **340 passed, 0 failed, 0 ignored**; `gateway-config-tests.log`.
- Root `cargo fmt --all -- --check` → **Windows os error 206** (command line
  too long), not a formatting verdict. Retained in `workspace-fmt.log`.
  Individual changed Rust files were formatted with rustfmt; package check
  recorded separately as work proceeds.
- Latest `cargo test --locked --offline -p a3s-gateway --lib deployment_static_ -- --nocapture`
  → **12 passed, 0 failed, 0 ignored**; raw output
  `gateway-deployment-read-tests-repaired.log`. Covers exact release/tenant key
  binding, size/digest checks, bounded reads/timeouts, credential handling and
  actual signed loopback S3 HEAD/GET with redirects refused. The earlier failed
  compilation is retained in `gateway-deployment-read-tests-final.log`.
  The 57/340 regression runs predate the managed wiring; they were not rerun
  after those changes. No further implementation or testing was performed after
  the user's stop instruction.

## External-state observation

Bounded TCP probes on host loopback found ports 5432, 54320, 9000, 18090,
8080 and 7641 closed. This is not a conclusion about all possible external
providers. WSL reports Rust 1.97.1 and KVM available; no `psql` or `a3s-box`
was found on its PATH. This leaves a usable Linux/KVM route for later actual
Box qualification; missing local services are not declared an external blocker.

## Follow-ups retained from adversarial review

- T002: managed bootstrap owns object-authority credentials/configuration;
  snapshots must not be allowed to provide or replace them, including after
  journal recovery. Preserve prior snapshot after any rejected successor.
- T002: existing response code labels every non-entry path immutable for a
  year. Prove content/release addressing before allowing that cache policy;
  otherwise use revalidation to prevent stale assets on root-path updates.
- T004: build request and output paths still have the OCI stub/unavailable
  materializer; no amount of parser coverage closes these owners.

## Explicitly not claimed

- No completed Cloud-managed runtime/recovery qualification or production S3 certification yet.
- No real Box React/Vue build, manifest byte materialization, application/Agent/
  Preview binding, full management API or WEB0.6 runtime/fault/cleanup exit yet.
- No live PostgreSQL proof is claimed for this partial Gateway slice; subsequent
  authority/repository changes require the same scenario on memory and live PG.
- No full workspace build, remote CI, production deployment or push.
- Existing unrelated working-tree edits and existing unrelated Gateway warnings
  were not fixed or included in this work.
