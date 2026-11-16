import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChild } from '../../context/ChildContext';
import { api } from '../../services/api';
import { ChevronDown, Plus, Baby, User as UserIcon, LogOut, Lock, Mail } from 'lucide-react';
import { Modal } from '../common/Modal';

export const Header: React.FC<{ onOpenAddChild?: () => void }> = ({ onOpenAddChild }) => {
  const { user, isOtpModalOpen, openOtpLogin, closeOtpLogin, completeOtpLogin, logout } = useAuth();
  const { childrenList, activeChild, setActiveChildId } = useChild();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Email OTP Modal state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpName, setOtpName] = useState('');
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
      const res = await api.verifyEmailOtp(otpEmail.trim(), otpCode.trim(), otpName.trim() || undefined);
      completeOtpLogin(res.access_token, res.user);
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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E8E4F2] bg-[#FAFAFD]/95 px-4 md:px-8 backdrop-blur-md">
      {/* Brand & Mark */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            className="w-8 h-8 shrink-0"
            aria-hidden="true"
          >
            <rect width="64" height="64" rx="12" fill="#FAFAFD" stroke="#E8E4F2" strokeWidth="2" />
            <path d="M15 20L35 10V43L15 53ZM29 24L49 14V47L29 57Z" fill="none" stroke="#8B6CE8" strokeWidth="4" />
          </svg>
          <span className="text-xl font-extrabold tracking-tight text-[#1D192B]">
            HD²LAB <span className="text-[#8B6CE8] font-bold">BabyCare</span>
          </span>
        </div>
        <a
          href="/service/"
          className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#F1ECFE] px-2.5 py-0.5 text-xs font-semibold text-[#6B4CD6] border border-[#E8E4F2] hover:bg-[#8B6CE8] hover:text-white transition-colors"
        >
          Service Hub ↗
        </a>
      </div>

      {/* Child Switcher & User Account */}
      <div className="flex items-center gap-3">
        {/* Child Switcher */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-xl bg-[#F4F1FC] hover:bg-[#EAE4FA] px-3 py-1.5 text-sm font-semibold text-[#1D192B] transition-colors border border-[#E8E4F2]"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8B6CE8] text-white font-bold text-xs">
              {activeChild ? activeChild.name.charAt(0) : <Baby className="w-3.5 h-3.5" />}
            </div>
            <span className="max-w-[100px] truncate">{activeChild?.name || '아이 선택'}</span>
            <ChevronDown className="w-4 h-4 text-[#68627A]" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
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
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base">{c.sex === 'male' ? '👦' : '👧'}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    {c.days_since_birth !== undefined && (
                      <span className="text-xs text-slate-400">D+{c.days_since_birth}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenAddChild?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  새 아이 등록
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Local-First Status + Google Crew Login (or Account Menu if authenticated) */}
        {!user ? (
          <div className="flex items-center gap-2">
            <div
              title="모든 데이터는 브라우저 로컬 스토리지에 안전하게 보관됩니다"
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-[#F4F1FC] px-3 py-1.5 text-xs font-semibold text-[#6B4CD6] border border-[#E8E4F2]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>로컬 보관</span>
            </div>
            <button
              type="button"
              onClick={openOtpLogin}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] text-white px-3 py-1.5 text-xs font-bold shadow-sm transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>이메일 OTP 로그인</span>
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F1FC] text-[#6B4CD6] hover:bg-[#EAE4FA] transition-colors"
            >
              <UserIcon className="w-4 h-4" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white p-2 shadow-xl border border-[#E8E4F2] z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">로그인 계정</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{user.name || '사용자'}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
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

    <Modal isOpen={isOtpModalOpen} onClose={closeOtpLogin} title="이메일 6자리 OTP 로그인">
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
    </Modal>
    </>
  );
};
