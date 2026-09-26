/**
 * The only way this app talks to the backend.
 *
 * Callers supply a path and a body. They never deal with the base URL, the Authorization
 * header, swapping an expired access token for a fresh one and replaying the request, or
 * digging the error message out of a response.
 *
 * Token storage is injected via setTokenStore, so tests can swap in an in-memory one.
 */
import type { paths } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export type Tokens = { access_token: string; refresh_token: string };

export type TokenStore = {
  read: () => Promise<Tokens | null>;
  write: (tokens: Tokens | null) => Promise<void>;
  writeForSession?: (tokens: Tokens, sessionVersion: number) => Promise<boolean>;
  clearForSession?: (sessionVersion: number) => Promise<boolean>;
  getSessionVersion?: () => number;
  onInvalidated?: () => void;
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
const refreshPromises = new Map<number, Promise<boolean>>();

export function setTokenStore(store: TokenStore) {
  tokenStore = store;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body?: unknown, retry = true): Promise<unknown> {
  const { tokens, sessionVersion } = await readTokenSnapshot();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(tokens ? { Authorization: `Bearer ${tokens.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && tokens) {
    const latest = await readTokenSnapshot();
    if (latest.sessionVersion !== sessionVersion) return fail(response);
    if (latest.tokens && latest.tokens.access_token !== tokens.access_token) {
      return send(method, path, body, false);
    }
    if (!latest.tokens) return fail(response);
    if (retry) {
      return (await refresh(tokens, sessionVersion)) ? send(method, path, body, false) : fail(response);
    }
    await invalidateTokens(sessionVersion);
  }
  if (!response.ok) return fail(response);
  return response.status === 204 ? undefined : response.json();
}

async function readTokenSnapshot(): Promise<{ tokens: Tokens | null; sessionVersion: number }> {
  const before = tokenStore.getSessionVersion?.() ?? 0;
  const tokens = await tokenStore.read();
  const after = tokenStore.getSessionVersion?.() ?? 0;
  return before === after ? { tokens, sessionVersion: after } : readTokenSnapshot();
}

async function invalidateTokens(sessionVersion: number) {
  if ((tokenStore.getSessionVersion?.() ?? 0) !== sessionVersion) return;
  const cleared = tokenStore.clearForSession
    ? await tokenStore.clearForSession(sessionVersion)
    : await clearCurrentSessionFallback(sessionVersion);
  if (cleared && (tokenStore.getSessionVersion?.() ?? 0) === sessionVersion) {
    tokenStore.onInvalidated?.();
  }
}

async function clearCurrentSessionFallback(sessionVersion: number) {
  await tokenStore.write(null);
  return (tokenStore.getSessionVersion?.() ?? 0) === sessionVersion;
}

async function refresh(tokens: Tokens, sessionVersion: number): Promise<boolean> {
  let promise = refreshPromises.get(sessionVersion);
  if (!promise) {
    promise = performRefresh(tokens, sessionVersion).finally(() => {
      refreshPromises.delete(sessionVersion);
    });
    refreshPromises.set(sessionVersion, promise);
  }
  return promise;
}

async function performRefresh(tokens: Tokens, sessionVersion: number): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });
  } catch (error) {
    // A temporary network failure does not prove the refresh token is invalid.
    throw error;
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await invalidateTokens(sessionVersion);
      return false;
    }
    return fail(response);
  }
  try {
    const refreshed = (await response.json()) as Tokens;
    if (tokenStore.writeForSession) {
      if (!(await tokenStore.writeForSession(refreshed, sessionVersion))) return false;
    } else {
      if ((tokenStore.getSessionVersion?.() ?? 0) !== sessionVersion) return false;
      await tokenStore.write(refreshed);
    }
    return true;
  } catch (error) {
    await invalidateTokens(sessionVersion);
    throw error;
  }
}

async function fail(response: Response): Promise<never> {
  let detail = `請求失敗(${response.status})`;
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') detail = body.detail;
    else if (Array.isArray(body?.detail)) detail = body.detail[0]?.msg ?? detail;
  } catch {
    // Response was not JSON — keep the default message
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
