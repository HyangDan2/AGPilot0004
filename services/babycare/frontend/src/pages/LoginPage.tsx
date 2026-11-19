import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { completeOtpLogin, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isBusy, setIsBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsBusy(true);
    setStatusMsg(null);
    setIsError(false);
    try {
      const res = await api.requestEmailOtp(email.trim());
      setStep('code');
      setStatusMsg(res.message);
    } catch (err: any) {
      setIsError(true);
      setStatusMsg(err.message || '인증 코드 발송에 실패했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || code.trim().length !== 6) return;
    setIsBusy(true);
    setStatusMsg(null);
    setIsError(false);
    try {
      const res = await api.verifyEmailOtp(
        email.trim(),
        code.trim(),
        name.trim() || undefined,
        rememberMe
      );
      completeOtpLogin(res.access_token, res.user, rememberMe);
      navigate('/', { replace: true });
    } catch (err: any) {
      setIsError(true);
      setStatusMsg(err.message || '인증 코드 확인에 실패했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-[var(--panel)] rounded-3xl p-8 shadow-xl border border-[var(--line)] space-y-6">
        {/* Brand Header (Official HD2Lab .hd2-mark) */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center gap-3.5">
            <span className="hd2-mark" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-[-0.8px] text-[var(--text)]">
              HD2Lab <span className="text-[var(--accent)]">BabyCare</span>
            </h1>
          </div>
          <p className="text-xs text-[var(--muted)]">통합 영유아 성장 및 맞춤 케어 웹 플랫폼 · Crew 로그인</p>
        </div>

        {/* Remember Me Checkbox (Crew only; Admiral/Overlord excluded) */}
        <label className="flex items-start gap-2.5 rounded-2xl bg-[#F4F1FC] border border-[#E8E4F2] p-3.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="mt-0.5 rounded border-[#D4CCE8] text-[#8B6CE8] focus:ring-[#8B6CE8]"
          />
          <div className="text-xs leading-snug">
            <span className="font-bold text-[#1D192B]">로그인 상태를 유지하겠습니까?</span>
            <p className="text-[11px] text-[#68627A] mt-0.5">
              Crew 계정 전용 (체크 시 7일 유지, 해제 시 브라우저 종료 시 자동 로그아웃 · Admiral 계정은 미적용)
            </p>
          </div>
        </label>

        {/* Primary Google OAuth Button */}
        <button
          type="button"
          onClick={() => loginWithGoogle(rememberMe)}
          className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-[#F4F1FC] border border-[#D4CCE8] text-[#1D192B] py-3 px-4 text-sm font-bold shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.29V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1z" />
            <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95z" />
          </svg>
          <span>Google 계정으로 로그인 (Crew)</span>
        </button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-[#E8E4F2]" />
          <span className="mx-3 text-[11px] font-semibold text-[#68627A]">또는 이메일 6자리 OTP</span>
          <div className="flex-grow border-t border-[#E8E4F2]" />
        </div>

        {/* Email OTP Form */}
        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#1D192B] mb-1">이메일 주소</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4F2] px-3.5 py-2.5 text-sm focus:border-[#8B6CE8] focus:outline-none"
              />
            </div>

            {statusMsg && (
              <p className={`text-xs font-semibold ${isError ? 'text-rose-600' : 'text-[#6B4CD6]'}`}>
                {statusMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] disabled:opacity-50 text-white font-bold py-3 text-sm shadow-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>{isBusy ? '인증 코드 발송 중...' : '6자리 인증 코드 받기'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3.5">
            {statusMsg && (
              <p className={`text-xs font-semibold ${isError ? 'text-rose-600' : 'text-[#6B4CD6]'}`}>
                {statusMsg}
              </p>
            )}

            <div>
              <label className="block text-xs font-bold text-[#1D192B] mb-1">6자리 인증 코드</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4F2] px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] focus:border-[#8B6CE8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1D192B] mb-1">표시 이름 (선택)</label>
              <input
                type="text"
                placeholder="예: 태휘 아빠"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4F2] px-3.5 py-2.5 text-sm focus:border-[#8B6CE8] focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setStatusMsg(null);
                  setIsError(false);
                }}
                className="flex-1 rounded-xl bg-[#F4F1FC] hover:bg-[#EAE4FA] text-[#6B4CD6] py-3 text-xs font-bold transition-colors"
              >
                이메일 변경
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] disabled:opacity-50 text-white py-3 text-sm font-bold shadow-sm transition-colors"
              >
                <span>{isBusy ? '확인 중...' : '인증 완료 및 로그인'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Local-First Entry Button */}
        <div className="pt-2 border-t border-[#E8E4F2]">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4F1FC] hover:bg-[#EAE4FA] border border-[#E8E4F2] text-[#6B4CD6] py-2.5 px-4 text-xs font-bold transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>로그인 없이 로컬 보관 모드로 시작하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
