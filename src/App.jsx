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
import Properties from './pages/Properties'
import Search from './pages/Search'
import Calendar from './pages/Calendar'
import Lists from './pages/Lists'

// Routes that should always render, even with an active session
// (so the password-set flow from an email link works without being
// auto-redirected to the dashboard).
const PUBLIC_PATHS = ['/forgot', '/set-password']

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading Compass…</div>
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
          <Route path="/properties" element={<Properties />} />
          <Route path="/search" element={<Search />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DataProvider>
  )
}
