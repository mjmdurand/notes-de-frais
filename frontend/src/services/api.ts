import axios from 'axios'
import type { Document, ExpenseItem, ExpenseReport, ExpenseReportList, ExpenseReportListAll, Notification, Team, User } from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const isLoginEndpoint = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('token')
      const current = window.location.pathname + window.location.search
      const redirect = current !== '/login' ? `?redirect=${encodeURIComponent(current)}` : ''
      window.location.href = `/login${redirect}`
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, new_password }),
  demoInfo: () =>
    api.get<{ enabled: boolean; accounts: { role: string; email: string; password: string }[] }>('/auth/demo-info'),
}

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  listManagers: () => api.get<User[]>('/users/managers'),
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: { email: string; first_name: string; last_name: string; role: string; team_id: string }) =>
    api.post<User>('/users', data),
  update: (id: string, data: { first_name?: string; last_name?: string; role?: string; team_id?: string; is_active?: boolean }) =>
    api.put<User>(`/users/${id}`, data),
  sendReset: (id: string) => api.post(`/users/${id}/send-reset`),
  delete: (id: string) => api.delete(`/users/${id}`),
}

export const expensesApi = {
  list: () => api.get<ExpenseReportList[]>('/expenses'),
  pendingManager: () => api.get<ExpenseReportList[]>('/expenses/pending-manager'),
  pendingAccounting: () => api.get<ExpenseReportList[]>('/expenses/pending-accounting'),
  get: (id: string) => api.get<ExpenseReport>(`/expenses/${id}`),
  create: (data: { title: string; document_ids: string[] }) =>
    api.post<ExpenseReport>('/expenses', data),
  submit: (id: string) => api.post<ExpenseReport>(`/expenses/${id}/submit`),
  approve: (id: string, data: { status: string; reason?: string }) =>
    api.post<ExpenseReport>(`/expenses/${id}/approve`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  listAll: () => api.get<ExpenseReportListAll[]>('/expenses/all'),
  updateItem: (itemId: string, data: Partial<ExpenseItem>) =>
    api.put<ExpenseItem>(`/expenses/items/${itemId}`, data),
}

export const documentsApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Document>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  get: (id: string) => api.get<Document>(`/documents/${id}`),
  getUrl: (id: string) => api.get<{ url: string }>(`/documents/${id}/url`),
}

export const teamsApi = {
  list: () => api.get<Team[]>('/teams'),
  create: (data: { name: string; manager_id?: string }) => api.post<Team>('/teams', data),
  update: (id: string, data: { name?: string; manager_id?: string | null }) =>
    api.put<Team>(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
}

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
}

export default api
