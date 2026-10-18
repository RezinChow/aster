import { type ReactNode } from 'react';
import { ParticleReveal } from '../canvasui/ParticleReveal';
import { BlackHole } from './BlackHole';
import { HeroProductMobile } from './HeroProductMobile';
import { ExpertPack } from '../bot/ExpertPack';
import { useI18n } from '../../i18n/useI18n';
import { uiActions } from '../../store/ui';
import { a3sFx } from '../../lib/canvasEffects';
import { useDesktopFx } from '../../lib/media';
import { Button, Reveal } from '@a3s-lab/ui';

function HeroCopyFx({ children }: { children: ReactNode }) {
  const fx = useDesktopFx();
  if (!fx) return <div className="relative z-[2]">{children}</div>;
  return (
    <ParticleReveal
      background={a3sFx.bg}
      radius={280}
      softness={0.7}
      scatter={32}
      drift={0.85}
      aberration={28}
      bend={36}
      fade={0.8}
      threshold={0.08}
      smoothing={0.22}
      className="relative z-[2]"
    >
      {children}
    </ParticleReveal>
  );
}

function DocIcon({ kind }: { kind: 'word' | 'excel' | 'ppt' | 'pdf' | 'md' }) {
  const label =
    kind === 'word'
      ? 'W'
      : kind === 'excel'
        ? 'X'
        : kind === 'ppt'
          ? 'P'
          : kind === 'pdf'
            ? 'PDF'
            : 'M↓';

  return (
    <span className={`work-preview-doc-icon work-preview-doc-icon--${kind}`} aria-hidden>
      {label}
    </span>
  );
}

function HeroProduct() {
  const { t } = useI18n();
  const preview = t.hero.workPreview;

  return (
    <div className="hero-product">
      <div className="work-preview" aria-hidden>
        <aside className="work-preview-side">
          <div className="work-preview-traffic">
            <span />
            <span />
            <span />
          </div>

          <div className="work-preview-side-tools">
            <button type="button" tabIndex={-1} aria-hidden>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <rect x="2" y="2" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M9 3h5M9 8h5M9 13h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" tabIndex={-1} aria-hidden>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10.5 10.5 13.5 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" tabIndex={-1} aria-hidden>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path
                  d="M2.5 3.5h11l-4 4.5v3.5l-3 1.5v-5z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <button type="button" className="work-preview-new-task" tabIndex={-1}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
              <path
                d="M3 4.5h7.5a2 2 0 0 1 2 2V12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V6a1.5 1.5 0 0 1 1.5-1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M8 7.5v4M6 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {preview.newTask}
          </button>

          <div className="work-preview-nav-block">
            <div className="work-preview-nav-head">
              <span>{preview.projects}</span>
              <span className="work-preview-nav-action">+</span>
            </div>
            <p className="work-preview-nav-empty">{preview.projectsEmpty}</p>
          </div>

          <div className="work-preview-nav-block">
            <div className="work-preview-nav-head">
              <span>{preview.tasks}</span>
              <span className="work-preview-nav-action">{preview.more}</span>
            </div>
            <p className="work-preview-nav-empty">{preview.tasksEmpty}</p>
          </div>

          <div className="work-preview-user">
            <span className="work-preview-avatar">{preview.user.slice(0, 1).toUpperCase()}</span>
            <span>{preview.user}</span>
          </div>
        </aside>

        <div className="work-preview-main">
          <div className="work-preview-greeting">
            <ExpertPack
              id="docs"
              name={t.work.bot.squad[0]?.name ?? 'DOCS'}
              role={t.work.bot.squad[0]?.role ?? ''}
              compact
              className="work-preview-bot"
            />
            <h3>{preview.greeting}</h3>
          </div>

          <div className="work-preview-composer">
            <div className="work-preview-composer-top">
              <button type="button" className="work-preview-project" tabIndex={-1}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
                  <path
                    d="M2.5 4.5h4l1.5 1.5H13.5v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
                {preview.selectProject}
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden>
                  <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <p className="work-preview-placeholder">{preview.placeholder}</p>

            <div className="work-preview-composer-bar">
              <div className="work-preview-composer-left">
                <button type="button" tabIndex={-1} aria-hidden>
                  +
                </button>
                <button type="button" tabIndex={-1} aria-hidden>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <path
                      d="M8 2.5v7M5.5 7 8 9.5 10.5 7"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="work-preview-composer-right">
                <span>
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                    <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 7V5.5a2 2 0 0 1 4 0V7" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  {preview.modelStatus}
                </span>
                <span>
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {preview.executeAuto}
                </span>
                <span>{preview.workspaceWritable}</span>
                <button type="button" className="work-preview-send" tabIndex={-1} aria-hidden>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <path
                      d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="work-preview-docs">
            {preview.docs.map((doc) => (
              <div key={doc.name} className="work-preview-doc">
                <DocIcon kind={doc.kind} />
                <span>{doc.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { t } = useI18n();

  return (
    <section className="hero-section relative overflow-visible pb-8 pt-12 max-sm:pb-6 max-sm:pt-4 md:pb-10 md:pt-16 lg:pt-20">
      <HeroCopyFx>
        <div className="container-pricing text-center">
          <Reveal>
            <h1 className="mx-auto max-w-4xl text-[36px] font-medium leading-[1.2] tracking-[-0.96px] text-white max-sm:text-[28px] max-sm:tracking-[-0.8px] md:text-[48px] md:leading-[1.38]">
              {t.hero.title}
            </h1>
          </Reveal>
          <Reveal delayMs={80}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-muted max-sm:mt-4 max-sm:text-sm max-sm:leading-6 md:text-lg">
              {t.hero.subtitle}
            </p>
          </Reveal>
          <Reveal delayMs={140}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-sm:mt-6 max-sm:gap-2.5">
              <Button to="/signup" className="h-11 px-5 max-sm:h-10 max-sm:px-4">
                {t.hero.ctaPrimary}
              </Button>
              <Button
                variant="outline"
                className="h-11 px-5 max-sm:h-10 max-sm:px-4"
                onClick={() => uiActions.openDemoModal()}
              >
                {t.hero.ctaSecondary}
              </Button>
            </div>
          </Reveal>
          <Reveal delayMs={200}>
            <a
              href="#work"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary-soft transition-colors hover:text-white max-sm:mt-6"
            >
              {t.hero.discover}
              <span aria-hidden>↓</span>
            </a>
          </Reveal>
        </div>
      </HeroCopyFx>

      <div className="hero-visual">
        <div className="hero-stage" aria-hidden>
          <BlackHole />
        </div>

        <Reveal delayMs={260}>
          <div className="hero-product-wrap hidden lg:block">
            <HeroProduct />
          </div>
          <div className="hero-product-wrap lg:hidden">
            <HeroProductMobile />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
