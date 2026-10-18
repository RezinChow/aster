export type ClayBotId = 'docs' | 'code' | 'science' | 'finance';

/**
 * Grok-style bot skins: solid (or special) body fill + eye cutouts.
 */
export type ClayBotPreset = {
  id: ClayBotId;
  /** Solid body fill (ignored when fill === 'rainbow') */
  body: string;
  /** Soft rim / contact shadow */
  bodyDeep: string;
  /** Eye fill */
  eye: string;
  /** Domain accent */
  accent: string;
  /** Body paint mode */
  fill?: 'solid' | 'rainbow';
};

export const CLAY_BOTS: Record<ClayBotId, ClayBotPreset> = {
  docs: {
    id: 'docs',
    body: '#f5f7fc',
    bodyDeep: '#c9d0de',
    eye: '#15191f',
    accent: '#4e60ff',
  },
  code: {
    id: 'code',
    body: '#ff5eb1',
    bodyDeep: '#804ee0',
    eye: '#ffffff',
    accent: '#4e60ff',
    fill: 'rainbow',
  },
  science: {
    id: 'science',
    body: '#1aa8c4',
    bodyDeep: '#0e7a90',
    eye: '#ffffff',
    accent: '#b8f0fa',
  },
  finance: {
    id: 'finance',
    body: '#e08600',
    bodyDeep: '#a86200',
    eye: '#ffffff',
    accent: '#ffe0a8',
  },
};

export const CLAY_BOT_ORDER: ClayBotId[] = [
  'docs',
  'code',
  'science',
  'finance',
];
