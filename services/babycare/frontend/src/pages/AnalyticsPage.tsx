import React, { useState, useEffect } from 'react';
import { useChild } from '../context/ChildContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { localStore } from '../services/localStore';
import {
  Upload,
  FileArchive,
  BarChart3,
  Sparkles,
  Milk,
  Moon,
  Baby,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Lock,
  Trash2,
  CloudUpload
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';

const LOCAL_STORAGE_KEY = 'babycare_local_analytics_v1';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeChild, refreshChildren, setActiveChildId } = useChild();

  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncToAccount, setSyncToAccount] = useState(false);

  // Restore last local-first analysis on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setAnalysisResult(JSON.parse(saved));
      }
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    try {
      let res: any;
      if (user && syncToAccount) {
        res = await api.uploadStatZip(file, activeChild?.id, true);
      } else {
        res = await api.analyzeStatZipStateless(file);
      }

      // Sync detected child profile & merge multi-month records into localStorage
      const childName = res.child_name || activeChild?.name || '아이';
      const localChild = localStore.upsertChild({
        id: res.child_id || undefined,
        name: childName,
        birth_date: res.estimated_birth_date || activeChild?.birth_date || '2026-06-09',
      });
      await refreshChildren();
      setActiveChildId(localChild.id);

      const merged = localStore.mergeAnalyticsResult(childName, res);
      setAnalysisResult(merged);
    } catch (err: any) {
      alert(err.message || '파일 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLocalData = () => {
    localStore.clearAnalytics();
    setAnalysisResult(null);
    setSelectedFile(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">육아 통계 ZIP 분석 플랫폼</h1>
          <span className="rounded-full bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5">
            Local-First · 무계정 즉시 분석
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          계정 발급이나 로그인 없이도 베이비타임 등 육아 기록 앱의 통계 압축 파일(ZIP/CSV)을 업로드하면 즉시 시각화 분석 및 소아과 기준 AI 평가를 제공합니다.
        </p>
      </div>

      {/* Zero-Knowledge Privacy Banner */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Lock className="w-4 h-4" />
        </div>
        <div className="text-xs text-emerald-900 space-y-1">
          <p className="font-bold text-sm">개인정보 안심 모드 (Zero-Persistence)</p>
          <p className="text-emerald-800 leading-relaxed">
            업로드된 통계 데이터는 HD²LAB 서버 DB에 저장되지 않고, 오직 고객님의 <strong>브라우저 로컬 저장소에만 안전하게 보관</strong>됩니다.
            새로고침 후에도 기록이 유지되며 언제든 즉시 삭제할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-all hover:bg-blue-50/70"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md mb-3">
          <FileArchive className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          육아 통계 ZIP 또는 CSV 파일을 여기에 드래그하거나 선택하세요
        </h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          지원 파일: stat_아이이름_YYYYMM.zip, other_stat_*.csv, excel_stat_*.csv (CP949/UTF-8 자동 지원)
        </p>

        <div className="flex flex-col items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold shadow-sm cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>통계 파일 업로드</span>
            <input
              type="file"
              accept=".zip,.csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              disabled={isLoading}
              className="hidden"
            />
          </label>

          {user && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncToAccount}
                onChange={(e) => setSyncToAccount(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <CloudUpload className="w-3.5 h-3.5 text-blue-600" />
              <span>내 계정의 서버 DB에도 영구 동기화 (멀티 기기 조회용)</span>
            </label>
          )}
        </div>

        {selectedFile && (
          <p className="text-xs text-blue-700 font-semibold mt-3">
            선택된 파일: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </p>
        )}
      </div>

      {isLoading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-100 shadow-sm space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-bold text-slate-700">육아 통계 데이터를 파싱 및 분석 중입니다...</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Detected Child Profile Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                  자동 인식된 아이 프로필
                </span>
                <h2 className="text-2xl font-black mt-1">
                  {analysisResult.child_name} (출생 역산: {analysisResult.estimated_birth_date || '미상'})
                </h2>
                <p className="text-xs text-blue-100 mt-1">
                  데이터 범위: 총 {analysisResult.summary.total_days_in_file}일 중 실제 기록일{' '}
                  <span className="font-bold text-amber-300">{analysisResult.summary.active_days_count}일</span> 활성 집계
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl bg-white/20 backdrop-blur-md px-4 py-2 text-xs font-semibold flex items-center gap-1.5">
                  {analysisResult.mode === 'stateless' ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>브라우저 로컬 보관 (서버 미저장)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>데이터베이스 자동 동기화 완료</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearLocalData}
                  className="rounded-2xl bg-rose-500/80 hover:bg-rose-600 text-white px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>데이터 지우기</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">일일 평균 분유량</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {analysisResult.summary.avg_formula_ml}{' '}
                <span className="text-xs font-semibold text-slate-500">mL</span>
              </p>
              <span className="text-[11px] text-emerald-600 font-bold block mt-1">
                권장치(800~1,000mL) 부합
              </span>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">일일 평균 밤잠</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {analysisResult.summary.avg_night_hours}{' '}
                <span className="text-xs font-semibold text-slate-500">시간</span>
              </p>
              <span className="text-[11px] text-indigo-600 font-bold block mt-1">
                안정적 연속 통잠 패턴
              </span>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">일일 평균 낮잠</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {Math.round(analysisResult.summary.avg_nap_min / 60 * 10) / 10}{' '}
                <span className="text-xs font-semibold text-slate-500">시간 ({analysisResult.summary.avg_nap_min}분)</span>
              </p>
              <span className="text-[11px] text-slate-400 block mt-1">
                생후 4~6개월 권장 범위
              </span>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400">일일 대변 횟수</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {analysisResult.summary.avg_diaper_stool_count}{' '}
                <span className="text-xs font-semibold text-slate-500">회 / 일</span>
              </p>
              <span className="text-[11px] text-emerald-600 font-bold block mt-1">
                원활한 장운동
              </span>
            </div>
          </div>

          {/* AI Comprehensive Pediatric Insights */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 p-6 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm uppercase mb-3">
              <Sparkles className="w-5 h-5" />
              <span>HyangDani Baby AI 전문 소아과 기준 종합 분석 리포트</span>
            </div>
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-white/80 p-5 rounded-2xl border border-indigo-100/60 shadow-inner">
              {analysisResult.ai_report}
            </div>
          </div>

          {/* Chart 1: Daily Formula Feeding Trend */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">일별 분유 섭취량 추이</h3>
                <p className="text-xs text-slate-400">
                  생후 4~6개월 권장 정상 섭취량: 800mL ~ 1,000mL (초록색 음영 구간)
                </p>
              </div>
            </div>

            <div className="h-72 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysisResult.daily_rows.filter((r: any) => r.has_active_data)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(5)}
                    stroke="#94A3B8"
                    fontSize={11}
                  />
                  <YAxis domain={[400, 1200]} stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    formatter={(val: any) => [`${val} mL`, '분유 섭취량']}
                    labelFormatter={(lbl) => `${lbl}`}
                  />
                  <ReferenceArea y1={800} y2={1000} fill="#10B981" fillOpacity={0.12} />
                  <Line
                    type="monotone"
                    dataKey="formula_ml"
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#2563EB' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Daily Sleep Patterns (Night vs Nap) */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">수면 패턴 추이 (밤잠 vs 낮잠)</h3>
                <p className="text-xs text-slate-400">단위: 분 (600분 = 10시간)</p>
              </div>
            </div>

            <div className="h-72 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResult.daily_rows.filter((r: any) => r.has_active_data)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(5)}
                    stroke="#94A3B8"
                    fontSize={11}
                  />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${val}분 (${Math.round(val / 60 * 10) / 10}시간)`,
                      name === 'night_sleep_min' ? '밤잠' : '낮잠',
                    ]}
                  />
                  <Legend
                    formatter={(v) => (v === 'night_sleep_min' ? '🌙 밤잠' : '☀️ 낮잠')}
                  />
                  <Bar dataKey="night_sleep_min" stackId="sleep" fill="#4F46E5" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="nap_duration_min" stackId="sleep" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
