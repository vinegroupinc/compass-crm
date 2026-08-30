import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { Logo, Modal } from './UI'
import { laDayDateLabel, daysSinceTimestamp } from '../lib/time'

function FollowupPrompt({ stale, onClose }) {
  const navigate = useNavigate()
  const job = stale[0]
  if (!job) return null
  // Most recent activity timestamp for this job, so the "last touched" line
  // matches the new stale rule (not just status change time).
  const candidates = [job.status_changed_at]
  for (const n of (job.notes || [])) {
    if (n.created_at && !n.deleted_at) candidates.push(n.created_at)
  }
  for (const t of (job.tasks || [])) {
    if (t.created_at)   candidates.push(t.created_at)
    if (t.completed_at) candidates.push(t.completed_at)
  }
  const latest = candidates.filter(Boolean).reduce((a, b) => (a > b ? a : b), null)
  return (
    <Modal onClose={onClose}>
      <h3>Time for a check-in</h3>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 4 }}>
        {stale.length > 1
          ? `${stale.length} jobs haven't had any activity in a week.`
          : `This job hasn't had any activity in a week.`}{' '}
        Want to take a look?
      </p>
      <div className="card-pad" style={{ marginTop: 14, marginBottom: 16, padding: 14 }}>
        <div style={{ fontWeight: 600 }}>{job.street_address}{job.unit ? ` · Unit ${job.unit}` : ''}</div>
        <div className="hint" style={{ marginTop: 4 }}>
          {job.status} · last touched {daysSinceTimestamp(latest)} days ago
        </div>
      </div>
      <div className="row">
        <button
          className="btn btn-accent btn-block"
          onClick={() => { onClose(); navigate(`/job/${job.id}`) }}
        >
          Update this job
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Later</button>
      </div>
    </Modal>
  )
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const { staleJobs } = useData()
  const navigate = useNavigate()
  const [showPrompt, setShowPrompt] = useState(true)

  const navItem = ({ isActive }) => (isActive ? 'active' : '')

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand-link" onClick={() => navigate('/')} role="button" aria-label="Go to dashboard">
            <Logo variant="header" />
            <div>
              <div className="brand-sub">Compass • {laDayDateLabel()}</div>
            </div>
          </div>
          <div className="topbar-spacer" />
          <nav className="nav desktop-nav">
            <NavLink to="/" end className={navItem}>Dashboard</NavLink>
            <NavLink to="/calendar" className={navItem}>Calendar</NavLink>
            <NavLink to="/lists" className={navItem}>Contacts</NavLink>
            <NavLink to="/search" className={navItem}>Search</NavLink>
          </nav>
          <button className="btn btn-ghost btn-sm desktop-nav" onClick={signOut} style={{ marginLeft: 8 }}>
            {user?.name} · Sign out
          </button>
          <button className="btn btn-ghost btn-sm mobile-only signout-mobile" onClick={signOut} title="Sign out" aria-label="Sign out">
            ⎋
          </button>
        </div>
      </header>

      <main className="page">
        <div className="container">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <span>© Malaga Ventures LLC. All rights reserved.</span>
          <span className="site-footer-right">
            <span>Standard issue license for Vine Group Inc.</span>
            {user && (
              <NavLink to="/admin/login" className="site-footer-admin">Admin</NavLink>
            )}
          </span>
        </div>
      </footer>

      <nav className="bottom-nav">
        <NavLink to="/" end className={navItem}>
          <span className="ico">▣</span>Dashboard
        </NavLink>
        <NavLink to="/calendar" className={navItem}>
          <span className="ico">▦</span>Calendar
        </NavLink>
        <NavLink to="/new" className={navItem}>
          <span className="ico">＋</span>New Job
        </NavLink>
        <NavLink to="/lists" className={navItem}>
          <span className="ico">≡</span>Contacts
        </NavLink>
        <NavLink to="/search" className={navItem}>
          <span className="ico">⌕</span>Search
        </NavLink>
      </nav>

      {showPrompt && staleJobs.length > 0 && (
        <FollowupPrompt stale={staleJobs} onClose={() => setShowPrompt(false)} />
      )}
    </div>
  )
}
