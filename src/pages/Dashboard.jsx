import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/UI'
import {
  HIDDEN_FROM_DASHBOARD,
  ACTIVE_STATUS_ORDER,
} from '../lib/constants'
import { laToday } from '../lib/time'

// Compact card used everywhere on the dashboard. Drops mgmt/tech/dates;
// shows status pill, job type, address, and (optionally) tasks assigned to
// the current user. Used in Planner, Needs Attention, and every status window.
function CompactCard({ job, flag, userId }) {
  const today = laToday()
  const tasks = userId
    ? (job.tasks || []).filter(
        (t) => t.assigned_user_id === userId && !t.done && (!t.due_date || t.due_date <= today)
      )
    : []
  return (
    <Link to={`/job/${job.id}`} className={`job-card job-card-compact ${flag ? 'flag-' + flag : ''}`}>
      <div className="badges" style={{ marginBottom: 6 }}>
        <StatusBadge status={job.status} />
        <span className="badge badge-soft">{job.job_type}</span>
      </div>
      <div className="job-title" style={{ fontSize: 15 }}>
        {job.street_address}{job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {job.unit}</span> : null}
      </div>
      {tasks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {tasks.map((t) => (
            <div key={t.id} className="task-line">
              <span className="task-check" />
              <span className="task-text">{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

export default function Dashboard() {
  const { jobs, loading, error } = useData()
  const { user } = useAuth()

  if (loading) return <div className="empty">Loading jobs…</div>
  if (error) return <div className="empty" style={{ color: 'var(--attention)' }}>{error}</div>

  const active = jobs.filter((j) => !HIDDEN_FROM_DASHBOARD.includes(j.status))
  const today = laToday()
  const isDueNow = (t) => !t.due_date || t.due_date <= today

  // Planner: jobs with an open task assigned to me that's due now.
  const myJobs = active.filter((j) =>
    (j.tasks || []).some(
      (t) => t.assigned_user_id === user.id && !t.done && isDueNow(t)
    )
  )

  // Needs Attention: jobs flagged as such. Independent of Planner.
  const attention = active.filter((j) => j.needs_attention)

  // Every active status, always shown — even empty ones — so the dashboard
  // layout is consistent day-to-day. Jobs are not de-duplicated; a job in
  // Planner / Needs Attention also still shows in its status window.
  const byStatus = ACTIVE_STATUS_ORDER.map((status) => ({
    status,
    jobs: active.filter((j) => j.status === status),
  }))

  const nothing = active.length === 0
  // Split top into 2 columns only when BOTH have items
  const bothTop = myJobs.length > 0 && attention.length > 0

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="hint">Hi {user.name?.split(' ')[0] || user.name} — here's what needs you.</div>
        </div>
        <Link to="/new" className="btn btn-accent desktop-nav">+ New Job</Link>
      </div>

      {nothing && <div className="empty">No active jobs yet. Tap "New Job" to add the first one.</div>}

      {/* PLANNER SECTION — header, then Planner card + Needs Attention card
          side-by-side (or single full-width when only one has items). */}
      {(myJobs.length > 0 || attention.length > 0) && (
        <section className="planner-section">
          <div className="section-head">
            <span className="section-rail rail-mine" />
            <h2>Planner</h2>
          </div>

          <div className={bothTop ? 'planner-grid' : ''}>
            {myJobs.length > 0 && (
              <div className="planner-window">
                <div className={`planner-window-body ${myJobs.length >= 2 ? 'planner-window-scroll' : ''}`}>
                  <div className="planner-stack">
                    {myJobs.map((j) => (
                      <CompactCard key={j.id} job={j} flag="mine" userId={user.id} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {attention.length > 0 && (
              <div className="planner-window attention-window">
                <div className="attention-banner">
                  <span className="attention-banner-icon">🚨</span>
                  <span>Items that need immediate attention</span>
                </div>
                <div className={`planner-window-body ${attention.length >= 3 ? 'planner-window-scroll' : ''}`}>
                  <div className="planner-stack">
                    {attention.map((j) => (
                      <CompactCard key={j.id} job={j} flag="attention" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SEPARATOR + ALL ACTIVE JOBS HEADER */}
      <div className="all-jobs-divider" />
      <div className="all-jobs-header">
        <h2>All Active Jobs</h2>
        <span className="hint">Every active job, grouped by status.</span>
      </div>

      {/* Status windows — 2 per row on desktop, 1 per row on mobile.
          Every status renders, even empty ones. */}
      <div className="status-grid">
        {byStatus.map((group) => {
          const isEmpty = group.jobs.length === 0
          return (
            <section
              key={group.status}
              className={`status-window ${isEmpty ? 'status-window-empty' : ''}`}
            >
              <div className="section-head">
                <span className="section-rail" />
                <h3>{group.status}</h3>
                <span className="section-count">{group.jobs.length}</span>
              </div>
              <div className={`status-window-body ${group.jobs.length >= 3 ? 'status-window-scroll' : ''}`}>
                {isEmpty ? (
                  <div className="status-window-none">None</div>
                ) : (
                  <div className="planner-stack">
                    {group.jobs.map((j) => (
                      <CompactCard key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
