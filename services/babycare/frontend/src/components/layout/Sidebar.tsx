import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Clock,
  Calendar,
  BookOpen,
  Bot,
  Users,
} from 'lucide-react';
import { useChild } from '../../context/ChildContext';

const NAV_ITEMS = [
  { path: '/', label: '홈 대시보드', icon: LayoutDashboard },
  { path: '/growth', label: '성장 관리', icon: TrendingUp },
  { path: '/care', label: '수유 · 수면 기록', icon: Clock },
  { path: '/calendar', label: '접종 · 검진 일정', icon: Calendar },
  { path: '/knowledge', label: '월령별 육아 정보', icon: BookOpen },
  { path: '/ai', label: '향단이 Baby AI', icon: Bot, badge: 'AI' },
  { path: '/family', label: '아이 프로필 · 가족', icon: Users },
];

export const Sidebar: React.FC = () => {
  const { activeChild } = useChild();

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-4 justify-between">
      <div className="space-y-6">
        {/* Child Badge Card */}
        {activeChild && (
          <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-50/50 to-blue-50 p-4 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-extrabold text-lg shadow-sm">
                {activeChild.sex === 'male' ? '👦' : '👧'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 truncate">{activeChild.name}</h4>
                <p className="text-xs text-blue-700 font-semibold mt-0.5">
                  생후 {activeChild.days_since_birth ?? 0}일차 ({activeChild.months_since_birth ?? 0}개월)
                </p>
                {activeChild.is_premature && (
                  <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                    교정 {activeChild.corrected_age_months ?? 0}개월
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Branding Info */}
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200/60">
        <div className="font-bold text-slate-700 flex items-center gap-1.5">
          <span className="hd2-skew-mark" style={{ width: 10, height: 13 }} />
          HD²LAB Platform
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          근거 기반 영유아 성장·케어 솔루션
        </p>
      </div>
    </aside>
  );
};
