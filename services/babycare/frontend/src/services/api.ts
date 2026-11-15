const API_BASE = '/api/babycare/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('babycare_access_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null as unknown as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || response.statusText || '요청 처리 중 오류가 발생했습니다.';
    throw new ApiError(response.status, errorMsg, data);
  }

  return data as T;
}

export const api = {
  // Auth
  devLogin: (email: string, name?: string, role: string = 'user') =>
    request<{ access_token: string; user: any }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name, role }),
    }),
  getMe: () => request<any>('/auth/me'),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Children
  getChildren: () => request<any[]>('/children'),
  getChild: (id: string) => request<any>(`/children/${id}`),
  createChild: (data: any) =>
    request<any>('/children', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateChild: (id: string, data: any) =>
    request<any>(`/children/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteChild: (id: string) =>
    request<void>(`/children/${id}`, {
      method: 'DELETE',
    }),
  uploadAvatar: async (childId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/children/${childId}/upload-avatar`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new ApiError(res.status, err?.detail || '이미지 업로드 실패');
    }
    return res.json();
  },
  inviteMember: (childId: string, email: string, role: string) =>
    request<any>(`/children/${childId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (childId: string, memberId: string) =>
    request<void>(`/children/${childId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  // Growth
  getGrowthRecords: (childId: string) => request<any[]>(`/children/${childId}/growth`),
  createGrowthRecord: (childId: string, data: any) =>
    request<any>(`/children/${childId}/growth`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateGrowthRecord: (childId: string, recordId: string, data: any) =>
    request<any>(`/children/${childId}/growth/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteGrowthRecord: (childId: string, recordId: string) =>
    request<void>(`/children/${childId}/growth/${recordId}`, {
      method: 'DELETE',
    }),
  getGrowthCurves: (childId: string, metric: string = 'weight_kg') =>
    request<any>(`/children/${childId}/growth/curves?metric=${metric}`),
  getGrowthSummary: (childId: string) =>
    request<any>(`/children/${childId}/growth/summary`),

  // Feeding
  getFeedingRecords: (childId: string, targetDate?: string) => {
    const q = targetDate ? `?target_date=${targetDate}` : '';
    return request<any[]>(`/children/${childId}/feeding${q}`);
  },
  createFeedingRecord: (childId: string, data: any) =>
    request<any>(`/children/${childId}/feeding`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteFeedingRecord: (childId: string, recordId: string) =>
    request<void>(`/children/${childId}/feeding/${recordId}`, {
      method: 'DELETE',
    }),
  getFeedingSummary: (childId: string, dateStr?: string) => {
    const q = dateStr ? `?date_str=${dateStr}` : '';
    return request<any>(`/children/${childId}/feeding/daily-summary${q}`);
  },

  // Sleep
  getSleepRecords: (childId: string, targetDate?: string) => {
    const q = targetDate ? `?target_date=${targetDate}` : '';
    return request<any[]>(`/children/${childId}/sleep${q}`);
  },
  createSleepRecord: (childId: string, data: any) =>
    request<any>(`/children/${childId}/sleep`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSleepRecord: (childId: string, recordId: string, data: any) =>
    request<any>(`/children/${childId}/sleep/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteSleepRecord: (childId: string, recordId: string) =>
    request<void>(`/children/${childId}/sleep/${recordId}`, {
      method: 'DELETE',
    }),
  getSleepSummary: (childId: string, dateStr?: string) => {
    const q = dateStr ? `?date_str=${dateStr}` : '';
    return request<any>(`/children/${childId}/sleep/daily-summary${q}`);
  },

  // Calendar
  getCalendarEvents: (childId: string, eventType?: string) => {
    const q = eventType ? `?event_type=${eventType}` : '';
    return request<any[]>(`/children/${childId}/calendar${q}`);
  },
  createCalendarEvent: (childId: string, data: any) =>
    request<any>(`/children/${childId}/calendar`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCalendarEvent: (childId: string, eventId: string, data: any) =>
    request<any>(`/children/${childId}/calendar/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCalendarEvent: (childId: string, eventId: string) =>
    request<void>(`/children/${childId}/calendar/${eventId}`, {
      method: 'DELETE',
    }),
  getCalendarSummary: (childId: string) =>
    request<any>(`/children/${childId}/calendar/summary`),

  // Knowledge
  getArticles: (category?: string, ageMonths?: number, keyword?: string) => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (ageMonths !== undefined && ageMonths !== null) params.append('age_months', String(ageMonths));
    if (keyword) params.append('keyword', keyword);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<any[]>(`/articles${q}`);
  },
  getArticle: (id: string) => request<any>(`/articles/${id}`),

  // AI
  chatAI: (message: string, childId?: string, useChildContext: boolean = false, conversationId?: string) =>
    request<any>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        child_id: childId,
        use_child_context: useChildContext,
        conversation_id: conversationId,
      }),
    }),
  getConversations: () => request<any[]>('/ai/conversations'),
};
