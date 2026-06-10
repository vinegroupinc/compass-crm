import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import SetPassword from './pages/SetPassword'
import Dashboard from './pages/Dashboard'
import NewJob from './pages/NewJob'
import JobDetail from './pages/JobDetail'
import JobCosting from './pages/JobCosting'
import Properties from './pages/Properties'
import Search from './pages/Search'
import Calendar from './pages/Calendar'
import Lists from './pages/Lists'
import AdminLogin from './pages/AdminLogin'
import Admin from './pages/Admin'

const PUBLIC_PATHS = ['/forgot', '/set-password']

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading Compass…</div>
  }

  // If the user just clicked an invite link, force them to set a password
  // before they can use the app. needsPasswordSetup is computed in
  // authProvider.normalizeUser by comparing email_confirmed_at and
  // last_sign_in_at timestamps (they're essentially equal on an invite click).
  if (user?.needsPasswordSetup && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />
  }

  // Public auth flows: always accessible.
  if (PUBLIC_PATHS.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/set-password" element={<SetPassword />} />
      </Routes>
    )
  }

  if (!user) return <Login />

  return (
    <DataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewJob />} />
          <Route path="/job/:id" element={<JobDetail />} />
          <Route path="/job/:id/costing" element={<JobCosting />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/search" element={<Search />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DataProvider>
  )
}
