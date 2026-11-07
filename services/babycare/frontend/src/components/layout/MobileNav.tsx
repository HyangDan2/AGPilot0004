import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, BookOpen, Bot, Menu } from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { path: '/', label: '홈', icon: LayoutDashboard },
  { path: '/growth', label: '성장', icon: TrendingUp },
  { path: '/knowledge', label: '지식', icon: BookOpen },
  { path: '/ai', label: 'AI도우미', icon: Bot, isHighlight: true },
  { path: '/care', label: '수유·수면', icon: Menu },
];

export const MobileNav: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md lg:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                item.isHighlight ? 'bg-blue-50 text-blue-600' : ''
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
