import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChild } from '../context/ChildContext';
import { api } from '../services/api';
import { GrowthSummary, FeedingDailySummary, SleepDailySummary, HealthCalendarSummary, ContentArticle } from '../types';
import {
  TrendingUp,
  Clock,
  Calendar,
  Sparkles,
  PlusCircle,
  Moon,
  Milk,
  Baby,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const DashboardPage: React.FC = () => {
  const { activeChild, refreshChildren } = useChild();
  const navigate = useNavigate();

  const [growthSummary, setGrowthSummary] = useState<GrowthSummary | null>(null);
  const [feedingSummary, setFeedingSummary] = useState<FeedingDailySummary | null>(null);
  const [sleepSummary, setSleepSummary] = useState<SleepDailySummary | null>(null);
  const [calendarSummary, setCalendarSummary] = useState<HealthCalendarSummary | null>(null);
  const [featuredArticle, setFeaturedArticle] = useState<ContentArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Action Modal states
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [feedType, setFeedType] = useState<'formula' | 'breastfeeding' | 'expressed_milk'>('formula');
  const [feedAmount, setFeedAmount] = useState('160');
  const [feedDuration, setFeedDuration] = useState('15');

  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [sleepDurationMin, setSleepDurationMin] = useState('90');
  const [isNap, setIsNap] = useState(true);

  useEffect(() => {
    if (activeChild) {
      loadDashboardData();
    }
  }, [activeChild?.id]);

  const loadDashboardData = async () => {
    if (!activeChild) return;
    setIsLoading(true);
    try {
      const [growth, feeding, sleep, calendar, articles] = await Promise.all([
        api.getGrowthSummary(activeChild.id).catch(() => null),
        api.getFeedingSummary(activeChild.id).catch(() => null),
        api.getSleepSummary(activeChild.id).catch(() => null),
        api.getCalendarSummary(activeChild.id).catch(() => null),
        api.getArticles(undefined, activeChild.months_since_birth ? Math.floor(activeChild.months_since_birth) : 0).catch(() => []),
      ]);

      setGrowthSummary(growth);
      setFeedingSummary(feeding);
      setSleepSummary(sleep);
      setCalendarSummary(calendar);
      if (articles && articles.length > 0) {
        setFeaturedArticle(articles[0]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild) return;
    try {
      await api.createFeedingRecord(activeChild.id, {
        feeding_type: feedType,
        start_time: new Date().toISOString(),
        amount_ml: feedType !== 'breastfeeding' ? Number(feedAmount) : undefined,
        left_duration_min: feedType === 'breastfeeding' ? Math.floor(Number(feedDuration) / 2) : undefined,
        right_duration_min: feedType === 'breastfeeding' ? Math.ceil(Number(feedDuration) / 2) : undefined,
        notes: '홈 화면 빠른 기록'
      });
      setIsFeedModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || '수유 기록 실패');
    }
  };

  const handleQuickSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild) return;
    try {
      const now = new Date();
      const start = new Date(now.getTime() - Number(sleepDurationMin) * 60000);
      await api.createSleepRecord(activeChild.id, {
        start_time: start.toISOString(),
        end_time: now.toISOString(),
        is_nap: isNap,
        is_ongoing: false,
        notes: '홈 화면 빠른 기록'
      });
      setIsSleepModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || '수면 기록 실패');
    }
  };

  if (!activeChild) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Baby className="w-16 h-16 text-blue-400 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800">등록된 아이 프로필이 없습니다</h2>
        <p className="text-sm text-slate-500 mt-1">상단 메뉴에서 아이를 등록하고 맞춤 관리를 시작해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Baby Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 md:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <span>{activeChild.sex === 'male' ? '왕자님 👦' : '공주님 👧'}</span>
              <span>•</span>
              <span>D+{activeChild.days_since_birth ?? 0}일차</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {activeChild.name}의 육아 대시보드
            </h1>
            <p className="text-sm text-blue-100 flex items-center gap-2">
              <span>생년월일: {activeChild.birth_date}</span>
              <span>(생후 {activeChild.months_since_birth ?? 0}개월)</span>
              {activeChild.is_premature && (
                <span className="bg-amber-400/90 text-amber-950 px-2 py-0.5 rounded-full text-xs font-bold">
                  이른둥이 교정 {activeChild.corrected_age_months ?? 0}개월
                </span>
              )}
            </p>
          </div>

          {/* Quick Care Log Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setIsFeedModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50 transition-all active:scale-95"
            >
              <Milk className="w-4 h-4 text-blue-600" />
              수유 기록
            </button>
            <button
              onClick={() => setIsSleepModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-sm font-bold text-indigo-900 shadow-sm hover:bg-white transition-all active:scale-95"
            >
              <Moon className="w-4 h-4 text-indigo-600" />
              수면 기록
            </button>
            <button
              onClick={() => navigate('/growth')}
              className="flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-md hover:bg-white/30 transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              성장 측정
            </button>
          </div>
        </div>
      </div>

      {/* 2. Today's Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Feeding Card */}
        <div
          onClick={() => navigate('/care')}
          className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:border-blue-200 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Milk className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">오늘의 수유</h3>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {feedingSummary?.total_amount_ml ?? 0}
              </span>
              <span className="text-sm font-semibold text-slate-500">mL</span>
              {feedingSummary?.total_breastfeeding_min ? (
                <span className="text-xs text-blue-600 font-bold ml-1">
                  (+모유 {feedingSummary.total_breastfeeding_min}분)
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              총 {feedingSummary?.total_count ?? 0}회 (분유 {feedingSummary?.formula_count ?? 0}회, 모유 {feedingSummary?.breastfeeding_count ?? 0}회)
            </p>
          </div>
        </div>

        {/* Sleep Card */}
        <div
          onClick={() => navigate('/care')}
          className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:border-indigo-200 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Moon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">오늘의 수면</h3>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {sleepSummary ? Math.floor(sleepSummary.total_sleep_min / 60) : 0}
              </span>
              <span className="text-sm font-semibold text-slate-500">시간</span>
              <span className="text-2xl font-black text-slate-900 ml-1">
                {sleepSummary ? sleepSummary.total_sleep_min % 60 : 0}
              </span>
              <span className="text-sm font-semibold text-slate-500">분</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              낮잠 {sleepSummary?.nap_count ?? 0}회 ({sleepSummary?.nap_sleep_min ?? 0}분) • 밤잠 {sleepSummary?.night_sleep_min ?? 0}분
            </p>
          </div>
        </div>

        {/* Growth Card */}
        <div
          onClick={() => navigate('/growth')}
          className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:border-emerald-200 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">최근 신체 성장</h3>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-4">
            {growthSummary?.latest_record ? (
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-black text-slate-900">
                    {growthSummary.latest_record.weight_kg ?? '-'}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">kg</span>
                  {growthSummary.latest_record.weight_percentile && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      상위 {100 - growthSummary.latest_record.weight_percentile}% ({growthSummary.latest_record.weight_percentile}백분위)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  신장 {growthSummary.latest_record.height_cm ?? '-'}cm • 두위 {growthSummary.latest_record.head_circumference_cm ?? '-'}cm ({growthSummary.latest_record.measurement_date})
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-2">아직 등록된 성장 기록이 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Mid Section: Health Schedule & HyangDani AI Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Calendar Upcoming */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">예정된 접종 · 영유아 검진</h3>
            </div>
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              전체 보기 →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {calendarSummary?.upcoming_events && calendarSummary.upcoming_events.length > 0 ? (
              calendarSummary.upcoming_events.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-100"
                >
                  <div>
                    <span className="text-xs font-bold text-blue-600 block">
                      {ev.event_type === 'vaccine' ? '국가필수접종' : '영유아건강검진'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">{ev.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">예정일: {ev.scheduled_date}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 text-blue-800 text-xs px-2.5 py-1 font-bold">
                    예정
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">예정된 일정이 모두 완료되었습니다.</p>
            )}

            {calendarSummary?.overdue_events && calendarSummary.overdue_events.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  기한이 경과된 접종/검진 일정이 {calendarSummary.overdue_events.length}건 있습니다. 병원 방문 일정을 확인해 주세요.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* HyangDani AI Assistant Entry Card */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 p-6 shadow-sm border border-indigo-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>HyangDani Baby AI 육아 도우미</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-2">
              우리 아기 맞춤 육아 궁금증을 질문해 보세요
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              질병관리청 및 공인 소아과 표준지침에 근거하여 아기의 월령({activeChild.months_since_birth ?? 0}개월)과 수유·수면 흐름에 맞춘 1:1 조언을 제공합니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/ai')}
                className="rounded-xl bg-white/90 border border-indigo-200/60 px-3 py-1.5 text-xs text-slate-700 font-medium hover:bg-white"
              >
                "생후 {Math.floor(activeChild.months_since_birth ?? 0)}개월 적정 수유량은?"
              </button>
              <button
                onClick={() => navigate('/ai')}
                className="rounded-xl bg-white/90 border border-indigo-200/60 px-3 py-1.5 text-xs text-slate-700 font-medium hover:bg-white"
              >
                "안전한 수면 자세와 배앓이 예방법"
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-100/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              의료 안전 가이드라인 적용
            </span>
            <button
              onClick={() => navigate('/ai')}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              향단이와 대화하기
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Featured Parenting Article */}
      {featuredArticle && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              오늘의 맞춤 육아 정보 ({featuredArticle.category})
            </span>
            <button
              onClick={() => navigate('/knowledge')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              육아 정보 라이브러리 →
            </button>
          </div>
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-slate-900">{featuredArticle.title}</h4>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{featuredArticle.summary}</p>
              <p className="text-[11px] text-slate-400 mt-2">
                출처: {featuredArticle.source?.organization || '질병관리청'} • {featuredArticle.source?.license || '공공누리 제1유형'}
              </p>
            </div>
            <button
              onClick={() => navigate('/knowledge')}
              className="flex-shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors"
            >
              상세 읽기
            </button>
          </div>
        </div>
      )}

      {/* Quick Feeding Modal */}
      <Modal isOpen={isFeedModalOpen} onClose={() => setIsFeedModalOpen(false)} title="빠른 수유 기록">
        <form onSubmit={handleQuickFeed} className="space-y-4">
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
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">총 수유 시간 (분)</label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={feedDuration}
                onChange={(e) => setFeedDuration(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

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
              수유 기록 저장
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Sleep Modal */}
      <Modal isOpen={isSleepModalOpen} onClose={() => setIsSleepModalOpen(false)} title="빠른 수면 기록">
        <form onSubmit={handleQuickSleep} className="space-y-4">
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
            <label className="block text-xs font-bold text-slate-700 mb-1">수면 시간 (분)</label>
            <input
              type="number"
              min="5"
              max="900"
              step="5"
              required
              value={sleepDurationMin}
              onChange={(e) => setSleepDurationMin(e.target.value)}
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
              수면 기록 저장
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
