/**
 * 登入狀態。畫面只看到 status、profile 和三個動作,不碰 SecureStore 也不碰 token。
 *
 * status:
 *   loading   — 還在讀本機存的 token
 *   signedOut — 要登入
 *   newUser   — 登入了但還沒建個人資料
 *   ready     — 可以用
 */
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, api, setTokenStore, type Schema, type Tokens } from '@/api/client';
import { secureStorage } from '@/auth/storage';

const TOKEN_KEY = 'pht.tokens';

let cached: Tokens | null = null;

async function store(tokens: Tokens | null) {
  cached = tokens;
  if (tokens) await secureStorage.set(TOKEN_KEY, JSON.stringify(tokens));
  else await secureStorage.remove(TOKEN_KEY);
}

async function load(): Promise<Tokens | null> {
  if (cached) return cached;
  const raw = await secureStorage.get(TOKEN_KEY);
  cached = raw ? (JSON.parse(raw) as Tokens) : null;
  return cached;
}

setTokenStore({ read: load, write: store });

export type SessionStatus = 'loading' | 'signedOut' | 'newUser' | 'ready';
export type ProfileWithTargets = Schema<'ProfileWithTargetsOut'>;

type Session = {
  status: SessionStatus;
  profile: ProfileWithTargets | null;
  signIn: (path: '/auth/login' | '/auth/register', body: unknown) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<ProfileWithTargets | null>(null);

  const reload = useCallback(async () => {
    try {
      setProfile(await api.get('/users/me/profile'));
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setProfile(null);
        setStatus('newUser');
      } else {
        await store(null);
        setProfile(null);
        setStatus('signedOut');
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (await load()) await reload();
      else setStatus('signedOut');
    })();
  }, [reload]);

  const signIn = useCallback<Session['signIn']>(
    async (path, body) => {
      await store((await api.post(path, body)) as Tokens);
      await reload();
    },
    [reload],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // 就算後端沒收到,本機還是要登出
    }
    await store(null);
    setProfile(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({ status, profile, signIn, signOut, reload }),
    [status, profile, signIn, signOut, reload],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession 必須放在 SessionProvider 底下');
  return session;
}
