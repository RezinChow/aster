import { type ReactNode } from 'react';
import { Hero } from '../components/home/Hero';
import { FeatureBlock } from '../components/home/FeatureBlock';
import { WorkBotStage } from '../components/home/WorkBotStage';
import { CloudShowcase } from '../components/cloud/CloudShowcase';
import { Footer } from '../components/layout/Footer';
import { SnapPanel, useHomeFullpage } from '../components/layout/SnapPanel';
import { Liquid } from '../components/canvasui/Liquid';
import { Blaze } from '../components/canvasui/Blaze';
import { useI18n } from '../i18n/useI18n';
import { a3sFx } from '../lib/canvasEffects';
import { useDesktopFx } from '../lib/media';
import { uiActions } from '../store/ui';
import { Reveal, Button } from '@a3s-lab/ui';

function WorkPanel({ children }: { children: ReactNode }) {
  const fx = useDesktopFx();
  if (!fx) return children;
  return (
    <Liquid
      color={a3sFx.accent}
      rainbow={false}
      intensity={1.05}
      blend={2}
      distortion={0.24}
      force={0.75}
      radius={0.26}
      densityDissipation={0.97}
      style={{ minHeight: '100%', height: '100%' }}
    >
      {children}
    </Liquid>
  );
}

function ClosingFx({ children }: { children: ReactNode }) {
  const fx = useDesktopFx();
  if (!fx) return children;
  return (
    <Blaze
      height={1}
      distortion={0.45}
      distortionScale={0.55}
      speed={0.9}
      sparks={0.65}
      sparkDensity={1.35}
      sparkSize={1.1}
      layers={5}
      smoke={0.55}
      glow={1.35}
      sparkColor={a3sFx.spark}
      smokeColor={a3sFx.smoke}
      className="flex flex-col"
    >
      {children}
    </Blaze>
  );
}

export function HomePage() {
  const { t } = useI18n();
  useHomeFullpage(true);

  return (
    <div className="home-fullpage">
      <SnapPanel id="top" className="snap-panel--hero">
        <Hero />
      </SnapPanel>

      <SnapPanel id="work" className="snap-panel--fill snap-panel--work">
        <WorkPanel>
          <div className="work-panel-stack flex h-full flex-col justify-center gap-4 py-2 max-sm:gap-3">
            <FeatureBlock data={t.work} compact showQuote={false} />
            <div className="container-pricing">
              <WorkBotStage />
            </div>
          </div>
        </WorkPanel>
      </SnapPanel>

      <CloudShowcase />

      <SnapPanel
        id="platform"
        className="snap-panel--fill snap-panel--cta snap-panel--closing"
      >
        <ClosingFx>
          <div className="closing-stack flex flex-col justify-start gap-4 pb-8 max-sm:gap-3 md:gap-5">
            <FeatureBlock data={t.security} compact showQuote={false} />

            <Reveal delayMs={40}>
              <div className="container-pricing">
                <div className="grid grid-cols-2 gap-3 max-sm:gap-2.5 sm:grid-cols-4 md:gap-4">
                  {t.scale.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3.5 text-center max-sm:px-2.5 max-sm:py-3 md:py-4"
                    >
                      <div className="text-xl font-medium tracking-tight text-white max-sm:text-lg md:text-2xl">
                        {stat.value}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-muted max-sm:text-[10px] md:text-xs">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delayMs={80}>
              <div className="container-pricing">
                <div
                  id="cta"
                  className="rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(28,20,76,0.45),rgba(11,12,17,0.75))] px-5 py-5 text-center max-sm:px-4 max-sm:py-4 md:px-8 md:py-6"
                >
                  <h2 className="text-[22px] font-medium tracking-tight text-white max-sm:text-[20px] md:text-[28px]">
                    {t.cta.title}
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
                    {t.cta.description}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <Button to="/signup" className="h-10 px-5">
                      {t.cta.primary}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 px-5"
                      onClick={() => uiActions.openDemoModal()}
                    >
                      {t.cta.secondary}
                    </Button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="relative z-[2] shrink-0">
            <Footer bare compact />
          </div>
        </ClosingFx>
      </SnapPanel>
    </div>
  );
}
