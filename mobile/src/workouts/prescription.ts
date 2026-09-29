type Prescription = {
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  weight_kg: number | null;
};

/** What an exercise asks for, in one line: "3 組 × 8 · 20 kg", "20 分鐘", or a bare "10 次". */
export function formatPrescription(item: Prescription): string {
  const base = item.duration_sec
    ? `${Math.round(item.duration_sec / 60)} 分鐘`
    : item.sets === null
      ? (item.reps ?? '')
      : `${item.sets} 組 × ${item.reps}`;
  return item.weight_kg !== null ? `${base} · ${item.weight_kg} kg` : base;
}
