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

const PUBLIC_PATHS = ['/forgot', '/set-password']

// When a user arrives from a Supabase email link (invite or recovery),
// supabase-js parses the URL hash and creates a session BEFORE our app
// renders. Detect those two link types and force the password-set flow,
// regardless of which path they happened to land on.
function detectEmailFlow() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash || ''
  if (!hash) return null
  // Hash looks like: #access_token=...&type=invite&... or type=recovery
  const params = new URLSearchParams(hash.slice(1))
  const type = params.get('type')
  if (type === 'invite' || type === 'recovery') return type
  return null
}

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading Compass…</div>
  }

  const emailFlow = detectEmailFlow()

  // If the user arrived from an invite or recovery email, ALWAYS send them
  // through the set-password page first — even if a session was auto-created.
  if (emailFlow && location.pathname !== '/set-password') {
    return <Navigate to={`/set-password${window.location.hash}`} replace />
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
