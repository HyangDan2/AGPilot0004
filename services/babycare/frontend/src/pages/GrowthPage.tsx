import React, { useState, useEffect } from 'react';
import { useChild } from '../context/ChildContext';
import { api } from '../services/api';
import { GrowthRecord, GrowthCurvePoint } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { TrendingUp, Plus, Trash2, Calendar, ShieldCheck, Scale, Ruler } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const GrowthPage: React.FC = () => {
  const { activeChild } = useChild();

  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [curvePoints, setCurvePoints] = useState<GrowthCurvePoint[]>([]);
  const [activeMetric, setActiveMetric] = useState<'weight_kg' | 'height_cm' | 'head_circumference_cm'>('weight_kg');
  const [isLoading, setIsLoading] = useState(false);

  // Add Record Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeChild) {
      loadGrowthData();
    }
  }, [activeChild?.id, activeMetric]);

  const loadGrowthData = async () => {
    if (!activeChild) return;
    setIsLoading(true);
    try {
      const [recs, curves] = await Promise.all([
        api.getGrowthRecords(activeChild.id),
        api.getGrowthCurves(activeChild.id, activeMetric),
      ]);
      setRecords(recs);
      setCurvePoints(curves.points || []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChild) return;
    setIsSubmitting(true);
    try {
      await api.createGrowthRecord(activeChild.id, {
        measurement_date: measurementDate,
        weight_kg: weightKg ? parseFloat(weightKg) : undefined,
        height_cm: heightCm ? parseFloat(heightCm) : undefined,
        head_circumference_cm: headCircumferenceCm ? parseFloat(headCircumferenceCm) : undefined,
        notes: notes || undefined,
      });
      setIsAddModalOpen(false);
      setWeightKg('');
      setHeightCm('');
      setHeadCircumferenceCm('');
      setNotes('');
      loadGrowthData();
    } catch (err: any) {
      alert(err.message || '성장 기록 등록 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!activeChild || !confirm('성장 기록을 삭제하시겠습니까?')) return;
    try {
      await api.deleteGrowthRecord(activeChild.id, recordId);
      loadGrowthData();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  // Prepare chart data merged with actual measurements
  const chartData = curvePoints.map((pt) => {
    // Find child records taken around this month
    const matchingRec = records.find((r) => {
      const birth = new Date(activeChild!.birth_date);
      const meas = new Date(r.measurement_date);
      const diffMonths = Math.round((meas.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
      return diffMonths === pt.age_months;
    });

    let actualVal = undefined;
    if (matchingRec) {
      if (activeMetric === 'weight_kg') actualVal = matchingRec.weight_kg;
      if (activeMetric === 'height_cm') actualVal = matchingRec.height_cm;
      if (activeMetric === 'head_circumference_cm') actualVal = matchingRec.head_circumference_cm;
    }

    return {
      age_months: pt.age_months,
      p3: pt.p3,
      p50: pt.p50,
      p97: pt.p97,
      actual: actualVal,
    };
  });

  const metricLabel = activeMetric === 'weight_kg' ? '체중 (kg)' : activeMetric === 'height_cm' ? '신장 (cm)' : '머리둘레 (cm)';

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">성장 추적 관리</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-xs font-bold border border-emerald-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              질병관리청 2017 소아 성장도표 표준
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            공식 성장도표(LMS) 기반 백분위수를 자동 산출하고 추세를 시각화합니다.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          측정 기록 추가
        </button>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex rounded-2xl bg-slate-200/60 p-1.5 max-w-md">
        {[
          { id: 'weight_kg', label: '⚖️ 체중', icon: Scale },
          { id: 'height_cm', label: '📏 신장 (키)', icon: Ruler },
          { id: 'head_circumference_cm', label: '👶 머리둘레', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveMetric(tab.id as any)}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeMetric === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Growth Chart Card */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{metricLabel} 성장 백분위 곡선</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              회색 곡선(3%, 50%, 97% 표준 구간) vs 파란 점/선(우리 아기 실제 측정값)
            </p>
          </div>
          {activeChild?.is_premature && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/50">
              ⚠️ 미숙아 교정연령 계산식 적용 중
            </span>
          )}
        </div>

        <div className="h-80 w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="age_months"
                tickFormatter={(val) => `${val}개월`}
                stroke="#94A3B8"
                fontSize={12}
              />
              <YAxis stroke="#94A3B8" fontSize={12} />
              <Tooltip
                formatter={(val: any, name: any) => {
                  if (name === 'actual') return [`${val}`, '우리 아기'];
                  if (name === 'p50') return [`${val}`, '표준 50백분위 (중간값)'];
                  if (name === 'p97') return [`${val}`, '표준 97백분위 (상위 3%)'];
                  if (name === 'p3') return [`${val}`, '표준 3백분위 (하위 3%)'];
                  return [val, name];
                }}
                labelFormatter={(lbl) => `생후 ${lbl}개월`}
              />
              <Legend
                formatter={(value) => {
                  if (value === 'p3') return '3% 기준 (하위)';
                  if (value === 'p50') return '50% 기준 (표준)';
                  if (value === 'p97') return '97% 기준 (상위)';
                  if (value === 'actual') return '★ 우리 아기 측정값';
                  return value;
                }}
              />
              <Line type="monotone" dataKey="p97" stroke="#CBD5E1" strokeDasharray="3 3" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="p50" stroke="#94A3B8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p3" stroke="#CBD5E1" strokeDasharray="3 3" dot={false} strokeWidth={1.5} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563EB"
                strokeWidth={3}
                dot={{ r: 6, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Measurement History Table */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-900 text-base mb-4">성장 측정 기록 이력</h3>
        {records.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            아직 측정된 기록이 없습니다. 상단의 '측정 기록 추가'를 눌러 첫 기록을 입력해 보세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">측정일자</th>
                  <th className="py-3 px-4">체중 (백분위)</th>
                  <th className="py-3 px-4">신장 (백분위)</th>
                  <th className="py-3 px-4">머리둘레 (백분위)</th>
                  <th className="py-3 px-4">메모</th>
                  <th className="py-3 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.measurement_date}</td>
                    <td className="py-3 px-4">
                      {r.weight_kg ? `${r.weight_kg} kg ` : '-'}
                      {r.weight_percentile && (
                        <span className="text-xs text-blue-600 font-bold">({r.weight_percentile}%)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.height_cm ? `${r.height_cm} cm ` : '-'}
                      {r.height_percentile && (
                        <span className="text-xs text-blue-600 font-bold">({r.height_percentile}%)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.head_circumference_cm ? `${r.head_circumference_cm} cm ` : '-'}
                      {r.head_circumference_percentile && (
                        <span className="text-xs text-blue-600 font-bold">({r.head_circumference_percentile}%)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs truncate max-w-xs">{r.notes || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRecord(r.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="신체 성장 측정 기록 추가">
        <form onSubmit={handleCreateRecord} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">측정일자</label>
            <input
              type="date"
              required
              value={measurementDate}
              onChange={(e) => setMeasurementDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">체중 (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="40"
                placeholder="예: 6.85"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">신장 (cm)</label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="150"
                placeholder="예: 64.5"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">머리둘레 (cm)</label>
            <input
              type="number"
              step="0.1"
              min="15"
              max="65"
              placeholder="예: 41.2"
              value={headCircumferenceCm}
              onChange={(e) => setHeadCircumferenceCm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">메모</label>
            <input
              type="text"
              placeholder="예: 소아과 영유아검진 측정"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              {isSubmitting ? '저장 중...' : '저장 완료'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
