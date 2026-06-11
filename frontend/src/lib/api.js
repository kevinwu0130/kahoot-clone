import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { BACKEND_URL };

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
};

// Quiz API
export const quizAPI = {
  list: () => api.get('/quizzes'),
  get: (id) => api.get(`/quizzes/${id}`),
  create: (data) => api.post('/quizzes', data),
  update: (id, data) => api.put(`/quizzes/${id}`, data),
  delete: (id) => api.delete(`/quizzes/${id}`),
  addQuestion: (quizId, data) => api.post(`/quizzes/${quizId}/questions`, data),
  updateQuestion: (qid, data) => api.put(`/quizzes/questions/${qid}`, data),
  deleteQuestion: (qid) => api.delete(`/quizzes/questions/${qid}`),
  importCSV: (quizId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/quizzes/${quizId}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// Game API
export const gameAPI = {
  create: (quizId, opts = {}) => api.post('/games', { quizId, ...opts }),
  get: (id) => api.get(`/games/${id}`),
  getResults: (id) => api.get(`/games/${id}/results`),
};
