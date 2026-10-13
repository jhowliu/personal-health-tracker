import { catalogs, type MessageKey } from '@/i18n';
import { getActiveLocale, translate } from '@/i18n/translator';

/** What a request error says to a person, including legacy Chinese server messages. */
const FIELD_LABEL: Record<string, MessageKey> = {
  email: 'common.labels.email',
  password: 'api.fields.password',
  name: 'api.fields.name',
  reps: 'api.fields.reps',
  sets: 'api.fields.sets',
  weight_kg: 'api.fields.weight',
  height_cm: 'api.fields.height',
  grams: 'api.fields.grams',
  duration_sec: 'api.fields.duration',
  rest_sec: 'api.fields.rest',
  speed_kmh: 'api.fields.speed',
  incline_pct: 'api.fields.incline',
};

const HAS_CHINESE = /[一-鿿]/;

type ApiErrorName = keyof (typeof catalogs)['zh-TW']['api']['errors'];

// Catalog parity is tested. This one local assertion restores the key type lost by Object.keys.
const apiErrorNames = Object.keys(catalogs['zh-TW'].api.errors) as ApiErrorName[];
const legacyMessages = new Map<string, ApiErrorName>(
  apiErrorNames.map((name) => [catalogs['zh-TW'].api.errors[name], name] as const),
);

function legacyError(message: string): string | null {
  const name = legacyMessages.get(message);
  if (!name) return null;
  const key: MessageKey = `api.errors.${name}`;
  return translate(key);
}

export function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === 'string') {
    return legacyError(detail) ??
      (HAS_CHINESE.test(detail) && getActiveLocale() === 'en'
        ? translate('common.errors.tryAgain')
        : detail);
  }
  const first = Array.isArray(detail) ? detail[0] : null;
  if (!first || typeof first !== 'object') {
    return translate('common.errors.requestFailed', { status });
  }
  // A model check in the API raises in Chinese; pydantic only puts "Value error, " in front.
  const message = String((first as { msg?: unknown }).msg ?? '').replace(/^Value error, /, '');
  if (HAS_CHINESE.test(message)) {
    return legacyError(message) ??
      (getActiveLocale() === 'en' ? translate('common.errors.invalidInput') : message);
  }
  const loc = (first as { loc?: unknown }).loc;
  const field = Array.isArray(loc) ? [...loc].reverse().find((part) => typeof part === 'string') : undefined;
  if (field === 'email') return translate('common.errors.invalidEmail');
  const labelKey = typeof field === 'string' ? FIELD_LABEL[field] : undefined;
  return labelKey
    ? translate('common.errors.invalidField', { field: translate(labelKey) })
    : translate('common.errors.invalidInput');
}
