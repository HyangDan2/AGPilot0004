import React, { useState, useEffect } from 'react';
import { useChild } from '../context/ChildContext';
import { api } from '../services/api';
import { FeedingRecord, SleepRecord, FeedingDailySummary, SleepDailySummary } from '../types';
import { Milk, Moon, Play, Square, Plus, Trash2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const CareTrackerPage: React.FC = () => {
  const { activeChild } = useChild();

  const [activeTab, setActiveTab] = useState<'feeding' | 'sleep'>('feeding');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>([]);
  const [feedingSummary, setFeedingSummary] = useState<FeedingDailySummary | null>(null);

  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [sleepSummary, setSleepSummary] = useState<SleepDailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Feeding Modal
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [feedType, setFeedType] = useState<'breastfeeding' | 'formula' | 'expressed_milk'>('formula');
  const [feedStartTime, setFeedStartTime] = useState('');
  const [feedAmount, setFeedAmount] = useState('160');
  const [leftMin, setLeftMin] = useState('10');
  const [rightMin, setRightMin] = useState('10');
  const [feedNotes, setFeedNotes] = useState('');

  // Sleep Modal
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState('');
  const [sleepEndTime, setSleepEndTime] = useState('');
  const [isNap, setIsNap] = useState(true);
  const [sleepNotes, setSleepNotes] = useState('');

  useEffect(() => {
    if (activeChild) {
      loadCareData();
    }
  }, [activeChild?.id, selectedDate, activeTab]);

  const loadCareData = async () => {
    if (!activeChild) return;
    setIsLoading(true);
    try {
      if (activeTab === 'feeding') {
        const [recs, sum] = await Promise.all([
          api.getFeedingRecords(activeChild.id, selectedDate),
          api.getFeedingSummary(activeChild.id, selectedDate),
        ]);
        setFeedingRecords(recs);
        setFeedingSummary(sum);
      } else {
        const [recs, sum] = await Promise.all([
          api.getSleepRecords(activeChild.id, selectedDate),
          api.getSleepSummary(activeChild.id, selectedDate),
        ]);
        setSleepRecords(recs);
        setSleepSummary(sum);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOngoingSleep = async () => {
    if (!activeChild) return;
    try {
      await api.createSleepRecord(activeChild.id, {
        start_time: new Date().toISOString(),
        is_nap: isNap,
        is_ongoing: true,
        notes: '실시간 수면 측정 시작',
      });
      loadCareData();
    } catch (err: any) {
      alert(err.message || '수면 시작 기록 실패');
    }
  };

  const handleStopOngoingSleep = async (record: SleepRecord) => {
    if (!activeChild) return;
    try {
      await api.updateSleepRecord(activeChild.id, record.id, {
        end_time: new Date().toISOString(),
        is_ongoing: false,
      });
      loadCareData();
    } catch (err: any) {
      alert(err.message || '수면 종료 기록 실패');
    }
  };

  const handleCreateFeeding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild) return;
    try {
      const start = feedStartTime ? new Date(feedStartTime).toISOString() : new Date().toISOString();
      await api.createFeedingRecord(activeChild.id, {
        feeding_type: feedType,
        start_time: start,
        amount_ml: feedType !== 'breastfeeding' ? Number(feedAmount) : undefined,
        left_duration_min: feedType === 'breastfeeding' ? Number(leftMin) : undefined,
        right_duration_min: feedType === 'breastfeeding' ? Number(rightMin) : undefined,
        notes: feedNotes || undefined,
      });
      setIsFeedModalOpen(false);
      setFeedNotes('');
      loadCareData();
    } catch (err: any) {
      alert(err.message || '수유 기록 실패');
    }
  };

  const handleCreateSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild) return;
    try {
      if (!sleepStartTime || !sleepEndTime) {
        alert('수면 시작 및 종료 시각을 모두 입력해 주세요.');
        return;
      }
      await api.createSleepRecord(activeChild.id, {
        start_time: new Date(sleepStartTime).toISOString(),
        end_time: new Date(sleepEndTime).toISOString(),
        is_nap: isNap,
        is_ongoing: false,
        notes: sleepNotes || undefined,
      });
      setIsSleepModalOpen(false);
      setSleepNotes('');
      loadCareData();
    } catch (err: any) {
      alert(err.message || '수면 기록 실패');
    }
  };

  const handleDeleteFeeding = async (id: string) => {
    if (!activeChild || !confirm('수유 기록을 삭제하시겠습니까?')) return;
    await api.deleteFeedingRecord(activeChild.id, id);
    loadCareData();
  };

  const handleDeleteSleep = async (id: string) => {
    if (!activeChild || !confirm('수면 기록을 삭제하시겠습니까?')) return;
    await api.deleteSleepRecord(activeChild.id, id);
    loadCareData();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">수유 · 수면 일상 기록</h1>
          <p className="text-sm text-slate-500 mt-1">
            아기의 하루 수유 패턴과 밤잠·낮잠 시간을 간편하게 기록하고 분석합니다.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-bold text-slate-700 bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('feeding')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'feeding'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Milk className="w-4 h-4" />
          수유 기록 ({feedingSummary?.total_count ?? 0}회)
        </button>
        <button
          onClick={() => setActiveTab('sleep')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            activeTab === 'sleep'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Moon className="w-4 h-4" />
          수면 기록 ({sleepSummary ? Math.round(sleepSummary.total_sleep_min / 60 * 10) / 10 : 0}시간)
        </button>
      </div>

      {/* FEEDING VIEW */}
      {activeTab === 'feeding' && (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">총 분유/유축 수유량</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {feedingSummary?.total_amount_ml ?? 0} <span className="text-sm font-normal text-slate-500">mL</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">직접 모유 수유</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {feedingSummary?.total_breastfeeding_min ?? 0} <span className="text-sm font-normal text-slate-500">분</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">분유 수유 횟수</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {feedingSummary?.formula_count ?? 0} <span className="text-sm font-normal text-slate-500">회</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">모유 수유 횟수</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {feedingSummary?.breastfeeding_count ?? 0} <span className="text-sm font-normal text-slate-500">회</span>
              </p>
            </div>
          </div>

          {/* Action button & Timeline */}
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">선택한 일자의 수유 타임라인</h3>
            <button
              onClick={() => {
                setFeedStartTime(new Date().toISOString().slice(0, 16));
                setIsFeedModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              수유 기록 추가
            </button>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
            {feedingRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                해당 일자에 등록된 수유 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {feedingRecords.map((r) => {
                  const timeStr = new Date(r.start_time).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-lg">
                          {r.feeding_type === 'breastfeeding' ? '🤱' : '🍼'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {r.feeding_type === 'breastfeeding'
                                ? '직접 모유 수유'
                                : r.feeding_type === 'formula'
                                ? '분유 수유'
                                : '유축 모유'}
                            </span>
                            <span className="text-xs text-slate-400">{timeStr}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {r.feeding_type !== 'breastfeeding'
                              ? `${r.amount_ml} mL`
                              : `좌 ${r.left_duration_min ?? 0}분 + 우 ${r.right_duration_min ?? 0}분 (총 ${(r.left_duration_min ?? 0) + (r.right_duration_min ?? 0)}분)`}
                            {r.notes && <span className="ml-2 text-slate-400">({r.notes})</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFeeding(r.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLEEP VIEW */}
      {activeTab === 'sleep' && (
        <div className="space-y-6">
          {/* Active Ongoing Sleep Card */}
          {sleepSummary?.ongoing_sleep ? (
            <div className="rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                  <Moon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">
                    현재 아기가 자고 있어요
                  </span>
                  <h3 className="text-xl font-bold mt-0.5">
                    {sleepSummary.ongoing_sleep.is_nap ? '낮잠' : '밤잠'} 진행 중...
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    시작 시각: {new Date(sleepSummary.ongoing_sleep.start_time).toLocaleTimeString('ko-KR')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleStopOngoingSleep(sleepSummary.ongoing_sleep!)}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-900 shadow-sm hover:bg-indigo-50 transition-all active:scale-95"
              >
                <Square className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                수면 종료 (일어남)
              </button>
            </div>
          ) : (
            <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">실시간 수면 타이머</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  아기를 재울 때 버튼을 누르면 일어날 때까지 수면 시간을 실시간 기록합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsNap(true);
                    handleStartOngoingSleep();
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2.5 text-xs font-bold transition-all"
                >
                  <Play className="w-4 h-4 fill-indigo-600 text-indigo-600" />
                  낮잠 시작
                </button>
                <button
                  onClick={() => {
                    setIsNap(false);
                    handleStartOngoingSleep();
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold shadow-sm transition-all"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  밤잠 시작
                </button>
              </div>
            </div>
          )}

          {/* Sleep Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">총 수면 시간</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {sleepSummary ? Math.floor(sleepSummary.total_sleep_min / 60) : 0}{' '}
                <span className="text-sm font-normal text-slate-500">시간</span>{' '}
                {sleepSummary ? sleepSummary.total_sleep_min % 60 : 0}{' '}
                <span className="text-sm font-normal text-slate-500">분</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">밤잠 합계</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {sleepSummary ? Math.floor(sleepSummary.night_sleep_min / 60) : 0}{' '}
                <span className="text-sm font-normal text-slate-500">시간</span>{' '}
                {sleepSummary ? sleepSummary.night_sleep_min % 60 : 0}{' '}
                <span className="text-sm font-normal text-slate-500">분</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">낮잠 횟수 및 시간</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {sleepSummary?.nap_count ?? 0} <span className="text-sm font-normal text-slate-500">회</span> (
                {sleepSummary?.nap_sleep_min ?? 0}분)
              </p>
            </div>
          </div>

          {/* Action button & Timeline */}
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">선택한 일자의 수면 타임라인</h3>
            <button
              onClick={() => {
                const now = new Date();
                const past = new Date(now.getTime() - 90 * 60000);
                setSleepStartTime(past.toISOString().slice(0, 16));
                setSleepEndTime(now.toISOString().slice(0, 16));
                setIsSleepModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              과거 수면 수동 입력
            </button>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
            {sleepRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                해당 일자에 등록된 수면 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {sleepRecords.map((r) => {
                  const sTime = new Date(r.start_time).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const eTime = r.end_time
                    ? new Date(r.end_time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '진행 중';
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-bold text-lg">
                          {r.is_nap ? '☀️' : '🌙'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {r.is_nap ? '낮잠' : '밤잠'}
                            </span>
                            <span className="text-xs text-slate-400">
                              {sTime} ~ {eTime}
                            </span>
                            {r.duration_min !== null && r.duration_min !== undefined && (
                              <span className="rounded-full bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 font-bold">
                                {Math.floor(r.duration_min / 60)}시간 {r.duration_min % 60}분
                              </span>
                            )}
                          </div>
                          {r.notes && <p className="text-xs text-slate-400 mt-0.5">{r.notes}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSleep(r.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feeding Modal */}
      <Modal isOpen={isFeedModalOpen} onClose={() => setIsFeedModalOpen(false)} title="수유 기록 추가">
        <form onSubmit={handleCreateFeeding} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">수유 방식</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'formula', label: '🍼 분유' },
                { id: 'breastfeeding', label: '🤱 모유' },
                { id: 'expressed_milk', label: '🍶 유축모유' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFeedType(t.id as any)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    feedType === t.id
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">수유 시작 시각</label>
            <input
              type="datetime-local"
              required
              value={feedStartTime}
              onChange={(e) => setFeedStartTime(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {feedType !== 'breastfeeding' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">수유량 (mL)</label>
              <input
                type="number"
                min="10"
                max="500"
                step="10"
                required
                value={feedAmount}
                onChange={(e) => setFeedAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">왼쪽 시간 (분)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={leftMin}
                  onChange={(e) => setLeftMin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">오른쪽 시간 (분)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={rightMin}
                  onChange={(e) => setRightMin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">메모</label>
            <input
              type="text"
              placeholder="예: 트림 완료, 약간 게움"
              value={feedNotes}
              onChange={(e) => setFeedNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFeedModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              저장 완료
            </button>
          </div>
        </form>
      </Modal>

      {/* Sleep Modal */}
      <Modal isOpen={isSleepModalOpen} onClose={() => setIsSleepModalOpen(false)} title="과거 수면 수동 입력">
        <form onSubmit={handleCreateSleep} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">수면 유형</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsNap(true)}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  isNap
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ☀️ 낮잠
              </button>
              <button
                type="button"
                onClick={() => setIsNap(false)}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  !isNap
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🌙 밤잠
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">수면 시작 시각</label>
            <input
              type="datetime-local"
              required
              value={sleepStartTime}
              onChange={(e) => setSleepStartTime(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">수면 종료 시각</label>
            <input
              type="datetime-local"
              required
              value={sleepEndTime}
              onChange={(e) => setSleepEndTime(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">메모</label>
            <input
              type="text"
              placeholder="예: 눕히자마자 바로 잠듦"
              value={sleepNotes}
              onChange={(e) => setSleepNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSleepModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
            >
              저장 완료
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
