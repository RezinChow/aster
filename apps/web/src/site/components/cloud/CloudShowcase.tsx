import { HeroLightBeam } from '../home/HeroLightBeam';
import { SnapPanel } from '../layout/SnapPanel';
import { CloudArchitectureDiagram } from './CloudArchitectureDiagram';
import { useI18n } from '../../i18n/useI18n';
import { useDesktopFx } from '../../lib/media';
import { Reveal } from '@a3s-lab/ui';

function stageTone(state: string) {
  const s = state.toLowerCase();
  if (s.includes('complete') || s.includes('完成')) return 'is-done';
  if (s.includes('run') || s.includes('进行')) return 'is-live';
  return 'is-wait';
}

function CloudConsole() {
  const { t } = useI18n();
  const c = t.cloudPage.console;

  return (
    <div className="cloud-console">
      <div className="cloud-console-frame">
        <aside className="cloud-console-side">
          <div className="mb-3 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] text-ink-faint">
            {c.search}
          </div>
          <p className="mb-1.5 text-xs text-ink-faint">
            {c.navLabel}
          </p>
          <ul className="space-y-0.5">
            {c.nav.map((item, i) => (
              <li
                key={item}
                className={`rounded-md px-2 py-1.5 text-left text-xs ${
                  i === 2 ? 'bg-primary/20 text-white' : 'text-ink-muted'
                }`}
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <div className="cloud-console-main">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300/90">
              {c.status}
            </div>
            <p className="text-[10px] text-ink-faint">{c.meta}</p>
          </div>

          <h3 className="mt-2 truncate text-left text-sm font-medium text-white md:text-base">
            {c.title}
          </h3>

          <div className="cloud-console-path" aria-hidden>
            {c.path.map((hop, i) => (
              <span key={hop} className="cloud-console-path-hop">
                {i > 0 ? <span className="cloud-console-path-sep">→</span> : null}
                <span>{hop}</span>
              </span>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {c.stages.map((stage) => (
              <div
                key={stage.id}
                className={`rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2 text-left cloud-console-stage ${stageTone(stage.state)}`}
              >
                <p className="font-mono text-[10px] text-ink-faint">{stage.id}</p>
                <p className="mt-0.5 text-xs text-white">{stage.name}</p>
                <p className="mt-0.5 text-[10px] text-primary-soft">{stage.state}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-white/8 bg-black/20 p-2.5">
            <p className="text-xs text-ink-faint">
              {c.journalLabel}
            </p>
            <ol className="mt-2 space-y-1.5">
              {c.journal.slice(0, 4).map((row, i) => (
                <li key={row.step} className="flex gap-2 text-left">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/25 text-[9px] text-primary-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-white">{row.step}</p>
                    <p className="truncate text-[11px] text-ink-muted">{row.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="cloud-console-aside">
          <p className="text-xs text-ink-faint">
            {c.asideTitle}
          </p>
          <ul className="mt-2 space-y-1.5">
            {c.plane.map((m) => (
              <li
                key={m.label}
                className="rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2 text-left"
              >
                <p className="text-[10px] text-ink-faint">{m.label}</p>
                <p className="mt-0.5 text-xs font-medium text-white">{m.value}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/** Kense OS product proof + architecture map. */
export function CloudShowcase() {
  const { t } = useI18n();
  const p = t.cloudPage;
  const cloud = t.cloud;
  const fx = useDesktopFx();

  return (
    <>
      <SnapPanel id="os" className="snap-panel--cloud-hero snap-panel--fill bg-bg-elevated/30">
        <div className="cloud-hero cloud-hero-stage cloud-hero--stacked relative gap-4 py-2">
          {fx ? <HeroLightBeam targetSelector=".cloud-console-frame" /> : null}

          <div className="container-pricing relative z-[5]">
            <Reveal>
              <div className="cloud-hero-copy mx-auto max-w-2xl text-center">
                <h2 className="text-[26px] font-medium leading-[1.15] tracking-[-0.6px] text-white max-sm:text-[22px] md:text-[34px]">
                  {cloud.title}
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-muted md:text-[15px]">
                  {cloud.description}
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delayMs={100} className="cloud-console-reveal cloud-console-reveal--stacked">
            <div className="cloud-console-wrap">
              <CloudConsole />
              <div className="cloud-proof-cards">
                {cloud.items.map((item, i) => (
                  <Reveal key={item.title} delayMs={i * 40} className="min-w-0">
                    <article className="h-full rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                      <h3 className="text-sm font-medium text-white">{item.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-ink-muted">
                        {item.description}
                      </p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </SnapPanel>

      <SnapPanel id="architecture" className="snap-panel--center snap-panel--fill snap-panel--arch">
        <div className="arch-panel-stack container-pricing flex h-auto flex-col justify-start gap-5 md:gap-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs text-primary-soft">
                {p.architecture.eyebrow}
              </p>
              <h2 className="mt-2 text-[26px] font-medium leading-tight tracking-[-0.5px] text-white max-sm:text-[22px] md:text-[34px]">
                {p.architecture.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink-muted md:text-[15px]">
                {p.architecture.description}
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <CloudArchitectureDiagram data={p.architecture.diagram} />
          </Reveal>
        </div>
      </SnapPanel>
    </>
  );
}
