import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOtpModalOpen: boolean;
  openOtpLogin: () => void;
  closeOtpLogin: () => void;
  completeOtpLogin: (token: string, userData: User) => void;
  loginWithGoogle: () => Promise<void>;
  login: (email: string, name?: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      localStorage.removeItem('babycare_access_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const st = await api.getGoogleAuthStatus();
      if (!st.configured) {
        alert('현재 서버에 Google OAuth 설정(GOOGLE_CLIENT_ID)이 준비 중입니다. 설정 완료 후 Google 계정으로 로그인할 수 있습니다.');
        return;
      }
      window.location.href = st.login_url;
    } catch {
      alert('Google 로그인 연결 상태를 확인할 수 없습니다.');
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

  const openOtpLogin = () => setIsOtpModalOpen(true);
  const closeOtpLogin = () => setIsOtpModalOpen(false);
  const completeOtpLogin = (token: string, userData: User) => {
    localStorage.setItem('babycare_access_token', token);
    setUser(userData);
    setIsOtpModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isOtpModalOpen,
        openOtpLogin,
        closeOtpLogin,
        completeOtpLogin,
        loginWithGoogle,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
