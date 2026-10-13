import { translate } from '@/i18n/translator';

type Prescription = {
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  weight_kg: number | null;
};

/** What an exercise asks for, in one line: "3 組 × 8 · 20 kg", "20 分鐘", or a bare "10 次". */
export function formatPrescription(item: Prescription): string {
  const base = item.duration_sec
    ? `${Math.round(item.duration_sec / 60)} ${translate('common.units.minute')}`
    : item.sets === null
      ? (item.reps ?? '')
      : translate('workouts.editor.setsRepsSummary', { sets: item.sets, reps: item.reps ?? '' });
  return item.weight_kg !== null ? `${base} · ${item.weight_kg} kg` : base;
}
