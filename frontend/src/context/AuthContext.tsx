import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, clearToken, setToken, getToken } from '../api/client';
import { SafeUser } from '../types';

interface AuthContextValue {
  user: SafeUser | null;
  loading: boolean;
  /** True when the signed-in account still has must_change_password set. */
  forced: boolean;
  login: (fileNumber: string, password: string) => Promise<SafeUser>;
  logout: () => void;
  /** Re-fetches /auth/me, e.g. after a password change clears the forced flag. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const res = await api.get<{ user: SafeUser }>('/auth/me');
    setUser(res.user);
    return res.user;
  }, []);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        await fetchMe();
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchMe]);

  async function login(fileNumber: string, password: string): Promise<SafeUser> {
    const res = await api.post<{ token: string; user: SafeUser }>('/auth/login', { fileNumber, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  async function refreshUser() {
    if (!getToken()) return;
    await fetchMe();
  }

  const forced = !!user && !!user.must_change_password;

  return (
    <AuthContext.Provider value={{ user, loading, forced, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
