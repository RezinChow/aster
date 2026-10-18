import { useEffect, useId, useRef } from 'react';
import { CLAY_BOTS, type ClayBotId } from './clayPresets';
import {
  clamp,
  lerp,
  rand,
  setSpring,
  spring,
  stepSpring,
  type Spring,
} from './spring';

export type ClayMood =
  | 'idle'
  | 'blink'
  | 'happy'
  | 'curious'
  | 'thinking'
  | 'wink'
  | 'surprised'
  | 'nod'
  | 'bounce'
  | 'speak'
  | 'lookLeft'
  | 'lookRight';

export type ClayAvatarProps = {
  bot: ClayBotId;
  size?: number;
  className?: string;
  /** Auto-cycle rich moods & actions. */
  autoPlay?: boolean;
  /** Pointer gaze when hovering near the avatar. */
  followPointer?: boolean;
  /** Soft contact shadow under the head (off when mounted on a body). */
  showGround?: boolean;
  mood?: ClayMood;
  'aria-label'?: string;
};

type Springs = {
  bob: Spring;
  hop: Spring;
  tilt: Spring;
  roll: Spring;
  squashX: Spring;
  squashY: Spring;
  blinkL: Spring;
  blinkR: Spring;
  gazeX: Spring;
  gazeY: Spring;
  eyeScale: Spring;
};

type Pose = {
  bob: number;
  hop: number;
  tilt: number;
  roll: number;
  squashX: number;
  squashY: number;
  blinkL: number;
  blinkR: number;
  gazeX: number;
  gazeY: number;
  eyeScale: number;
  holdMs: [number, number];
};

const POSES: Record<ClayMood, Pose> = {
  idle: {
    bob: 0,
    hop: 0,
    tilt: 0,
    roll: 0,
    squashX: 1,
    squashY: 1,
    blinkL: 1,
    blinkR: 1,
    gazeX: 0,
    gazeY: 0,
    eyeScale: 1,
    holdMs: [1600, 2400],
  },
  blink: {
    bob: 0,
    hop: 0,
    tilt: 0,
    roll: 0,
    squashX: 1,
    squashY: 1,
    blinkL: 0.06,
    blinkR: 0.06,
    gazeX: 0,
    gazeY: 0,
    eyeScale: 1,
    holdMs: [90, 140],
  },
  happy: {
    bob: -2,
    hop: 5,
    tilt: -3,
    roll: 0,
    squashX: 1.06,
    squashY: 0.92,
    blinkL: 0.55,
    blinkR: 0.55,
    gazeX: 0,
    gazeY: 0.08,
    eyeScale: 0.92,
    holdMs: [1100, 1600],
  },
  curious: {
    bob: -1,
    hop: 0,
    tilt: -7,
    roll: -2,
    squashX: 0.98,
    squashY: 1.04,
    blinkL: 1.12,
    blinkR: 1.12,
    gazeX: 0.55,
    gazeY: -0.22,
    eyeScale: 1.12,
    holdMs: [1200, 1800],
  },
  thinking: {
    bob: 1,
    hop: 0,
    tilt: 6,
    roll: 3,
    squashX: 1.02,
    squashY: 0.98,
    blinkL: 0.75,
    blinkR: 0.75,
    gazeX: -0.25,
    gazeY: -0.55,
    eyeScale: 0.95,
    holdMs: [1400, 2000],
  },
  wink: {
    bob: 0,
    hop: 2,
    tilt: -5,
    roll: -3,
    squashX: 1.03,
    squashY: 0.97,
    blinkL: 0.06,
    blinkR: 1.05,
    gazeX: 0.15,
    gazeY: 0,
    eyeScale: 1,
    holdMs: [700, 1000],
  },
  surprised: {
    bob: -3,
    hop: 7,
    tilt: 0,
    roll: 0,
    squashX: 0.92,
    squashY: 1.1,
    blinkL: 1.2,
    blinkR: 1.2,
    gazeX: 0,
    gazeY: -0.12,
    eyeScale: 1.28,
    holdMs: [800, 1200],
  },
  nod: {
    bob: 5,
    hop: 0,
    tilt: 9,
    roll: 0,
    squashX: 1.05,
    squashY: 0.93,
    blinkL: 0.85,
    blinkR: 0.85,
    gazeX: 0,
    gazeY: 0.28,
    eyeScale: 1,
    holdMs: [450, 650],
  },
  bounce: {
    bob: -8,
    hop: 12,
    tilt: -2,
    roll: 5,
    squashX: 0.88,
    squashY: 1.14,
    blinkL: 1,
    blinkR: 1,
    gazeX: 0,
    gazeY: -0.08,
    eyeScale: 1.05,
    holdMs: [500, 750],
  },
  speak: {
    bob: 0,
    hop: 1,
    tilt: -2,
    roll: 0,
    squashX: 1,
    squashY: 1,
    blinkL: 1,
    blinkR: 1,
    gazeX: 0.08,
    gazeY: 0,
    eyeScale: 1.04,
    holdMs: [900, 1400],
  },
  lookLeft: {
    bob: 0,
    hop: 0,
    tilt: 3,
    roll: -6,
    squashX: 1,
    squashY: 1,
    blinkL: 1,
    blinkR: 1,
    gazeX: -0.72,
    gazeY: 0.04,
    eyeScale: 1,
    holdMs: [1000, 1500],
  },
  lookRight: {
    bob: 0,
    hop: 0,
    tilt: -3,
    roll: 6,
    squashX: 1,
    squashY: 1,
    blinkL: 1,
    blinkR: 1,
    gazeX: 0.72,
    gazeY: 0.04,
    eyeScale: 1,
    holdMs: [1000, 1500],
  },
};

const PLAYLIST: ClayMood[] = [
  'idle',
  'blink',
  'curious',
  'idle',
  'happy',
  'blink',
  'lookLeft',
  'thinking',
  'nod',
  'idle',
  'wink',
  'speak',
  'lookRight',
  'surprised',
  'bounce',
  'happy',
  'idle',
];

/** Eye lean ≈ 26° off vertical, backslash `\\` — measured Grok / bloub trait. */
const EYE_TILT = -26;

function createSprings(): Springs {
  return {
    bob: spring(0, 160, 16),
    hop: spring(0, 220, 18),
    tilt: spring(0, 140, 14),
    roll: spring(0, 130, 13),
    squashX: spring(1, 240, 20),
    squashY: spring(1, 240, 20),
    blinkL: spring(1, 520, 28),
    blinkR: spring(1, 520, 28),
    gazeX: spring(0, 100, 12),
    gazeY: spring(0, 100, 12),
    eyeScale: spring(1, 200, 18),
  };
}

function applyPose(s: Springs, mood: ClayMood) {
  const p = POSES[mood];
  setSpring(s.bob, p.bob);
  setSpring(s.hop, p.hop);
  setSpring(s.tilt, p.tilt);
  setSpring(s.roll, p.roll);
  setSpring(s.squashX, p.squashX);
  setSpring(s.squashY, p.squashY);
  setSpring(s.blinkL, p.blinkL);
  setSpring(s.blinkR, p.blinkR);
  setSpring(s.gazeX, p.gazeX);
  setSpring(s.gazeY, p.gazeY);
  setSpring(s.eyeScale, p.eyeScale);
}

/**
 * Grok-style domain avatar — solid blob body, white capsule eyes, spring motion.
 * Visual language from the spring character study; colors tuned for Kense.
 */
export function ClayAvatar({
  bot,
  size = 96,
  className = '',
  autoPlay = true,
  followPointer = false,
  showGround = true,
  mood: moodProp,
  'aria-label': ariaLabel,
}: ClayAvatarProps) {
  const preset = CLAY_BOTS[bot];
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const eyeLRef = useRef<SVGGElement>(null);
  const eyeRRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const s = createSprings();
    let mood: ClayMood = moodProp ?? 'idle';
    let playlistIdx = bot === 'docs' ? 0 : bot === 'code' ? 3 : bot === 'science' ? 6 : 9;
    let until = performance.now() + rand(400, 1200) + playlistIdx * 180;
    let last = performance.now();
    let raf = 0;
    let px = 0;
    let py = 0;
    let hasPtr = false;

    applyPose(s, mood);

    const onMove = (e: PointerEvent) => {
      if (!followPointer || !rootRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      px = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.55), -1, 1);
      py = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.55), -1, 1);
      hasPtr = true;
    };
    if (followPointer) {
      window.addEventListener('pointermove', onMove, { passive: true });
    }

    const paint = () => {
      const y = s.bob.value - s.hop.value;
      const tilt = s.tilt.value;
      const roll = s.roll.value;
      const sx = s.squashX.value;
      const sy = s.squashY.value;
      if (figureRef.current) {
        figureRef.current.setAttribute(
          'transform',
          `translate(50 52) rotate(${(tilt + roll * 0.35).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-50 ${(-52 + y).toFixed(2)})`,
        );
      }

      let gx = s.gazeX.value;
      let gy = s.gazeY.value;
      if (hasPtr && mood !== 'blink') {
        gx = lerp(gx, px * 0.7, 0.45);
        gy = lerp(gy, py * 0.55, 0.45);
      }
      if (faceRef.current) {
        faceRef.current.setAttribute(
          'transform',
          `translate(${(gx * 3.2).toFixed(2)} ${(gy * 2.4).toFixed(2)})`,
        );
      }

      const es = s.eyeScale.value;
      const bL = Math.max(0.05, s.blinkL.value);
      const bR = Math.max(0.05, s.blinkR.value);
      const eyeW = 5.8 * es;
      const eyeH = 9.6 * es;

      if (eyeLRef.current) {
        eyeLRef.current.setAttribute(
          'transform',
          `translate(39.5 43) rotate(${EYE_TILT}) scale(${eyeW.toFixed(3)} ${(eyeH * bL).toFixed(3)})`,
        );
      }
      if (eyeRRef.current) {
        eyeRRef.current.setAttribute(
          'transform',
          `translate(57.5 38.5) rotate(${EYE_TILT}) scale(${eyeW.toFixed(3)} ${(eyeH * bR).toFixed(3)})`,
        );
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      if (moodProp) {
        if (moodProp !== mood) {
          mood = moodProp;
          applyPose(s, mood);
        }
      } else if (autoPlay && now >= until) {
        playlistIdx = (playlistIdx + 1) % PLAYLIST.length;
        mood = PLAYLIST[playlistIdx];
        applyPose(s, mood);
        const hold = POSES[mood].holdMs;
        until = now + rand(hold[0], hold[1]);
        if (mood === 'bounce' || mood === 'surprised') {
          setSpring(s.squashY, 1.16);
          setSpring(s.squashX, 0.88);
        }
        if (mood === 'nod') {
          setSpring(s.bob, 7);
        }
      }

      if (mood === 'idle' && !moodProp) {
        setSpring(s.bob, Math.sin(now / 780) * 1.4);
        setSpring(s.gazeX, Math.sin(now / 2100) * 0.12);
        setSpring(s.gazeY, Math.sin(now / 2600) * 0.08);
      }

      for (const springState of Object.values(s)) stepSpring(springState, dt);

      paint();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [autoPlay, followPointer, moodProp, bot]);

  return (
    <div
      ref={rootRef}
      className={`clay-avatar clay-avatar--${bot} ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `Kense ${bot} bot`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} overflow="visible">
        <defs>
          {preset.fill === 'rainbow' ? (
            <linearGradient
              id={`${uid}-body`}
              x1="12%"
              y1="8%"
              x2="88%"
              y2="92%"
            >
              <stop offset="0%" stopColor="#ff3e51" />
              <stop offset="18%" stopColor="#ff781c" />
              <stop offset="36%" stopColor="#ffaf38" />
              <stop offset="52%" stopColor="#00c972" />
              <stop offset="68%" stopColor="#1cc3b0" />
              <stop offset="84%" stopColor="#2a92fe" />
              <stop offset="100%" stopColor="#a97efe" />
            </linearGradient>
          ) : (
            <radialGradient id={`${uid}-body`} cx="36%" cy="30%" r="70%">
              <stop offset="0%" stopColor={preset.body} />
              <stop offset="72%" stopColor={preset.body} />
              <stop offset="100%" stopColor={preset.bodyDeep} />
            </radialGradient>
          )}
          <radialGradient id={`${uid}-sheen`} cx="34%" cy="28%" r="46%">
            <stop
              offset="0%"
              stopColor="#fff"
              stopOpacity={preset.fill === 'rainbow' ? 0.28 : preset.body.startsWith('#f') ? 0.55 : 0.2}
            />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {showGround ? (
          <ellipse
            cx="50"
            cy="92"
            rx="22"
            ry="4.5"
            fill={preset.bodyDeep}
            opacity="0.35"
          />
        ) : null}

        <g ref={figureRef}>
          {/* Near-circle blob body */}
          <circle cx="50" cy="52" r="34" fill={`url(#${uid}-body)`} />
          <circle cx="50" cy="52" r="34" fill={`url(#${uid}-sheen)`} />

          {/* White capsule eyes (Grok / study style) */}
          <g ref={faceRef}>
            <g
              ref={eyeLRef}
              transform={`translate(39.5 43) rotate(${EYE_TILT}) scale(5.8 9.6)`}
            >
              <ellipse cx="0" cy="0" rx="1" ry="1" fill={preset.eye} />
            </g>
            <g
              ref={eyeRRef}
              transform={`translate(57.5 38.5) rotate(${EYE_TILT}) scale(5.8 9.6)`}
            >
              <ellipse cx="0" cy="0" rx="1" ry="1" fill={preset.eye} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

export default ClayAvatar;
