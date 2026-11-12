import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setToken, getToken } from './api';

export interface Perm { can_view: number; can_create: number; can_edit: number; can_delete: number; }
export interface StaffUser {
  id: number; username: string; full_name: string; role_code: string;
  permissions: Record<string, Perm>;
}

interface AuthCtx {
  user: StaffUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (menu: string, action?: keyof Perm) => boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: async () => {}, logout: async () => {}, can: () => false });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then(d => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const d = await api.post('/api/auth/login', { username, password });
    setToken(d.access_token);
    setUser(d.user);
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* abaikan */ }
    setToken(null);
    setUser(null);
  };

  const can = (menu: string, action: keyof Perm = 'can_view') => {
    const p = user?.permissions?.[menu];
    return Boolean(p && p[action]);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, can }}>{children}</Ctx.Provider>;
}
