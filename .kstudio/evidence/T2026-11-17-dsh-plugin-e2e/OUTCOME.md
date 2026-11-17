# T2026-11-17-dsh-plugin-e2e

Updated: 2026-11-17 · `/k-yolo` named scope · real DeepSeek Harness plugin install / use / uninstall · ≠ Meta Harness Pass

## Scope

User-named YOLO: plan and complete **真实 DeepSeek Harness Plugin** E2E covering **安装、使用、卸载**.

Host under test: real `dsh` CLI (`/opt/homebrew/bin/dsh`, `@deepseek-ai/dsh` **0.2.2-rc.1**), not Aster `aster plugin`, not a mocked loader.

## Plan (executed)

1. Hermetic `$DSH_HOME` (never mutate operator `~/.dsh` profiles).
2. Official-shape bundle fixture `dsh-aster-e2e-hello` (`dsh.bundle.patch` + Cordis `apply` + disposable `ctx.effect`).
3. **安装** `dsh plugin --profile aster-e2e add <fixture>` → dependency + `dsh.profile.bundles` + dump layer.
4. **使用** boot profile with `ASTER_DSH_E2E_MARKER` → `apply` writes `loaded:…`; `--dump-config` shows `# == dsh-aster-e2e-hello`.
5. **卸载** `dsh plugin --profile aster-e2e remove dsh-aster-e2e-hello` → bundles/deps/dump clean; negative boot writes no marker.

## Commands (rerun)

```bash
bash .kstudio/evidence/T2026-11-17-dsh-plugin-e2e/run.sh
```

Or manually (same contract):

```bash
export DSH_HOME="$(mktemp -d)/home"
PLUGIN=.kstudio/evidence/T2026-11-17-dsh-plugin-e2e/fixture
dsh plugin --profile aster-e2e add "$PLUGIN"
dsh --profile aster-e2e --dump-config | rg 'dsh-aster-e2e-hello'
# boot until ASTER_DSH_E2E_MARKER shows loaded:aster-e2e-hello:… then SIGTERM
dsh plugin --profile aster-e2e remove dsh-aster-e2e-hello
dsh --profile aster-e2e --dump-config | rg 'dsh-aster-e2e-hello' || echo NO_HITS
```

Final gate (this host):

```text
bash .kstudio/evidence/T2026-11-17-dsh-plugin-e2e/run.sh
→ PASS install/use/uninstall  (~18s)
```

## Observed results

| Step | Oracle | Result |
| --- | --- | --- |
| Install | `package.json` bundles include `dsh-aster-e2e-hello`; dump has `# == dsh-aster-e2e-hello` | **pass** (rerun hits: 3 lines) |
| Use | marker file `loaded:aster-e2e-hello:<epoch>` after timed boot | **pass** (`artifacts/rerun-marker-loaded.txt`) |
| Uninstall | bundles only `@deepseek-ai/dsh-base`; dump `NO_HITS`; negative boot `MARKER_ABSENT_OK` | **pass** |
| Residual | `node_modules/dsh-aster-e2e-hello` symlink after remove | **observed** (`artifacts/symlink-residual.txt` = yes) — layer/runtime inactive |

Env snapshot: `artifacts/env.txt` (Darwin arm64, dsh 0.2.2-rc.1, node v26.8.1).

## Explicitly not claimed

- Meta Harness / Aster product Pass
- Cordis-rs absorbed into `aster-core`
- Clean filesystem uninstall of every `node_modules` symlink (residual link remains after `dsh plugin remove` with pnpm hoisted linker; composition + runtime unload still succeed)
- LLM/agent “chat use” of DeepSeek API (no paid/secret path; use = plugin `apply` on real `dsh` boot)
- Desktop Electron profile (`desktop` refused by CLI)
- Publishing the fixture to npm
