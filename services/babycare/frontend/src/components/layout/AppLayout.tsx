import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Modal } from '../common/Modal';
import { useChild } from '../../context/ChildContext';

export const AppLayout: React.FC = () => {
  const { createChild } = useChild();
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date().toISOString().split('T')[0]);
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [isPremature, setIsPremature] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [gestationalWeeks, setGestationalWeeks] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await createChild({
        name: name.trim(),
        birth_date: birthDate,
        sex,
        is_premature: isPremature,
        due_date: isPremature && dueDate ? dueDate : undefined,
        gestational_weeks: isPremature && gestationalWeeks ? Number(gestationalWeeks) : undefined,
      });
      setName('');
      setIsPremature(false);
      setIsAddChildModalOpen(false);
    } catch (err: any) {
      alert(err.message || '아이 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onOpenAddChild={() => setIsAddChildModalOpen(true)} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <MobileNav />

      {/* Add Child Modal */}
      <Modal
        isOpen={isAddChildModalOpen}
        onClose={() => setIsAddChildModalOpen(false)}
        title="새 아이 프로필 등록"
      >
        <form onSubmit={handleAddChild} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              아이 이름 / 태명
            </label>
            <input
              type="text"
              required
              placeholder="예: 튼튼이, 지우"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              생년월일
            </label>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              성별 (성장도표 기준)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSex('male')}
                className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                  sex === 'male'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                👦 남아
              </button>
              <button
                type="button"
                onClick={() => setSex('female')}
                className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                  sex === 'female'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                👧 여아
              </button>
            </div>
          </div>

          {/* Premature birth toggle */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPremature}
                onChange={(e) => setIsPremature(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-700">
                미숙아 / 이른둥이 (교정연령 적용)
              </span>
            </label>

            {isPremature && (
              <div className="mt-3 space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    출산 예정일
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    출생 당시 임신 주수 (주)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="42"
                    placeholder="예: 34"
                    value={gestationalWeeks ?? ''}
                    onChange={(e) => setGestationalWeeks(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddChildModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              {isSubmitting ? '등록 중...' : '아이 등록 완료'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
