import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Config, type User } from './api';

type Session = {
  config: Config | null;
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [cfg, me] = await Promise.all([api<Config>('/api/config'), api<{ user: User | null }>('/api/me')]);
    setConfig(cfg);
    setUser(me.user);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  return <SessionContext.Provider value={{ config, user, loading, refresh, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
