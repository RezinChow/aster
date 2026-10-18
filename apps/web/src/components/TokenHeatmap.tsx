import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TokenDay } from '@/data/platformTokens';
import { HEATMAP_WEEK_COLUMNS } from '@/data/platformTokens';

export type TokenHeatmapProps = {
  weeks: TokenDay[][];
  lessLabel: string;
  moreLabel: string;
  formatTokens: (n: number) => string;
  tokensLabel?: string;
  /** Sun…Sat — only Mon/Wed/Fri shown, matching contribution graphs */
  weekdayLabels: string[];
  className?: string;
  /** Week columns. Defaults to the fixed year-wide graph. */
  columns?: number;
};

type TipState = {
  date: string;
  tokens: number;
  x: number;
  y: number;
} | null;

const MONTH_LETTER = [
  'J',
  'F',
  'M',
  'A',
  'M',
  'J',
  'J',
  'A',
  'S',
  'O',
  'N',
  'D',
];

function monthMarks(weeks: TokenDay[][]) {
  const marks: { index: number; label: string }[] = [];
  let prev = -1;
  weeks.forEach((week, index) => {
    const day = week.find((d) => d.date);
    if (!day?.date) return;
    const month = new Date(`${day.date}T12:00:00`).getMonth();
    if (month === prev) return;
    // Skip label if the previous mark is on the adjacent column (too tight)
    const last = marks[marks.length - 1];
    if (last && index - last.index < 2) {
      prev = month;
      return;
    }
    marks.push({ index, label: MONTH_LETTER[month] ?? '' });
    prev = month;
  });
  return marks;
}

export function TokenHeatmap({
  weeks,
  lessLabel,
  moreLabel,
  formatTokens,
  tokensLabel = 'tokens',
  weekdayLabels,
  className = '',
  columns,
}: TokenHeatmapProps) {
  const tipId = useId();
  const [tip, setTip] = useState<TipState>(null);
  const months = useMemo(() => monthMarks(weeks), [weeks]);

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  function showTip(day: TokenDay, el: HTMLElement) {
    if (!day.date) return;
    const rect = el.getBoundingClientRect();
    setTip({
      date: day.date,
      tokens: day.tokens,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }

  return (
    <div
      className={`os-token-heatmap ${className}`.trim()}
      style={{ ['--weeks' as string]: columns ?? HEATMAP_WEEK_COLUMNS }}
    >
      <div className="os-token-heatmap__frame">
        <div className="os-token-heatmap__corner" aria-hidden />
        <div className="os-token-heatmap__months" aria-hidden>
          {months.map((m) => (
            <span
              key={`${m.label}-${m.index}`}
              style={{ gridColumn: m.index + 1 }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="os-token-heatmap__dows" aria-hidden>
          {weekdayLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{i % 2 === 1 ? label : ''}</span>
          ))}
        </div>

        <div className="os-token-heatmap__grid" role="img">
          {weeks.map((week, wi) => (
            <div key={wi} className="os-token-heatmap__week">
              {week.map((day, di) => {
                const empty = !day.date;
                return (
                  <button
                    key={`${wi}-${di}`}
                    type="button"
                    className="os-token-heatmap__cell"
                    data-level={empty ? 0 : day.level}
                    data-empty={empty ? 'true' : undefined}
                    tabIndex={empty ? -1 : 0}
                    aria-label={
                      empty
                        ? undefined
                        : `${day.date}, ${formatTokens(day.tokens)} ${tokensLabel}`
                    }
                    disabled={empty}
                    onMouseEnter={(e) => showTip(day, e.currentTarget)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => showTip(day, e.currentTarget)}
                    onBlur={() => setTip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="os-token-heatmap__legend" aria-hidden>
        <span>{lessLabel}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="os-token-heatmap__swatch"
            data-level={level}
          />
        ))}
        <span>{moreLabel}</span>
      </div>

      {tip
        ? createPortal(
            <div
              id={tipId}
              className="os-token-heatmap__tip"
              role="tooltip"
              style={{ left: tip.x, top: tip.y }}
            >
              <p className="os-token-heatmap__tip-date">{tip.date}</p>
              <p className="os-token-heatmap__tip-value">
                {formatTokens(tip.tokens)} {tokensLabel}
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
