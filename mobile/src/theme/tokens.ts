/** SVG and charts cannot take a className, so the colours are repeated here.
 *  Keep in sync with tailwind.config.js. */
export const color = {
  /** Titles, names, main numbers and input values. */
  ink: '#30302E',
  /** Notes, units, targets and legends. */
  muted: '#514E49',
  placeholder: '#625E58',
  /** A control that cannot be used, such as the next-day arrow on today. */
  disabled: '#776D65',
  /** The dark outline of cards, buttons and inputs. */
  edge: '#3E3A39',
  /** Hairlines between rows and chart grid lines. */
  line: '#E7DFD5',
  /** Progress tracks and quiet neutral fills. */
  fill: '#F3EDE4',
  bg: '#FFFCF6',
  surface: '#FFFFFF',
  primary: '#A32B64',
  primarySoft: '#F6E3EC',
  good: '#30694D',
  goodSoft: '#E3EFD9',
  /** Text for going over the target and for skipped steps. */
  warm: '#89580E',
  warmSoft: '#FFF2D7',
  /** Bars that went over the target, and the fat bar. */
  warmFill: '#B17B23',
  purple: '#7450A5',
  purpleSoft: '#EEE5F8',
  danger: '#B42318',
} as const;

/** Category accents used by meal composition cards and their generated SVG icons. */
export const foodCategoryColor = {
  staple: { accent: '#89580E', soft: '#FFF2D7' },
  protein: { accent: '#A32B64', soft: '#F6E3EC' },
  vegetable: { accent: '#30694D', soft: '#E3EFD9' },
  fruit: { accent: '#7450A5', soft: '#EEE5F8' },
  fat_sauce: { accent: '#514E49', soft: '#F3EDE4' },
  other: { accent: '#514E49', soft: '#F3EDE4' },
} as const;

export function foodCategoryTone(category: string | null | undefined) {
  return foodCategoryColor[category as keyof typeof foodCategoryColor] ?? foodCategoryColor.other;
}
