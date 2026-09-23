/** SVG 與圖表拿不到 className,顏色在這裡再給一份,與 tailwind.config.js 同步。 */
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

/** 可點擊區域至少 44 px(規格書元件規則)。 */
export const MIN_TAP_SIZE = 44;
