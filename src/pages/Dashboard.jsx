import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/UI'
import {
  HIDDEN_FROM_DASHBOARD,
  ACTIVE_STATUS_ORDER,
} from '../lib/constants'
import { formatDate, laToday } from '../lib/time'

// Full job card used in the status sections — keeps all metadata.
function JobCard({ job, flag }) {
  return (
    <Link to={`/job/${job.id}`} className={`job-card ${flag ? 'flag-' + flag : ''}`}>
      <div className="badges" style={{ marginBottom: 8 }}>
        <StatusBadge status={job.status} />
        {job.needs_attention && <span className="badge chip-attention">⚠ Needs Attention</span>}
        <span className="badge badge-soft">{job.job_type}</span>
      </div>
      <div className="job-title">
        {job.street_address}{job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {job.unit}</span> : null}
      </div>
      <div className="job-meta">
        {job.management_company && <span>🏢 {job.management_company}</span>}
        {(() => {
          const tech = (job.main_techs && job.main_techs.length > 0) ? job.main_techs.join(', ') : job.main_tech
          return tech ? <span>🔧 {tech}</span> : null
        })()}
        {job.start_date && <span>📅 {formatDate(job.start_date)}{job.end_date ? ` – ${formatDate(job.end_date)}` : ''}</span>}
      </div>
    </Link>
  )
}

// Compact card used inside the Planner column. Drops mgmt/tech/dates;
// shows only status, type, address, and the assigned task(s).
function PlannerCard({ job, userId }) {
  const today = laToday()
  const tasks = (job.tasks || []).filter(
    (t) => t.assigned_user_id === userId && !t.done && (!t.due_date || t.due_date <= today)
  )
  return (
    <Link to={`/job/${job.id}`} className="job-card job-card-compact flag-mine">
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

function Section({ railClass, title, count, scroll, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className={`section-rail ${railClass}`} />
        <h2>{title}</h2>
        <span className="section-count">{count}</span>
      </div>
      <div className={scroll ? 'section-scroll' : ''}>
        {children}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const { jobs, loading, error } = useData()
  const { user } = useAuth()

  if (loading) return <div className="empty">Loading jobs…</div>
  if (error) return <div className="empty" style={{ color: 'var(--attention)' }}>{error}</div>

  const active = jobs.filter((j) => !HIDDEN_FROM_DASHBOARD.includes(j.status))
  const today = laToday()

  // A task is "due now" if it has no due date OR its due date is on/before today.
  const isDueNow = (t) => !t.due_date || t.due_date <= today

  // Planner: jobs with an open task assigned to me that's due now.
  const myJobs = active.filter((j) =>
    (j.tasks || []).some(
      (t) => t.assigned_user_id === user.id && !t.done && isDueNow(t)
    )
  )

  // Needs Attention: jobs flagged. (Independent of Planner — a job can appear
  // in both Planner and Needs Attention, and also still in its status group.)
  const attention = active.filter((j) => j.needs_attention)

  // Status groups now show EVERY active job in that status, including those
  // also in Planner / Needs Attention. No de-duplication.
  const byStatus = ACTIVE_STATUS_ORDER.map((status) => ({
    status,
    jobs: active.filter((j) => j.status === status),
  })).filter((g) => g.jobs.length > 0)

  const nothing = active.length === 0
  // Two-column top grid when BOTH Planner and Needs Attention have items
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

      {/* Top row: Planner + Needs Attention. Side-by-side when both have items,
          full-width when only one has items. */}
      {(myJobs.length > 0 || attention.length > 0) && (
        <div className={bothTop ? 'top-grid' : ''}>
          {myJobs.length > 0 && (
            <Section
              railClass="rail-mine"
              title="Planner"
              count={myJobs.length}
              scroll={myJobs.length >= 2}
            >
              <div className="planner-stack">
                {myJobs.map((j) => (
                  <PlannerCard key={j.id} job={j} userId={user.id} />
                ))}
              </div>
            </Section>
          )}

          {attention.length > 0 && (
            <Section
              railClass="rail-attention"
              title="Needs Attention"
              count={attention.length}
              scroll={attention.length >= 3}
            >
              <div className="job-grid">
                {attention.map((j) => (
                  <JobCard key={j.id} job={j} flag="attention" />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Status groups — each scrolls past 3 jobs. Jobs in Planner / Needs
          Attention also still appear here in their status. */}
      {byStatus.map((group) => (
        <Section
          key={group.status}
          railClass=""
          title={group.status}
          count={group.jobs.length}
          scroll={group.jobs.length >= 3}
        >
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
