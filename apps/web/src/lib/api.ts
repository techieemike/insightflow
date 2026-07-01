import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const register = (email: string, password: string, name: string) =>
  api.post('/auth/register', { email, password, name });

export const getMe = () => api.get('/auth/me');

export const uploadFile = (file: File, name?: string, onProgress?: (pct: number) => void) => {
  const form = new FormData();
  form.append('file', file);
  if (name) form.append('name', name);
  return api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    }
  });
};

export const getDatasets  = () => api.get('/datasets');
export const getDataset   = (id: string) => api.get(`/datasets/${id}`);
export const getRecords   = (id: string, params: any) => api.get(`/datasets/${id}/records`, { params });
export const getInsights  = (id: string) => api.get(`/insights/${id}`);
export const getChartData = (id: string) => api.get(`/datasets/${id}/charts`);
export const sendChat     = (id: string, question: string) => api.post(`/chat/${id}`, { question });
export const getChatHistory = (id: string) => api.get(`/chat/${id}`);
export const exportCsv    = (id: string, excludeDuplicates: boolean) =>
  api.get(`/export/${id}/csv`, { params: { excludeDuplicates }, responseType: 'blob' });
export const exportExcel  = (id: string, excludeDuplicates: boolean) =>
  api.get(`/export/${id}/excel`, { params: { excludeDuplicates }, responseType: 'blob' });
export const exportWord   = (id: string) =>
  api.get(`/export/${id}/word`, { responseType: 'blob' });
export const updateRecord = (id: string, recordId: string, data: any) =>
  api.patch(`/datasets/${id}/records/${recordId}`, { data });
export const transformDataset = (id: string, action: string, params?: any) =>
  api.post(`/datasets/${id}/transform`, { action, params });

export const queryDataset = (id: string, sql: string, confirm?: boolean) =>
  api.post(`/datasets/${id}/query`, { sql, confirm });

export const executeQuery = (sql: string, confirm?: boolean) =>
  api.post('/datasets/query', { sql, confirm });

export const exportQueryResults = (columns: string[], rows: any[], format: 'csv' | 'excel') =>
  api.post('/export/rows', { format, columns, rows }, { responseType: 'blob' });

export default api;
