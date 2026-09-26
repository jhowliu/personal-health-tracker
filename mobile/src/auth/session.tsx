/**
 * Sign-in state. Screens see only status, profile and three actions — never SecureStore,
 * never a raw token.
 *
 * status:
 *   loading   - still reading the locally stored token
 *   signedOut - needs to sign in
 *   newUser   - signed in but has not created a profile yet
 *   ready     - good to go
 *   unavailable - stored sign-in is valid but the server cannot currently be reached
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, api, setTokenStore, type Schema, type Tokens } from '@/api/client';
import { secureStorage } from '@/auth/storage';

const TOKEN_KEY = 'pht.tokens';

let cached: Tokens | null = null;
let tokenStoreInitialized = false;
let onTokensInvalidated: (() => void) | null = null;
let tokenSessionVersion = 0;
let storageQueue = Promise.resolve();

async function store(tokens: Tokens | null) {
  cached = tokens;
  tokenStoreInitialized = true;
  const operation = storageQueue.then(() =>
    tokens ? secureStorage.set(TOKEN_KEY, JSON.stringify(tokens)) : secureStorage.remove(TOKEN_KEY),
  );
  storageQueue = operation.catch(() => {});
  await operation;
}

async function writeForSession(tokens: Tokens, sessionVersion: number) {
  if (tokenSessionVersion !== sessionVersion) return false;
  await store(tokens);
  return tokenSessionVersion === sessionVersion;
}

async function clearForSession(sessionVersion: number) {
  if (tokenSessionVersion !== sessionVersion) return false;
  await store(null);
  return tokenSessionVersion === sessionVersion;
}

async function load(): Promise<Tokens | null> {
  if (tokenStoreInitialized) return cached;
  const sessionVersion = tokenSessionVersion;
  const raw = await secureStorage.get(TOKEN_KEY);
  if (tokenStoreInitialized || tokenSessionVersion !== sessionVersion) return cached;
  if (!raw) {
    tokenStoreInitialized = true;
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await store(null);
    return null;
  }

  if (!isTokens(parsed)) {
    await store(null);
    return null;
  }
  cached = parsed;
  tokenStoreInitialized = true;
  if (tokenSessionVersion === 0) tokenSessionVersion = 1;
  return cached;
}

function isTokens(value: unknown): value is Tokens {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.access_token === 'string' &&
    candidate.access_token.length > 0 &&
    typeof candidate.refresh_token === 'string' &&
    candidate.refresh_token.length > 0
  );
}

setTokenStore({
  read: load,
  write: store,
  writeForSession,
  clearForSession,
  getSessionVersion: () => tokenSessionVersion,
  onInvalidated: () => onTokensInvalidated?.(),
});

export type SessionStatus = 'loading' | 'signedOut' | 'newUser' | 'ready' | 'unavailable';
export type ProfileWithTargets = Schema<'ProfileWithTargetsOut'>;

type Session = {
  status: SessionStatus;
  profile: ProfileWithTargets | null;
  signIn: (path: '/auth/login' | '/auth/register', body: unknown) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

type SessionProviderProps = {
  children: ReactNode;
  onSignedOut?: () => void;
};

export function SessionProvider({ children, onSignedOut }: SessionProviderProps) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<ProfileWithTargets | null>(null);
  const statusRef = useRef<SessionStatus>('loading');
  const onSignedOutRef = useRef(onSignedOut);
  const generationRef = useRef(0);

  useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  const updateStatus = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const markSignedOut = useCallback(() => {
    const shouldNotify = statusRef.current !== 'signedOut';
    setProfile(null);
    updateStatus('signedOut');
    if (shouldNotify) onSignedOutRef.current?.();
  }, [updateStatus]);

  const clearSession = useCallback(async () => {
    generationRef.current += 1;
    tokenSessionVersion += 1;
    try {
      await store(null);
    } finally {
      markSignedOut();
    }
  }, [markSignedOut]);

  const reload = useCallback(async () => {
    const generation = generationRef.current;
    try {
      const nextProfile = await api.get('/users/me/profile');
      if (generation !== generationRef.current) return;
      setProfile(nextProfile);
      updateStatus('ready');
    } catch (error) {
      if (generation !== generationRef.current) return;
      if (error instanceof ApiError && error.status === 404) {
        setProfile(null);
        updateStatus('newUser');
      } else if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearSession();
      } else {
        if (statusRef.current === 'loading' || statusRef.current === 'unavailable') {
          updateStatus('unavailable');
        }
        throw error;
      }
    }
  }, [clearSession, updateStatus]);

  useEffect(() => {
    const handleInvalidation = () => {
      generationRef.current += 1;
      tokenSessionVersion += 1;
      markSignedOut();
    };
    onTokensInvalidated = handleInvalidation;
    return () => {
      if (onTokensInvalidated === handleInvalidation) onTokensInvalidated = null;
    };
  }, [markSignedOut]);

  useEffect(() => {
    void (async () => {
      try {
        if (await load()) await reload();
        else markSignedOut();
      } catch {
        // Keep valid stored credentials while a transient profile request is unavailable.
      }
    })();
  }, [markSignedOut, reload]);

  const signIn = useCallback<Session['signIn']>(
    async (path, body) => {
      generationRef.current += 1;
      const tokens = (await api.post(path, body)) as Tokens;
      tokenSessionVersion += 1;
      await store(tokens);
      updateStatus('loading');
      try {
        await reload();
      } catch (error) {
        if (statusRef.current !== 'unavailable') throw error;
      }
    },
    [reload, updateStatus],
  );

  const signOut = useCallback(async () => {
    generationRef.current += 1;
    try {
      await api.post('/auth/logout');
    } catch {
      // Sign out locally even when the backend never got the request
    }
    await clearSession();
  }, [clearSession]);

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
