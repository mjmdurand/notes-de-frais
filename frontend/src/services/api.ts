import axios from 'axios'
import type { Document, ExpenseItem, ExpenseReport, ExpenseReportList, ExpenseReportListAll, Notification, User } from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
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
  create: (data: Partial<User> & { password: string }) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User> & { password?: string }) => api.put<User>(`/users/${id}`, data),
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

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
}

export default api
