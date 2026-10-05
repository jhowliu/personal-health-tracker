/**
 * What a request's error says, for people. FastAPI's own validation errors come in English
 * and name a field; the app's own come already written in Chinese and pass through.
 */
const FIELD_LABEL: Record<string, string> = {
  email: 'Email',
  password: '密碼',
  name: '名稱',
  reps: '次數',
  sets: '組數',
  weight_kg: '重量',
  height_cm: '身高',
  grams: '份量',
  duration_sec: '時間',
  rest_sec: '休息時間',
  speed_kmh: '速度',
  incline_pct: '坡度',
};

const HAS_CHINESE = /[一-鿿]/;

export function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail;
  const first = Array.isArray(detail) ? detail[0] : null;
  if (!first || typeof first !== 'object') return `請求失敗（${status}）`;
  // A model check in the API raises in Chinese; pydantic only puts "Value error, " in front.
  const message = String((first as { msg?: unknown }).msg ?? '').replace(/^Value error, /, '');
  if (HAS_CHINESE.test(message)) return message;
  const loc = (first as { loc?: unknown }).loc;
  const field = Array.isArray(loc) ? [...loc].reverse().find((part) => typeof part === 'string') : undefined;
  if (field === 'email') return 'Email 格式不正確，請確認有沒有打錯。';
  const label = typeof field === 'string' ? FIELD_LABEL[field] : undefined;
  return label ? `${label}的格式不正確。` : '輸入的資料格式不正確，請檢查後再試。';
}
