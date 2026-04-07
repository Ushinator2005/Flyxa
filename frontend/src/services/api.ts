import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings, ExtractedTradeData } from '../types/index.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const API_URL = import.meta.env.VITE_API_URL as string || 'http://localhost:3001';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

class ApiService {
  private async getHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  private async getAuthHeader(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  }

  async get<T>(path: string): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, { headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const authHeader = await this.getAuthHeader();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
  }
}

export const api = new ApiService();

export const tradesApi = {
  getAll: () => api.get<Trade[]>('/api/trades'),
  create: (data: Partial<Trade>) => api.post<Trade>('/api/trades', data),
  update: (id: string, data: Partial<Trade>) => api.put<Trade>(`/api/trades/${id}`, data),
  delete: (id: string) => api.delete(`/api/trades/${id}`),
};

export const analyticsApi = {
  getSummary: () => api.get('/api/analytics/summary'),
  getDailyPnL: () => api.get('/api/analytics/daily-pnl'),
  getEquityCurve: () => api.get('/api/analytics/equity-curve'),
  getBySession: () => api.get('/api/analytics/by-session'),
  getByInstrument: () => api.get('/api/analytics/by-instrument'),
  getByDayOfWeek: () => api.get('/api/analytics/by-day-of-week'),
  getByTimeOfDay: () => api.get('/api/analytics/by-time-of-day'),
  getMonthlyHeatmap: (year: number, month: number) =>
    api.get(`/api/analytics/monthly-heatmap?year=${year}&month=${month}`),
  getAdvanced: () => api.get('/api/analytics/advanced'),
};

export const aiApi = {
  scanChart: (
    file: File,
    entryDate: string,
    entryTime: string,
    focusImages: File[] = [],
    scannerContext?: Record<string, unknown>
  ) => {
    const formData = new FormData();
    formData.append('image', file);
    focusImages.forEach(image => formData.append('focusImages', image));
    if (scannerContext) {
      formData.append('scannerContext', JSON.stringify(scannerContext));
    }
    formData.append('entryDate', entryDate);
    formData.append('entryTime', entryTime);
    return api.postFormData<ExtractedTradeData & { warnings?: string[] }>('/api/ai/scan', formData);
  },
  analyzeTradeById: (tradeId: string) => api.post(`/api/ai/trade-analysis/${tradeId}`, {}),
  analyzePatterns: () => api.post('/api/ai/patterns', {}),
  weeklyReport: (weekStart: string, weekEnd: string) =>
    api.post('/api/ai/weekly-report', { weekStart, weekEnd }),
  psychologyReport: () => api.post('/api/ai/psychology-report', {}),
  playbookCheck: (tradeId: string) => api.post(`/api/ai/playbook-check/${tradeId}`, {}),
  flyxaChat: (
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) => api.post<{ reply: string }>('/api/ai/flyxa-chat', { question, history }),
};

export const riskApi = {
  getSettings: () => api.get<RiskSettings>('/api/risk/settings'),
  updateSettings: (data: Partial<RiskSettings>) => api.put<RiskSettings>('/api/risk/settings', data),
  getDailyStatus: () => api.get('/api/risk/daily-status'),
};

export const psychologyApi = {
  getAll: () => api.get('/api/psychology'),
  create: (data: Record<string, unknown>) => api.post('/api/psychology', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/psychology/${id}`, data),
  delete: (id: string) => api.delete(`/api/psychology/${id}`),
  getMindsetChart: () => api.get('/api/psychology/mindset-chart'),
};

export const playbookApi = {
  getAll: () => api.get('/api/playbook'),
  create: (data: Record<string, unknown>) => api.post('/api/playbook', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/playbook/${id}`, data),
  delete: (id: string) => api.delete(`/api/playbook/${id}`),
};

export const journalApi = {
  getAll: () => api.get('/api/journal'),
  getById: (id: string) => api.get(`/api/journal/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/journal', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/journal/${id}`, data),
  delete: (id: string) => api.delete(`/api/journal/${id}`),
};

export const marketDataApi = {
  getChart: (symbol: string, interval: string, range: string) =>
    api.get<Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>>(
      `/api/market-data/chart?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
    ),
};
