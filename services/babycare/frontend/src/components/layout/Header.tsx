import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChild } from '../../context/ChildContext';
import { ChevronDown, Plus, Baby, User as UserIcon, LogOut, Lock } from 'lucide-react';
import { Modal } from '../common/Modal';

export const Header: React.FC<{ onOpenAddChild?: () => void }> = ({ onOpenAddChild }) => {
  const { user, logout } = useAuth();
  const { childrenList, activeChild, setActiveChildId } = useChild();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E8E4F2] bg-[#FAFAFD]/95 px-4 md:px-8 backdrop-blur-md">
      {/* Brand & Mark */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="hd2-skew-mark" />
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

        {/* Local-First Status Pill (or Account Menu if authenticated) */}
        {!user ? (
          <div
            title="모든 데이터는 브라우저 로컬 스토리지에 안전하게 보관됩니다"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#F4F1FC] px-3 py-1.5 text-xs font-semibold text-[#6B4CD6] border border-[#E8E4F2]"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>로컬 보관 모드</span>
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
  );
};
