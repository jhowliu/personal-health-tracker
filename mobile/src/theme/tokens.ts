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
  danger: '#B42318',
  placeholder: '#9C9599',
} as const;

/** Category accents used by meal composition cards and their generated SVG icons. */
export const foodCategoryColor = {
  staple: { accent: '#C77A08', soft: '#FFF1D8' },
  protein: { accent: '#D94B67', soft: '#FCE6EB' },
  vegetable: { accent: '#4F8E3C', soft: '#E8F3E4' },
  fruit: { accent: '#A3245F', soft: '#F6E3EC' },
  fat_sauce: { accent: '#7650B5', soft: '#EEE7F8' },
  other: { accent: '#5E585B', soft: '#EFEBE5' },
} as const;

export function foodCategoryTone(category: string | null | undefined) {
  return foodCategoryColor[category as keyof typeof foodCategoryColor] ?? foodCategoryColor.other;
}
