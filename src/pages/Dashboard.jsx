import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/UI'
import {
  HIDDEN_FROM_DASHBOARD,
  ACTIVE_STATUS_ORDER,
} from '../lib/constants'
import { formatDate } from '../lib/time'

function JobCard({ job, flag, showTasksFor }) {
  const myOpenTasks = showTasksFor
    ? (job.tasks || []).filter((t) => t.assigned_user_id === showTasksFor && !t.done)
    : []
  return (
    <Link to={`/job/${job.id}`} className={`job-card ${flag ? 'flag-' + flag : ''}`}>
      <div className="badges" style={{ marginBottom: 8 }}>
        <StatusBadge status={job.status} />
        {job.needs_attention && <span className="badge chip-attention">⚠ Needs Attention</span>}
        {job.high_priority && <span className="badge chip-priority">★ High Priority</span>}
        <span className="badge badge-soft">{job.job_type}</span>
      </div>
      <div className="job-title">
        {job.street_address}{job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {job.unit}</span> : null}
      </div>
      <div className="job-meta">
        {job.management_company && <span>🏢 {job.management_company}</span>}
        {job.main_tech && <span>🔧 {job.main_tech}</span>}
        {job.start_date && <span>📅 {formatDate(job.start_date)}{job.end_date ? ` – ${formatDate(job.end_date)}` : ''}</span>}
      </div>
      {myOpenTasks.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {myOpenTasks.map((t) => (
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

function Section({ railClass, title, count, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className={`section-rail ${railClass}`} />
        <h2>{title}</h2>
        <span className="section-count">{count}</span>
      </div>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const { jobs, loading, error } = useData()
  const { user } = useAuth()

  if (loading) return <div className="empty">Loading jobs…</div>
  if (error) return <div className="empty" style={{ color: 'var(--attention)' }}>{error}</div>

  const active = jobs.filter((j) => !HIDDEN_FROM_DASHBOARD.includes(j.status))

  // (a) Jobs with an open task assigned to me.
  const myJobs = active.filter((j) =>
    (j.tasks || []).some((t) => t.assigned_user_id === user.id && !t.done)
  )
  // Sort: jobs that are ALSO high priority float to the top of my list.
  myJobs.sort((a, b) => Number(b.high_priority) - Number(a.high_priority))
  const myJobIds = new Set(myJobs.map((j) => j.id))

  // (b) Needs Attention (not already shown under my tasks).
  const attention = active.filter((j) => j.needs_attention && !myJobIds.has(j.id))
  const attentionIds = new Set(attention.map((j) => j.id))

  // (c) High Priority (not already shown above).
  const priority = active.filter(
    (j) => j.high_priority && !myJobIds.has(j.id) && !attentionIds.has(j.id)
  )
  const priorityIds = new Set(priority.map((j) => j.id))

  const shownTop = new Set([...myJobIds, ...attentionIds, ...priorityIds])

  // Remaining active jobs grouped by status (in canonical order).
  const rest = active.filter((j) => !shownTop.has(j.id))
  const byStatus = ACTIVE_STATUS_ORDER.map((status) => ({
    status,
    jobs: rest.filter((j) => j.status === status),
  })).filter((g) => g.jobs.length > 0)

  const nothing = active.length === 0

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="hint">Hi {user.name?.split(' ')[0] || user.name} — here's what needs you.</div>
        </div>
        <Link to="/new" className="btn btn-accent desktop-nav">+ New Job</Link>
      </div>

      {nothing && <div className="empty">No active jobs yet. Tap “New Job” to add the first one.</div>}

      {myJobs.length > 0 && (
        <Section railClass="rail-mine" title="My Tasks" count={myJobs.length}>
          <div className="job-grid">
            {myJobs.map((j) => (
              <JobCard key={j.id} job={j} flag="mine" showTasksFor={user.id} />
            ))}
          </div>
        </Section>
      )}

      {attention.length > 0 && (
        <Section railClass="rail-attention" title="Needs Attention" count={attention.length}>
          <div className="job-grid">
            {attention.map((j) => (
              <JobCard key={j.id} job={j} flag="attention" />
            ))}
          </div>
        </Section>
      )}

      {priority.length > 0 && (
        <Section railClass="rail-priority" title="High Priority" count={priority.length}>
          <div className="job-grid">
            {priority.map((j) => (
              <JobCard key={j.id} job={j} flag="priority" />
            ))}
          </div>
        </Section>
      )}

      {byStatus.map((group) => (
        <Section key={group.status} railClass="" title={group.status} count={group.jobs.length}>
          <div className="job-grid two">
            {group.jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </Section>
      ))}
    </>
  )
}
