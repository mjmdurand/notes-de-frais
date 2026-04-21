import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import CreateExpenseReport from './pages/CreateExpenseReport'
import ExpenseReportDetail from './pages/ExpenseReportDetail'
import ManagerDashboard from './pages/ManagerDashboard'
import AccountingDashboard from './pages/AccountingDashboard'
import AccountingAllReports from './pages/AccountingAllReports'
import AdminDashboard from './pages/AdminDashboard'
import AdminTeams from './pages/AdminTeams'

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses/new"
        element={
          <ProtectedRoute>
            <CreateExpenseReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses/:id"
        element={
          <ProtectedRoute>
            <ExpenseReportDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager"
        element={
          <ProtectedRoute roles={['manager', 'admin']}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounting"
        element={
          <ProtectedRoute roles={['accounting', 'admin']}>
            <AccountingDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounting/reports"
        element={
          <ProtectedRoute roles={['accounting', 'admin']}>
            <AccountingAllReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/teams"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminTeams />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
