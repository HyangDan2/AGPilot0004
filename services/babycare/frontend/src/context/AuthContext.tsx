import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOtpModalOpen: boolean;
  welcomeMessage: string | null;
  clearWelcomeMessage: () => void;
  openOtpLogin: () => void;
  closeOtpLogin: () => void;
  completeOtpLogin: (token: string, userData: User, rememberMe?: boolean) => void;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  login: (email: string, name?: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  const showWelcome = (name?: string | null) => {
    const displayName = (name || '사용자').trim();
    setWelcomeMessage(`${displayName}님, 환영합니다!`);
    window.setTimeout(() => {
      setWelcomeMessage((prev) => (prev === `${displayName}님, 환영합니다!` ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'google') {
        showWelcome(me?.name || me?.email?.split('@')[0]);
        params.delete('auth');
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      localStorage.removeItem('babycare_access_token');
      sessionStorage.removeItem('babycare_access_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (rememberMe: boolean = false) => {
    try {
      const st = await api.getGoogleAuthStatus();
      if (!st.configured) {
        alert('현재 서버에 Google OAuth 설정(GOOGLE_CLIENT_ID)이 준비 중입니다. 이메일 6자리 OTP 로그인을 이용해 주세요.');
        return;
      }
      const sep = st.login_url.includes('?') ? '&' : '?';
      window.location.href = `${st.login_url}${sep}remember_me=${rememberMe ? 'true' : 'false'}`;
    } catch {
      alert('Google 로그인 연결 상태를 확인할 수 없습니다.');
    }
  };

  const login = async (email: string, name?: string, role: string = 'user') => {
    setIsLoading(true);
    try {
      const res = await api.devLogin(email, name, role);
      sessionStorage.setItem('babycare_access_token', res.access_token);
      setUser(res.user);
      showWelcome(res.user.name || res.user.email?.split('@')[0]);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('babycare_access_token');
    sessionStorage.removeItem('babycare_access_token');
    setUser(null);
  };

  const clearWelcomeMessage = () => setWelcomeMessage(null);
  const openOtpLogin = () => setIsOtpModalOpen(true);
  const closeOtpLogin = () => setIsOtpModalOpen(false);
  const completeOtpLogin = (token: string, userData: User, rememberMe: boolean = false) => {
    const isPrivileged = ['admin', 'admiral', 'overlord'].includes((userData.role || '').toLowerCase());
    localStorage.removeItem('babycare_access_token');
    sessionStorage.removeItem('babycare_access_token');
    if (rememberMe && !isPrivileged) {
      localStorage.setItem('babycare_access_token', token);
    } else {
      sessionStorage.setItem('babycare_access_token', token);
    }
    setUser(userData);
    setIsOtpModalOpen(false);
    showWelcome(userData.name || userData.email?.split('@')[0]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isOtpModalOpen,
        welcomeMessage,
        clearWelcomeMessage,
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
