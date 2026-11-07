import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Baby, Shield, UserCheck, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [isLoading, setIsLoading] = useState(false);

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      await login(email, name || email.split('@')[0], role);
      navigate('/');
    } catch (err: any) {
      alert(err.message || '로그인 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaLogin = async (pEmail: string, pName: string, pRole: string) => {
    setIsLoading(true);
    try {
      await login(pEmail, pName, pRole);
      navigate('/');
    } catch (err: any) {
      alert(err.message || '로그인 실패');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-blue-600 text-white shadow-md">
            <span className="hd2-skew-mark" style={{ borderColor: '#ffffff', width: 16, height: 20 }} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">HD²LAB BabyCare</h1>
          <p className="text-xs text-slate-500">통합 영유아 성장 및 맞춤 케어 웹 플랫폼</p>
        </div>

        {/* Quick Persona Switcher */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
            빠른 테스트 페르소나 선택
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePersonaLogin('parent1@hd2lab.org', '엄마/아빠 (소유자)', 'user')}
              className="p-3 rounded-2xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-left transition-colors"
            >
              <span className="text-xs font-bold text-blue-900 block">👑 부모 소유자</span>
              <span className="text-[11px] text-blue-700">전체 CRUD 및 관리</span>
            </button>
            <button
              onClick={() => handlePersonaLogin('caregiver1@hd2lab.org', '베이비시터 이모님', 'user')}
              className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-colors"
            >
              <span className="text-xs font-bold text-emerald-900 block">🍼 공동 양육자</span>
              <span className="text-[11px] text-emerald-700">수유/수면 기록 전용</span>
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-xs text-slate-400 font-semibold uppercase absolute">
            또는 직접 로그인
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleCustomLogin} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">이메일 주소</label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">이름 / 닉네임</label>
            <input
              type="text"
              placeholder="예: 지우 아빠"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-sm shadow-md transition-all active:scale-95"
          >
            <span>{isLoading ? '접속 중...' : '시작하기'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          HD2Lab 서버(hd2lab.duckdns.org) 프록시 연동 시에는 Google OAuth 헤더로 자동 로그인됩니다.
        </p>
      </div>
    </div>
  );
};
