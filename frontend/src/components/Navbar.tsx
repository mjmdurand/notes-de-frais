import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BarChart2, CheckSquare, FileText, Home, Layers, LogOut, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { notificationsApi } from '../services/api'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    const fetchUnread = () => {
      notificationsApi.unreadCount().then((r) => setUnread(r.data.count)).catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleBellClick = async () => {
    if (!showNotifs) {
      const r = await notificationsApi.list()
      setNotifications(r.data)
    }
    setShowNotifs(!showNotifs)
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setUnread(0)
    setNotifications((n) => n.map((x) => ({ ...x, is_read: true })))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLink = (to: string, label: string, icon: React.ReactNode) => (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        location.pathname === to
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-blue-700 text-lg">
            <FileText className="w-6 h-6" />
            Notes de Frais
          </Link>
          <div className="flex items-center gap-1">
            {navLink('/', 'Mon espace', <Home className="w-4 h-4" />)}
            {(user?.role === 'manager' || user?.role === 'admin') &&
              navLink('/manager', 'Validation manager', <FileText className="w-4 h-4" />)}
            {(user?.role === 'accounting' || user?.role === 'admin') && <>
              {navLink('/accounting', 'Validation', <CheckSquare className="w-4 h-4" />)}
              {navLink('/accounting/reports', 'Tous les rapports', <BarChart2 className="w-4 h-4" />)}
            </>}
            {user?.role === 'admin' && <>
              {navLink('/admin', 'Utilisateurs', <Users className="w-4 h-4" />)}
              {navLink('/admin/teams', 'Équipes', <Layers className="w-4 h-4" />)}
            </>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={handleBellClick}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-10 w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                <div className="flex items-center justify-between p-3 border-b">
                  <span className="font-medium text-sm">Notifications</span>
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                    Tout marquer lu
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">Aucune notification</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          if (n.report_id) navigate(`/expenses/${n.report_id}`)
                          notificationsApi.markRead(n.id).catch(() => {})
                          setShowNotifs(false)
                        }}
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="text-sm text-gray-600">
            {user?.first_name} {user?.last_name}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
