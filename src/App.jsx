import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import { useEffect, useState } from 'react'
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

// Temporary diagnostic: visit ?debug=user to see the raw session user object.
// Helps us figure out what fields Supabase populates after an invite link.
function DebugUser() {
  const [raw, setRaw] = useState('Loading…')
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession()
      setRaw(JSON.stringify(data.session?.user || null, null, 2))
    })()
  }, [])
  return (
    <pre style={{ padding: 20, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fff', color: '#000', minHeight: '100vh' }}>
      {raw}
    </pre>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Diagnostic short-circuit
  if (typeof window !== 'undefined' && window.location.search.includes('debug=user')) {
    return <DebugUser />
  }

  if (loading) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading Compass…</div>
  }

  // If the user is signed in but has never set a password (i.e. came in
  // through an invite link), force them to set-password before anything else.
  // This is reliable because it checks the user record itself, not the URL.
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
