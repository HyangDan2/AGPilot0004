import { Child } from '../types';

const CHILDREN_KEY = 'babycare_local_children_v1';
const ACTIVE_CHILD_KEY = 'babycare_active_child_id_v1';
const ANALYTICS_KEY = 'babycare_local_analytics_v1';
const ANALYTICS_BY_CHILD_KEY = 'babycare_local_analytics_by_child_v1';

function computeAgeMetrics(birthDateStr: string) {
  const birth = new Date(birthDateStr);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
  const months = Math.round((diffDays / 30.4375) * 10) / 10;
  return { days_since_birth: diffDays, months_since_birth: months };
}

export const localStore = {
  getChildren(): Child[] {
    try {
      const raw = localStorage.getItem(CHILDREN_KEY);
      if (!raw) return [];
      const parsed: Child[] = JSON.parse(raw);
      return parsed.map((c) => ({
        ...c,
        ...computeAgeMetrics(c.birth_date),
      }));
    } catch {
      return [];
    }
  },

  saveChildren(children: Child[]) {
    try {
      localStorage.setItem(CHILDREN_KEY, JSON.stringify(children));
    } catch {
      // ignore storage quota errors
    }
  },

  upsertChild(partial: {
    id?: string;
    name: string;
    birth_date: string;
    sex?: 'male' | 'female';
    is_premature?: boolean;
    due_date?: string;
    gestational_weeks?: number;
  }): Child {
    const list = this.getChildren();
    const existing = list.find(
      (c) => (partial.id && c.id === partial.id) || c.name === partial.name
    );
    const metrics = computeAgeMetrics(partial.birth_date);

    if (existing) {
      const updated: Child = {
        ...existing,
        ...partial,
        ...metrics,
        updated_at: new Date().toISOString(),
      };
      const next = list.map((c) => (c.id === existing.id ? updated : c));
      this.saveChildren(next);
      return updated;
    }

    const created: Child = {
      id: partial.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: partial.name,
      birth_date: partial.birth_date,
      sex: partial.sex || 'male',
      is_premature: Boolean(partial.is_premature),
      due_date: partial.due_date,
      gestational_weeks: partial.gestational_weeks,
      created_by: 'local',
      role: 'owner',
      members: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...metrics,
    };
    this.saveChildren([...list, created]);
    return created;
  },

  getActiveChildId(): string | null {
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  },

  setActiveChildId(id: string) {
    localStorage.setItem(ACTIVE_CHILD_KEY, id);
  },

  mergeAnalyticsResult(childName: string, incomingResult: any): any {
    try {
      const allMap = JSON.parse(localStorage.getItem(ANALYTICS_BY_CHILD_KEY) || '{}');
      const prev = allMap[childName];

      let mergedRows: any[] = incomingResult.daily_rows || [];
      if (prev && Array.isArray(prev.daily_rows)) {
        const byDate: Record<string, any> = {};
        for (const r of prev.daily_rows) byDate[r.date] = r;
        for (const r of incomingResult.daily_rows || []) {
          const ex = byDate[r.date];
          if (!ex || (r.has_active_data && !ex.has_active_data) || r.has_active_data) {
            byDate[r.date] = r;
          }
        }
        mergedRows = Object.keys(byDate)
          .sort()
          .map((d) => byDate[d]);
      }

      const activeRows = mergedRows.filter((r) => r.has_active_data);
      const denom = Math.max(1, activeRows.length);
      const avg = (key: string) =>
        Math.round((activeRows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / denom) * 10) / 10;

      const mergedSummary = {
        ...(incomingResult.summary || {}),
        total_days_in_file: mergedRows.length,
        active_days_count: activeRows.length,
        date_range_start: activeRows[0]?.date || incomingResult.summary?.date_range_start,
        date_range_end: activeRows[activeRows.length - 1]?.date || incomingResult.summary?.date_range_end,
        avg_formula_ml: avg('formula_ml'),
        avg_formula_count: avg('formula_count'),
        avg_expressed_ml: avg('expressed_milk_ml'),
        avg_breastfeeding_min: avg('breastfeeding_total_min'),
        avg_solid_ml: avg('solid_food_ml'),
        avg_nap_min: avg('nap_duration_min'),
        avg_night_min: avg('night_sleep_min'),
        avg_night_hours: Math.round((avg('night_sleep_min') / 60) * 10) / 10,
        avg_total_sleep_hours: Math.round((avg('total_sleep_min') / 60) * 10) / 10,
        avg_diaper_urine_count: avg('diaper_urine_count'),
        avg_diaper_stool_count: avg('diaper_stool_count'),
      };

      const finalResult = {
        ...incomingResult,
        daily_rows: mergedRows,
        summary: mergedSummary,
      };

      allMap[childName] = finalResult;
      localStorage.setItem(ANALYTICS_BY_CHILD_KEY, JSON.stringify(allMap));
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(finalResult));
      return finalResult;
    } catch {
      return incomingResult;
    }
  },

  clearAnalytics() {
    localStorage.removeItem(ANALYTICS_KEY);
    localStorage.removeItem(ANALYTICS_BY_CHILD_KEY);
  },
};
