/** SVG and charts cannot take a className, so the colours are repeated here.
 *  Keep in sync with tailwind.config.js. */
export const color = {
  ink: '#1F1B1D',
  muted: '#5E585B',
  line: '#D9D3CB',
  fill: '#EFEBE5',
  bg: '#FBFAF7',
  surface: '#FFFFFF',
  primary: '#A3245F',
  primarySoft: '#F6E3EC',
  good: '#2F6B4C',
  goodSoft: '#E2F0E7',
  warm: '#8A5A0B',
  warmSoft: '#F6EBD3',
} as const;

/** Tap targets are at least 44 px, per the spec's component rules. */
export const MIN_TAP_SIZE = 44;
