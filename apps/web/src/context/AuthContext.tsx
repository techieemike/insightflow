'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, login as apiLogin, register as apiRegister } from '@/lib/api';

interface User { id: string; email: string; name: string; }

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const cached = localStorage.getItem('user');
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { localStorage.removeItem('user'); }
    }
    if (!token) { setLoading(false); return; }

    const forceTimeout = setTimeout(() => setLoading(false), 8000);

    getMe().then(r => setUser(r.data)).catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }).finally(() => {
      clearTimeout(forceTimeout);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiLogin(email, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const { data } = await apiRegister(email, password, name);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
