import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChild } from '../../context/ChildContext';
import { api } from '../../services/api';
import { ChevronDown, Plus, Baby, User as UserIcon, LogOut, Lock, Mail, Sparkles, X } from 'lucide-react';
import { Modal } from '../common/Modal';

export const Header: React.FC<{ onOpenAddChild?: () => void }> = ({ onOpenAddChild }) => {
  const {
    user,
    isOtpModalOpen,
    welcomeMessage,
    clearWelcomeMessage,
    openOtpLogin,
    closeOtpLogin,
    completeOtpLogin,
    loginWithGoogle,
    logout,
  } = useAuth();
  const { childrenList, activeChild, setActiveChildId } = useChild();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Crew Login (Email OTP + Google OAuth) Modal state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpName, setOtpName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail.trim()) return;
    setOtpBusy(true);
    setOtpMsg(null);
    try {
      const res = await api.requestEmailOtp(otpEmail.trim());
      setOtpStep('code');
      setOtpMsg(res.message);
    } catch (err: any) {
      setOtpMsg(err.message || '인증 코드 발송 실패');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail.trim() || otpCode.trim().length !== 6) return;
    setOtpBusy(true);
    setOtpMsg(null);
    try {
      const res = await api.verifyEmailOtp(
        otpEmail.trim(),
        otpCode.trim(),
        otpName.trim() || undefined,
        rememberMe
      );
      completeOtpLogin(res.access_token, res.user, rememberMe);
      setOtpStep('email');
      setOtpCode('');
      setOtpMsg(null);
    } catch (err: any) {
      setOtpMsg(err.message || '인증 코드 확인 실패');
    } finally {
      setOtpBusy(false);
    }
  };

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--line)] bg-[var(--header-bg)] px-4 md:px-8 backdrop-blur-md transition-colors">
      {/* Brand & Mark (Official HD2Lab .hd2-mark) */}
      <div className="flex items-center gap-3 min-w-0">
        <a
          href="/babycare/"
          className="flex items-center gap-3.5 text-[var(--text)] hover:text-[var(--accent-text)] transition-colors min-w-0"
          aria-label="HD2Lab BabyCare 홈"
        >
          <span className="hd2-mark ml-0.5" aria-hidden="true" />
          <span className="text-[22px] md:text-[24px] font-bold tracking-[-0.8px] text-[var(--text)] leading-none">
            HD2Lab
          </span>
          <small className="hidden sm:inline-block border-l border-[var(--border-strong)] pl-3 text-xs font-medium text-[var(--muted)] leading-none">
            BabyCare
          </small>
        </a>
        <a
          href="/service/"
          className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-text)] border border-[var(--line)] hover:bg-[var(--accent)] hover:text-white transition-colors"
        >
          Service Hub ↗
        </a>
      </div>

      {/* Child Switcher & User Account */}
      <div className="flex items-center gap-2.5">
        {/* Child Switcher */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-xl bg-[var(--panel-soft)] hover:bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] transition-colors border border-[var(--line)]"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white font-bold text-xs">
              {activeChild ? activeChild.name.charAt(0) : <Baby className="w-3.5 h-3.5" />}
            </div>
            <span className="max-w-[100px] truncate">{activeChild?.name || '아이 선택'}</span>
            <ChevronDown className="w-4 h-4 text-[var(--muted)]" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[var(--panel)] p-2 shadow-xl border border-[var(--line)] z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                아이 선택 (다자녀 관리)
              </div>
              <div className="space-y-1">
                {childrenList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveChildId(c.id);
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      activeChild?.id === c.id
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold'
                        : 'text-[var(--text)] hover:bg-[var(--panel-soft)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base">{c.sex === 'male' ? '👦' : '👧'}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    {c.days_since_birth !== undefined && (
                      <span className="text-xs text-[var(--muted)]">D+{c.days_since_birth}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--line)]">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenAddChild?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-soft)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  새 아이 등록
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Local-First Status + Crew Login (or Account Menu if authenticated) */}
        {!user ? (
          <div className="flex items-center gap-2">
            <div
              title="모든 데이터는 브라우저 로컬 스토리지에 안전하게 보관됩니다"
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] border border-[var(--line)]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>로컬 보관</span>
            </div>
            <button
              type="button"
              onClick={openOtpLogin}
              aria-label="가족 공유 로그인 (Crew)"
              title="가족 공유 로그인 (Crew)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-soft)] text-[var(--accent-text)] hover:bg-[var(--accent-soft)] border border-[var(--line)] transition-colors"
            >
              <UserIcon className="w-4 h-4" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[var(--panel)] p-2 shadow-xl border border-[var(--line)] z-50">
                <div className="px-3 py-2 border-b border-[var(--line)]">
                  <p className="text-xs font-semibold text-[var(--muted)]">로그인 계정</p>
                  <p className="text-sm font-bold text-[var(--text)] truncate">{user.name || '사용자'}</p>
                  <p className="text-xs text-[var(--muted)] truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

    {welcomeMessage && (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-20 right-4 md:right-8 z-50 flex items-center gap-3 rounded-2xl bg-[#1D192B] text-white px-4 py-3 shadow-xl border border-[#8B6CE8]/40 animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#8B6CE8] text-white shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-sm font-bold tracking-tight">{welcomeMessage}</span>
        <button
          type="button"
          onClick={clearWelcomeMessage}
          aria-label="환영 메시지 닫기"
          className="ml-1 rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )}

    <Modal isOpen={isOtpModalOpen} onClose={closeOtpLogin} title="가족 공유 로그인 (Crew)">
      <div className="space-y-4">
        {/* Remember Me checkbox (Crew only; Admiral/Overlord never persists) */}
        <label className="flex items-start gap-2.5 rounded-xl bg-[#F4F1FC] border border-[#E8E4F2] p-3 cursor-pointer select-none">
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

        {otpStep === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <p className="text-xs text-[#68627A] leading-relaxed">
              HD²LAB 메일 발송 서버를 통해 6자리 일회용 인증 번호를 보내드립니다. 별도 비밀번호 없이 가족 공유 기능을 사용할 수 있습니다.
            </p>
            <div>
              <label className="block text-xs font-bold text-[#1D192B] mb-1">이메일 주소</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4F2] px-3.5 py-2.5 text-sm focus:border-[#8B6CE8] focus:outline-none"
              />
            </div>
            {otpMsg && <p className="text-xs font-semibold text-rose-600">{otpMsg}</p>}
            <button
              type="submit"
              disabled={otpBusy}
              className="w-full rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] disabled:opacity-50 text-white py-2.5 text-sm font-bold transition-colors"
            >
              {otpBusy ? '인증 코드 발송 중...' : '6자리 인증 코드 받기'}
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#E8E4F2]" />
              <span className="mx-3 text-[11px] font-semibold text-[#68627A]">또는</span>
              <div className="flex-grow border-t border-[#E8E4F2]" />
            </div>

            <button
              type="button"
              onClick={() => loginWithGoogle(rememberMe)}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-[#F4F1FC] border border-[#D4CCE8] text-[#1D192B] py-2.5 px-4 text-sm font-bold shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.29V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1z" />
                <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95z" />
              </svg>
              <span>Google 계정으로 로그인 (Crew)</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {otpMsg && <p className="text-xs font-semibold text-[#6B4CD6]">{otpMsg}</p>}
            <div>
              <label className="block text-xs font-bold text-[#1D192B] mb-1">6자리 인증 코드</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4F2] px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] focus:border-[#8B6CE8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1D192B] mb-1">표시 이름 (선택)</label>
              <input
                type="text"
                placeholder="예: 태휘 아빠"
                value={otpName}
                onChange={(e) => setOtpName(e.target.value)}
                className="w-full rounded-xl border border-[#E8E4F2] px-3.5 py-2.5 text-sm focus:border-[#8B6CE8] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOtpStep('email');
                  setOtpMsg(null);
                }}
                className="flex-1 rounded-xl bg-[#F4F1FC] text-[#6B4CD6] py-2.5 text-xs font-bold"
              >
                이메일 변경
              </button>
              <button
                type="submit"
                disabled={otpBusy}
                className="flex-[2] rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] disabled:opacity-50 text-white py-2.5 text-sm font-bold"
              >
                {otpBusy ? '확인 중...' : '인증 완료 및 로그인'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
    </>
  );
};
