/**
 * 跟後端說話的唯一入口。
 *
 * 呼叫端只要給路徑和 body,不必知道:base URL、Authorization header、
 * access token 過期時自動用 refresh token 換新的再重送、錯誤訊息怎麼從回應裡挖出來。
 * token 怎麼存由 setTokenStore 注入,測試可以換成記憶體版本。
 */
import type { paths } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export type Tokens = { access_token: string; refresh_token: string };

export type TokenStore = {
  read: () => Promise<Tokens | null>;
  write: (tokens: Tokens | null) => Promise<void>;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let tokenStore: TokenStore = {
  read: async () => null,
  write: async () => {},
};

export function setTokenStore(store: TokenStore) {
  tokenStore = store;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body?: unknown, retry = true): Promise<unknown> {
  const tokens = await tokenStore.read();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(tokens ? { Authorization: `Bearer ${tokens.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && retry && tokens) {
    return (await refresh(tokens)) ? send(method, path, body, false) : fail(response);
  }
  if (!response.ok) return fail(response);
  return response.status === 204 ? undefined : response.json();
}

async function refresh(tokens: Tokens): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  });
  if (!response.ok) {
    await tokenStore.write(null);
    return false;
  }
  await tokenStore.write((await response.json()) as Tokens);
  return true;
}

async function fail(response: Response): Promise<never> {
  let detail = `請求失敗(${response.status})`;
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') detail = body.detail;
    else if (Array.isArray(body?.detail)) detail = body.detail[0]?.msg ?? detail;
  } catch {
    // 回應不是 JSON,用預設訊息
  }
  throw new ApiError(response.status, detail);
}

type Json<T> = T extends { content: { 'application/json': infer B } } ? B : never;
type Ok<T> = T extends { 200: infer R } ? Json<R> : T extends { 201: infer R } ? Json<R> : void;

type Get<P extends keyof paths> = paths[P] extends { get: { responses: infer R } } ? Ok<R> : never;
type Post<P extends keyof paths> = paths[P] extends { post: { responses: infer R } } ? Ok<R> : never;
type Put<P extends keyof paths> = paths[P] extends { put: { responses: infer R } } ? Ok<R> : never;
type Patch<P extends keyof paths> = paths[P] extends { patch: { responses: infer R } }
  ? Ok<R>
  : never;

export const api = {
  get: <P extends keyof paths & string>(path: P | (string & {})) =>
    send('GET', path) as Promise<Get<P>>,
  post: <P extends keyof paths & string>(path: P | (string & {}), body?: unknown) =>
    send('POST', path, body ?? {}) as Promise<Post<P>>,
  put: <P extends keyof paths & string>(path: P | (string & {}), body?: unknown) =>
    send('PUT', path, body ?? {}) as Promise<Put<P>>,
  patch: <P extends keyof paths & string>(path: P | (string & {}), body?: unknown) =>
    send('PATCH', path, body ?? {}) as Promise<Patch<P>>,
  delete: (path: string) => send('DELETE', path) as Promise<void>,
};

export type components = import('./types').components;
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];
