import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api } from '@/lib/api';

interface User {
  user_id: number;
  username: string;
  role: string;
  company?: string;
  department?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  modelInfo: { model: string; synced: boolean } | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  modelInfo: null,
});

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelInfo, setModelInfo] = useState<{ model: string; synced: boolean } | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.me();
      if (res.code === 0 && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModel = useCallback(async () => {
    try {
      const res = await api.modelStatus();
      if (res.code === 0 && res.data) {
        const model = typeof res.data.model === 'object' ? (res.data.model as any).default : res.data.model;
        setModelInfo({ model: model || '未配置', synced: res.data.synced });
      }
    } catch {}
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (username: string, password: string) => {
    const fp = navigator.userAgent + '|' + screen.width + 'x' + screen.height;
    const res = await api.login(username, password, fp);
    if (res.code === 0 && res.data) {
      setUser(res.data);
      loadModel();
    }
  };

  const register = async (data: Record<string, string>) => {
    await api.register(data);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    document.cookie = 'law_token=;max-age=0;path=/;domain=' + location.hostname;
    document.cookie = 'law_token=;max-age=0;path=/';
    setUser(null);
  };

  return { user, loading, login, register, logout, modelInfo, loadModel };
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getGuestToken(): string {
  let gt = localStorage.getItem('guest_token');
  if (!gt) {
    gt = 'guest_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('guest_token', gt);
  }
  return gt;
}
