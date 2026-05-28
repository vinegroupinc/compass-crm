import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewJob from './pages/NewJob'
import JobDetail from './pages/JobDetail'
import Properties from './pages/Properties'
import Calendar from './pages/Calendar'
import Lists from './pages/Lists'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="empty" style={{ paddingTop: 80 }}>Loading Compass…</div>
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
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DataProvider>
  )
}
