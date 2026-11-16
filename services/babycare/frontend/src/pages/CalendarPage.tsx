import React, { useState, useEffect } from 'react';
import { useChild } from '../context/ChildContext';
import { api } from '../services/api';
import { HealthEvent } from '../types';
import { Calendar, CheckCircle2, AlertCircle, Clock, Plus, Building2, ShieldCheck, FileCheck } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const CalendarPage: React.FC = () => {
  const { activeChild } = useChild();

  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'vaccine' | 'checkup'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'completed' | 'overdue'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Complete Event Modal
  const [selectedEvent, setSelectedEvent] = useState<HealthEvent | null>(null);
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0]);
  const [facilityName, setFacilityName] = useState('');
  const [notes, setNotes] = useState('');

  // Add Custom Event Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customType, setCustomType] = useState<'vaccine' | 'checkup' | 'hospital'>('hospital');
  const [customScheduledDate, setCustomScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [customFacility, setCustomFacility] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  useEffect(() => {
    if (activeChild) {
      loadCalendarEvents();
    }
  }, [activeChild?.id]);

  const loadCalendarEvents = async () => {
    if (!activeChild) return;
    setIsLoading(true);
    try {
      if (!activeChild.id.startsWith('local-')) {
        try {
          const data = await api.getCalendarEvents(activeChild.id);
          setEvents(data);
          return;
        } catch {
          // Fallback to live rules for unauthenticated / local-first users
        }
      }

      const live = await api.getLiveHealthRules(activeChild.birth_date);
      const localCompleted: Record<string, any> = JSON.parse(
        localStorage.getItem(`babycare_cal_done_${activeChild.id}`) || '{}'
      );
      const todayStr = new Date().toISOString().split('T')[0];

      const mapped: HealthEvent[] = [
        ...(live.vaccinations || []).map((v: any) => {
          const id = `live-${v.code}`;
          const done = localCompleted[id];
          const sched = v.scheduled_date || todayStr;
          const status = done ? 'completed' : sched < todayStr ? 'overdue' : 'scheduled';
          return {
            id,
            child_id: activeChild.id,
            rule_id: v.code,
            event_type: 'vaccine',
            title: v.name,
            scheduled_date: sched,
            completed_date: done?.completed_date,
            status,
            is_self_reported: true,
            facility_name: done?.facility_name,
            notes: done?.notes || v.description,
            created_at: new Date().toISOString(),
          };
        }),
        ...(live.checkups || []).map((c: any) => {
          const id = `live-${c.code}`;
          const done = localCompleted[id];
          const sched = c.scheduled_date || todayStr;
          const status = done ? 'completed' : sched < todayStr ? 'overdue' : 'scheduled';
          return {
            id,
            child_id: activeChild.id,
            rule_id: c.code,
            event_type: 'checkup',
            title: c.name,
            scheduled_date: sched,
            completed_date: done?.completed_date,
            status,
            is_self_reported: true,
            facility_name: done?.facility_name,
            notes: done?.notes || c.description,
            created_at: new Date().toISOString(),
          };
        }),
      ];
      mapped.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      setEvents(mapped);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild || !selectedEvent) return;
    try {
      if (selectedEvent.id.startsWith('live-')) {
        const key = `babycare_cal_done_${activeChild.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        existing[selectedEvent.id] = {
          completed_date: completedDate,
          facility_name: facilityName || undefined,
          notes: notes || selectedEvent.notes,
        };
        localStorage.setItem(key, JSON.stringify(existing));
        setSelectedEvent(null);
        loadCalendarEvents();
        return;
      }

      await api.updateCalendarEvent(activeChild.id, selectedEvent.id, {
        completed_date: completedDate,
        status: 'completed',
        facility_name: facilityName || undefined,
        notes: notes || selectedEvent.notes,
        is_self_reported: true,
      });
      setSelectedEvent(null);
      loadCalendarEvents();
    } catch (err: any) {
      alert(err.message || '접종/검진 완료 저장 실패');
    }
  };

  const handleCreateCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild) return;
    try {
      await api.createCalendarEvent(activeChild.id, {
        title: customTitle,
        event_type: customType,
        scheduled_date: customScheduledDate,
        facility_name: customFacility || undefined,
        notes: customNotes || undefined,
        status: 'scheduled',
      });
      setIsAddModalOpen(false);
      setCustomTitle('');
      loadCalendarEvents();
    } catch (err: any) {
      alert(err.message || '일정 등록 실패');
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType !== 'all' && ev.event_type !== filterType) return false;
    if (filterStatus !== 'all' && ev.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              예방접종 · 건강검진 캘린더
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-800 px-2.5 py-0.5 text-xs font-bold border border-blue-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              질병관리청 국가예방접종(NIP) 기준
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            아이의 생년월일({activeChild?.birth_date})에 맞춰 필수 접종 및 영유아 건강검진 주기를 자동 산출합니다.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          병원 일정 직접 추가
        </button>
      </div>

      {/* Official Notice Card */}
      <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">질병관리청(NIP) · 영유아 건강검진 기준표 안내</p>
          <p className="text-amber-800 leading-relaxed">
            본 일정은 질병관리청 국가예방접종(NIP) 및 국민건강보험공단 영유아 건강검진 공식 기준표(2026.11)를 바탕으로 아기 생년월일에 맞춰 자동 계산됩니다.
            접종 완료 여부는 외부 기관 자동 조회가 아닌 <strong>양육자 직접 체크(브라우저 로컬 저장)</strong>로 관리됩니다.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-2xl bg-slate-200/60 p-1.5">
          {[
            { id: 'all', label: '전체' },
            { id: 'vaccine', label: '💉 국가예방접종' },
            { id: 'checkup', label: '🩺 영유아 건강검진' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                filterType === tab.id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex rounded-2xl bg-slate-200/60 p-1.5 text-xs font-semibold">
          {[
            { id: 'all', label: '상태 전체' },
            { id: 'scheduled', label: '예정' },
            { id: 'completed', label: '완료' },
            { id: 'overdue', label: '기한 경과' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                filterStatus === tab.id ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            선택한 조건의 일정이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((ev) => {
              const isComp = ev.status === 'completed';
              const isOver = ev.status === 'overdue';

              return (
                <div
                  key={ev.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all ${
                    isComp
                      ? 'bg-emerald-50/40 border-emerald-100'
                      : isOver
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl flex-shrink-0 mt-0.5 ${
                        isComp
                          ? 'bg-emerald-100 text-emerald-700'
                          : isOver
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isComp ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isOver ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <Calendar className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            ev.event_type === 'vaccine'
                              ? 'bg-blue-100 text-blue-800'
                              : ev.event_type === 'checkup'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {ev.event_type === 'vaccine'
                            ? '국가필수접종'
                            : ev.event_type === 'checkup'
                            ? '영유아건강검진'
                            : '병원 일정'}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">{ev.title}</h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          권장 예정일: {ev.scheduled_date}
                        </span>
                        {ev.completed_date && (
                          <span className="flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            접종/검진일: {ev.completed_date}
                          </span>
                        )}
                        {ev.facility_name && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {ev.facility_name}
                          </span>
                        )}
                      </div>

                      {ev.notes && <p className="text-xs text-slate-400 mt-1">{ev.notes}</p>}

                      {isComp && ev.is_self_reported && (
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                          <FileCheck className="w-3 h-3" />
                          양육자 자가 완료 인증
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 sm:mt-0 flex items-center gap-2 self-end sm:self-center">
                    {!isComp ? (
                      <button
                        onClick={() => {
                          setSelectedEvent(ev);
                          setCompletedDate(new Date().toISOString().split('T')[0]);
                          setFacilityName('');
                          setNotes(ev.notes || '');
                        }}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
                      >
                        완료 기록
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                        완료됨 ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete Event Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={`${selectedEvent?.title} 접종/검진 완료 처리`}
      >
        <form onSubmit={handleCompleteEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">실제 완료 일자</label>
            <input
              type="date"
              required
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">방문 의료기관 / 보건소명</label>
            <input
              type="text"
              placeholder="예: 서울소아청소년과의원, 강남구보건소"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">특이사항 메모</label>
            <input
              type="text"
              placeholder="예: 접종 부위 미열 없음, 특이반응 없음"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
            >
              완료 저장
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Custom Hospital Event Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="병원 / 건강 검진 일정 추가">
        <form onSubmit={handleCreateCustomEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">일정 제목</label>
            <input
              type="text"
              required
              placeholder="예: 영유아 안과 정기검진, 이비인후과 재진"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">일정 구분</label>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="hospital">일반 병원 진료</option>
              <option value="vaccine">추가 접종 (선택)</option>
              <option value="checkup">발달 평가 / 정기 검진</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">예정일자</label>
            <input
              type="date"
              required
              value={customScheduledDate}
              onChange={(e) => setCustomScheduledDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">병원명 (선택)</label>
            <input
              type="text"
              placeholder="예: 서울아산병원 소아청소년과"
              value={customFacility}
              onChange={(e) => setCustomFacility(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              일정 등록 완료
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
