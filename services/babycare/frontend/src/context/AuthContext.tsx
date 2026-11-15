import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, name?: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      // If not logged in, auto-login with default demo user in dev
      try {
        const res = await api.devLogin('parent@hd2lab.org', '향단이 부모', 'user');
        localStorage.setItem('babycare_access_token', res.access_token);
        setUser(res.user);
      } catch (e) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, name?: string, role: string = 'user') => {
    setIsLoading(true);
    try {
      const res = await api.devLogin(email, name, role);
      localStorage.setItem('babycare_access_token', res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('babycare_access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
