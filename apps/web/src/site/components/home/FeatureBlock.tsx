import type { ReactNode } from 'react';
import type { FeatureTrio } from '../../i18n/types';
import { EncryptionField } from './EncryptionField';
import { Reveal } from '@a3s-lab/ui';

type Props = {
  id?: string;
  data: FeatureTrio;
  tone?: 'default' | 'surface';
  withEncryptionField?: boolean;
  lead?: ReactNode;
  /** Tighter spacing for full-viewport panels */
  compact?: boolean;
  showQuote?: boolean;
};

export function FeatureBlock({
  id,
  data,
  tone = 'default',
  withEncryptionField = false,
  lead,
  compact = false,
  showQuote = true,
}: Props) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden ${
        compact ? 'py-4 md:py-6' : 'py-8 md:py-12'
      } ${tone === 'surface' ? 'bg-bg-elevated/40' : ''}`}
    >
      {withEncryptionField ? <EncryptionField /> : null}
      <div className="container-pricing relative z-[1]">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className={`font-medium leading-tight tracking-[-0.4px] text-white ${
                compact
                  ? 'text-[24px] md:text-[32px] max-sm:text-[22px]'
                  : 'text-[28px] md:text-[36px] max-sm:text-[24px]'
              }`}
            >
              {data.title}
            </h2>
            <p
              className={`mx-auto text-ink-muted ${
                compact
                  ? 'mt-3 max-w-2xl text-sm leading-6 md:text-[15px]'
                  : 'mt-4 text-base leading-7 md:text-[17px]'
              }`}
            >
              {data.description}
            </p>
          </div>
        </Reveal>

        {lead}

        <div
          className={`grid gap-3 md:grid-cols-3 md:gap-4 ${
            compact ? 'mt-6 max-sm:mt-5' : 'mt-10'
          }`}
        >
          {data.items.map((item, index) => (
            <Reveal key={item.title} delayMs={(index + 1) * 80}>
              <article
                className={`h-full rounded-xl border border-white/8 bg-white/[0.02] backdrop-blur-[2px] transition-colors hover:border-white/14 hover:bg-white/[0.035] ${
                  compact ? 'p-4' : 'p-6'
                }`}
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 text-xs font-medium text-primary-soft">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-muted">
                  {item.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        {showQuote ? (
          <Reveal delayMs={120}>
            <figure
              className={`mx-auto max-w-3xl rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(28,20,76,0.45),rgba(18,20,28,0.8))] ${
                compact ? 'mt-8 p-5 md:p-6' : 'mt-12 p-8 md:p-10'
              }`}
            >
              <blockquote
                className={`font-medium tracking-[-0.2px] text-white ${
                  compact
                    ? 'text-base leading-7 md:text-lg'
                    : 'text-lg leading-8 md:text-[22px] md:leading-9'
                }`}
              >
                “{data.quote.text}”
              </blockquote>
              <figcaption className="mt-4 flex flex-col gap-0.5 text-sm">
                <span className="font-medium text-white">{data.quote.author}</span>
                <span className="text-ink-muted">{data.quote.role}</span>
              </figcaption>
            </figure>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
