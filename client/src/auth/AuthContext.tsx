import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, UserDTO } from '@linguapath/shared';
import { onSessionChange, refreshSession, setAccessToken } from '../api/client';
import { authApi } from '../api/endpoints';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: UserDTO | null;
  login: (email: string, password: string) => Promise<UserDTO>;
  register: (data: { email: string; password: string; name: string }) => Promise<UserDTO>;
  logout: () => Promise<void>;
  applySession: (auth: AuthResponse) => void;
  setUser: (user: UserDTO) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<UserDTO | null>(null);
  const queryClient = useQueryClient();

  const applySession = useCallback((auth: AuthResponse) => {
    setAccessToken(auth.accessToken);
    setUserState(auth.user);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionChange((auth) => {
      if (auth) {
        setUserState(auth.user);
        setStatus('authenticated');
      } else {
        setUserState(null);
        setStatus('anonymous');
        queryClient.clear();
      }
    });
    refreshSession().catch(() => setStatus('anonymous'));
    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await authApi.login({ email, password });
      queryClient.clear();
      applySession(auth);
      return auth.user;
    },
    [applySession, queryClient],
  );

  const register = useCallback(
    async (data: { email: string; password: string; name: string }) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const auth = await authApi.register({ ...data, timezone });
      queryClient.clear();
      applySession(auth);
      return auth.user;
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUserState(null);
      setStatus('anonymous');
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ status, user, login, register, logout, applySession, setUser: setUserState }),
    [status, user, login, register, logout, applySession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
