import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { apiRequest } from '@/lib/apiClient';

type Challenge = {
  challengeId: string;
  background: string;
  piece: string;
  width: number;
  height: number;
  pieceW: number;
  pieceH: number;
  pad: number;
  y: number;
  tolerance: number;
  maxAttempts: number;
  expiresIn: number;
};

type VerifyResponse = {
  verified: boolean;
  token?: string;
  expiresIn?: number;
  attemptsLeft?: number;
};

type Status = 'loading' | 'idle' | 'verifying' | 'success' | 'fail' | 'error';

async function issueChallenge(): Promise<Challenge> {
  return apiRequest<Challenge>('/captcha/challenges', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

async function verifyChallenge(
  challengeId: string,
  x: number,
  durationMs: number,
  points: number,
): Promise<VerifyResponse> {
  return apiRequest<VerifyResponse>(`/captcha/challenges/${challengeId}/verifications`, {
    method: 'POST',
    body: JSON.stringify({ x, durationMs, points }),
  });
}

/**
 * 管理后台预览用的滑动拼图。服务端签发带缺口的图并保管横向答案，
 * 这里只提交落点和拖动过程。
 */
export function SlideCaptcha({
  onVerified,
}: {
  onVerified?: (token: string, expiresIn: number) => void;
}) {
  const { t } = useI18n();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [fraction, setFraction] = useState(0);
  const fractionRef = useRef(0);
  const dragRef = useRef<{
    startX: number;
    startFraction: number;
    startedAt: number;
    trajectory: number[];
  } | null>(null);
  const keyDragRef = useRef<{ startedAt: number; points: number } | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    fractionRef.current = 0;
    setFraction(0);
    setAttemptsLeft(null);
    keyDragRef.current = null;
    try {
      const next = await issueChallenge();
      if (!aliveRef.current) return;
      setChallenge(next);
      setStatus('idle');
    } catch {
      if (aliveRef.current) setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (x: number, durationMs: number, points: number) => {
      if (!challenge) return;
      setStatus('verifying');
      try {
        const result = await verifyChallenge(challenge.challengeId, x, durationMs, points);
        if (!aliveRef.current) return;
        if (result.verified && result.token) {
          setStatus('success');
          onVerified?.(result.token, result.expiresIn ?? 0);
          return;
        }
        setAttemptsLeft(result.attemptsLeft ?? 0);
        setStatus('fail');
        setTimeout(() => {
          if (aliveRef.current) void load();
        }, 900);
      } catch {
        if (!aliveRef.current) return;
        setStatus('error');
        setTimeout(() => {
          if (aliveRef.current) void load();
        }, 1200);
      }
    },
    [challenge, load, onVerified],
  );

  const pieceX = useCallback(
    (value: number) => {
      if (!challenge) return 0;
      return Math.round(value * Math.max(1, challenge.width - challenge.pieceW));
    },
    [challenge],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (status !== 'idle' || !challenge) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      keyDragRef.current = null;
      dragRef.current = {
        startX: event.clientX,
        startFraction: fraction,
        startedAt: performance.now(),
        trajectory: [fraction],
      };
    },
    [challenge, fraction, status],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track || status !== 'idle') return;
      const total = track.clientWidth - event.currentTarget.clientWidth;
      if (total <= 0) return;
      const next = Math.min(
        1,
        Math.max(0, drag.startFraction + (event.clientX - drag.startX) / total),
      );
      fractionRef.current = next;
      setFraction(next);
      drag.trajectory.push(next);
    },
    [status],
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !challenge || status !== 'idle') return;
    const latest = drag.trajectory[drag.trajectory.length - 1] ?? fractionRef.current;
    void submit(
      pieceX(latest),
      Math.round(performance.now() - drag.startedAt),
      drag.trajectory.length,
    );
  }, [challenge, pieceX, status, submit]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (status !== 'idle' || !challenge) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (!keyDragRef.current) {
          keyDragRef.current = { startedAt: performance.now(), points: 0 };
        }
        keyDragRef.current.points += 1;
        const delta = event.key === 'ArrowRight' ? 0.025 : event.key === 'ArrowLeft' ? -0.025 : 0;
        const current = fractionRef.current;
        const next =
          event.key === 'Home' ? 0 : event.key === 'End' ? 1 : Math.min(1, Math.max(0, current + delta));
        fractionRef.current = next;
        setFraction(next);
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const keyDrag = keyDragRef.current;
      keyDragRef.current = null;
      const duration = keyDrag ? Math.round(performance.now() - keyDrag.startedAt) : 0;
      void submit(pieceX(fractionRef.current), duration, keyDrag?.points ?? 1);
    },
    [challenge, pieceX, status, submit],
  );

  const displayWidth = challenge?.width ?? 600;
  const displayHeight = challenge?.height ?? 340;
  const pad = challenge?.pad ?? 12;
  const pieceBox = (challenge?.pieceW ?? 56) + pad * 2;
  const pieceLeft = fraction * Math.max(1, displayWidth - (challenge?.pieceW ?? 56)) - pad;

  let caption = t('captcha.hint');
  if (status === 'loading') caption = t('captcha.issuing');
  else if (status === 'verifying') caption = t('captcha.loading');
  else if (status === 'error') caption = t('captcha.unavailable');
  else if (status === 'success') caption = t('captcha.success');
  else if (status === 'fail') {
    caption = t('captcha.failed');
    if (attemptsLeft != null && attemptsLeft > 0) {
      caption = `${caption} · ${t('captcha.attemptsLeft').replace('{n}', String(attemptsLeft))}`;
    }
  } else if (challenge) {
    caption = `${t('captcha.hint')} · ±${challenge.tolerance} px`;
  }

  const busy = status === 'loading' || status === 'verifying';

  return (
    <div className="os-captcha-preview">
      <div
        className="os-captcha-stage"
        style={{ aspectRatio: `${displayWidth} / ${displayHeight}` }}
      >
        {challenge ? (
          <>
            <img
              src={challenge.background}
              alt=""
              draggable={false}
              className="os-captcha-stage__bg"
            />
            <img
              src={challenge.piece}
              alt=""
              draggable={false}
              className={`os-captcha-piece${status === 'fail' ? ' is-fail' : ''}`}
              style={{
                left: `${(pieceLeft / displayWidth) * 100}%`,
                top: `${((challenge.y - pad) / displayHeight) * 100}%`,
                width: `${(pieceBox / displayWidth) * 100}%`,
                height: `${(pieceBox / displayHeight) * 100}%`,
              }}
            />
          </>
        ) : null}
        {status === 'success' ? (
          <div className="os-captcha-success" aria-hidden>
            {t('captcha.success')}
          </div>
        ) : null}
        {busy ? (
          <div className="os-captcha-veil" aria-hidden>
            {status === 'verifying' ? t('captcha.loading') : t('captcha.issuing')}
          </div>
        ) : null}
        {!challenge && status === 'error' ? (
          <div className="os-captcha-empty">{t('captcha.unavailable')}</div>
        ) : null}
      </div>

      <div
        ref={trackRef}
        className={`os-captcha-track${status === 'success' ? ' is-success' : ''}`}
      >
        <div
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          aria-orientation="horizontal"
          aria-label={t('captcha.hint')}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={`os-captcha-handle${status === 'success' ? ' is-success' : ''}`}
          style={{ left: `calc(${fraction * 100}% - ${fraction * 3.5}rem + 0.25rem)` }}
        >
          <span className="os-captcha-grip" />
          <span className="os-captcha-grip" />
          <span className="os-captcha-grip" />
        </div>
      </div>

      <div className="os-captcha-caption">
        <p aria-live="polite">{caption}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={busy}
        >
          {t('captcha.refresh')}
        </Button>
      </div>
    </div>
  );
}
