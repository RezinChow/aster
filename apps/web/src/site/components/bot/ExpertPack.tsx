import { ClayAvatar } from './ClayAvatar';
import type { ClayBotId } from './clayPresets';
import { publicUrl } from '../../lib/publicUrl';

const LANYARD_LOGO = publicUrl('/logo/png/a3s-horizontal-dark-transparent.png');

export type ExpertSpec = {
  id: ClayBotId;
  code: string;
  sku: string;
};

export const EXPERT_SPECS: Record<ClayBotId, ExpertSpec> = {
  docs: { id: 'docs', code: 'DOC-01', sku: 'KX-DOC-2401' },
  code: { id: 'code', code: 'DEV-02', sku: 'KX-DEV-2402' },
  science: { id: 'science', code: 'SCI-03', sku: 'KX-SCI-2403' },
  finance: { id: 'finance', code: 'FIN-04', sku: 'KX-FIN-2404' },
};

export const EXPERT_ORDER: ClayBotId[] = [
  'docs',
  'code',
  'science',
  'finance',
];

const LANYARD_SEED: Record<ClayBotId, number> = {
  docs: 3,
  code: 7,
  science: 11,
  finance: 17,
};

function PackRing({ id, layer }: { id: ClayBotId; layer: 'back' | 'front' }) {
  const gid = `pack-steel-${id}-${layer}`;
  return (
    <svg
      className={`expert-pack-ring expert-pack-ring--${layer}`}
      viewBox="0 0 32 32"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0.12" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f8f8f8" />
          <stop offset="38%" stopColor="#c9c9c9" />
          <stop offset="58%" stopColor="#8b8b8b" />
          <stop offset="100%" stopColor="#ececec" />
        </linearGradient>
      </defs>
      {layer === 'back' ? (
        <circle
          cx="16"
          cy="16"
          r="10"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="2.7"
        />
      ) : (
        <>
          <path
            d="M6.15 17.1a10 10 0 1 0 19.7 0"
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth="2.7"
            strokeLinecap="round"
          />
          <path
            d="M11.2 24.6c1.5 2.1 3.1 3.1 4.8 3.1s3.3-1 4.8-3.1"
            fill="none"
            stroke="#141414"
            strokeWidth="7.2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function PackLanyard({ id }: { id: ClayBotId }) {
  const fid = `pack-leather-${id}`;
  const mid = `pack-strap-mask-${id}`;
  const pid = `pack-print-${id}`;
  const loop =
    'M40 12C18 32 16 62 16 112L16 296C16 318 32 330 48 330H64C80 330 96 318 96 296L96 112C96 62 94 32 72 12';

  return (
    <div className="expert-pack-lanyard" aria-hidden>
      <svg
        className="expert-pack-lanyard-svg"
        viewBox="0 0 112 352"
        fill="none"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <mask id={mid} maskUnits="userSpaceOnUse">
            <path
              d={loop}
              stroke="#fff"
              strokeWidth="16.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
          <filter
            id={pid}
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="0.18" result="soft" />
            <feComponentTransfer in="soft">
              <feFuncA type="linear" slope="0.84" />
            </feComponentTransfer>
          </filter>
          <filter
            id={fid}
            x="-35%"
            y="-18%"
            width="170%"
            height="136%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.15" result="ao" />
            <feSpecularLighting
              in="ao"
              surfaceScale="3.4"
              specularConstant="0.62"
              specularExponent="16"
              lightingColor="#f2f2f2"
              result="spec"
            >
              <fePointLight x="-28" y="8" z="34" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.55 0.18"
              numOctaves="3"
              seed={LANYARD_SEED[id]}
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.18  0 0 0 0 0.18  0 0 0 0 0.18  0 0 0 0.22 0"
              result="grain"
            />
            <feComposite in="grain" in2="SourceAlpha" operator="in" result="grainCut" />
            <feBlend in="SourceGraphic" in2="grainCut" mode="soft-light" result="grained" />
            <feComposite
              in="grained"
              in2="specIn"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="1.12"
              k4="0"
              result="lit"
            />
            <feDropShadow
              in="lit"
              dx="0"
              dy="3.5"
              stdDeviation="2.2"
              floodColor="#000"
              floodOpacity="0.5"
            />
          </filter>
        </defs>
        <path
          className="expert-pack-lanyard-cast"
          d={loop}
          stroke="#000"
          strokeWidth="22"
          strokeLinecap="round"
          opacity="0.32"
        />
        <path
          className="expert-pack-lanyard-cord"
          d={loop}
          stroke="#111"
          strokeWidth="16.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${fid})`}
        />
        <g mask={`url(#${mid})`}>
          <image
            className="expert-pack-lanyard-print"
            href={LANYARD_LOGO}
            x="32"
            y="322.4"
            width="48"
            height="16"
            filter={`url(#${pid})`}
          />
        </g>
      </svg>
    </div>
  );
}

function RoleIcon({ id }: { id: ClayBotId }) {
  if (id === 'docs') {
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
        <path d="M7 3h7l4 4v14H7V3z" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M14 3v4h4M9 12h6M9 16h5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === 'code') {
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
        <path
          d="M8 8 4 12l4 4M16 8l4 4-4 4M13 6l-2 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === 'science') {
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
        <path
          d="M9 3h6M10 3v6L6 18a3 3 0 0 0 2.7 4h6.6A3 3 0 0 0 18 18l-4-9V3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 8v8M9.5 10.5c.8-1 2-1.5 2.5-1.5s1.8.4 2.5 1.5M9.5 13.5c.8 1 2 1.5 2.5 1.5s1.8-.4 2.5-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type ExpertPackProps = {
  id: ClayBotId;
  name: string;
  role: string;
  className?: string;
  /** Compact: ClayAvatar only (hero greeting) */
  compact?: boolean;
};

export function ExpertPack({
  id,
  name,
  role,
  className = '',
  compact = false,
}: ExpertPackProps) {
  const spec = EXPERT_SPECS[id];

  if (compact) {
    return (
      <div className={`expert-pack is-compact ${className}`}>
        <ClayAvatar
          bot={id}
          size={44}
          autoPlay
          followPointer={false}
          showGround={false}
          aria-label={name}
        />
      </div>
    );
  }

  return (
    <article
      className={`expert-pack expert-pack--${id} ${className}`}
      aria-label={`${name} — ${role}`}
    >
      <div className="expert-pack-card">
        <PackLanyard id={id} />

        <div className="expert-pack-badge">
          <div className="expert-pack-hang" aria-hidden>
            <PackRing id={id} layer="back" />
            <span className="expert-pack-hang-hole" />
            <PackRing id={id} layer="front" />
          </div>

          <div className="expert-pack-shell">
            <span className="expert-pack-icon" aria-hidden>
              <RoleIcon id={id} />
            </span>

            <div className="expert-pack-well">
              <div className="expert-pack-figure">
                <ClayAvatar
                  bot={id}
                  size={128}
                  autoPlay
                  followPointer={false}
                  showGround={false}
                  aria-label={name}
                />
                <div className="expert-pack-sticker" aria-hidden>
                  <div className="expert-pack-sticker-brand">
                    <span className="expert-pack-sticker-mark">
                      <span className="expert-pack-sticker-glyph" />
                      KENSE
                    </span>
                    <span>{spec.code}</span>
                  </div>
                  <div className="expert-pack-sticker-meta">
                    <span>{spec.sku}</span>
                    <span className="expert-pack-barcode" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="expert-pack-caption">{role}</p>
    </article>
  );
}
