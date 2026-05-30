import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/UI'
import {
  HIDDEN_FROM_DASHBOARD,
  ACTIVE_STATUS_ORDER,
} from '../lib/constants'
import { laToday, formatDate } from '../lib/time'

// True if the user is one of the task's assignees (handles both new
// multi-assignee array and the legacy single-assignee column).
function isAssignedTo(task, userId) {
  if (task.assigned_user_ids && task.assigned_user_ids.length > 0) {
    return task.assigned_user_ids.includes(userId)
  }
  return task.assigned_user_id === userId
}

// Compact card used everywhere on the dashboard. Drops mgmt/tech/dates;
// shows status pill, job type, address, and (optionally) tasks assigned to
// the current user. Used in Planner, Needs Attention, and every status window.
function CompactCard({ job, flag, userId }) {
  const today = laToday()
  const tasks = userId
    ? (job.tasks || []).filter(
        (t) => isAssignedTo(t, userId) && !t.done && (!t.due_date || t.due_date <= today)
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

// A single task row in the Planner. Click → opens the job. Future tasks are
// greyed but still clickable so the user can jump in and edit context.
function PlannerTaskRow({ task, job, bucket }) {
  const dueLabel = task.due_date
    ? (bucket === 'today' ? 'Today' : formatDate(task.due_date))
    : 'No date'
  return (
    <Link to={`/job/${job.id}`} className={`planner-task-row planner-task-${bucket}`}>
      <div className="planner-task-row-text">{task.text}</div>
      <div className="planner-task-row-meta">
        <span className="planner-task-row-addr">
          {job.street_address}{job.unit ? ` · Unit ${job.unit}` : ''}
        </span>
        <span className="planner-task-row-due">
          {bucket === 'overdue' && '⚠ '}
          {dueLabel}
        </span>
      </div>
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

  // Build the planner list: every open task assigned to me, across all jobs.
  // Bucketed into overdue, today, and future. Each bucket sorted by date.
  const myOpenTasks = []
  for (const j of active) {
    for (const t of (j.tasks || [])) {
      if (!t.done && isAssignedTo(t, user.id)) {
        myOpenTasks.push({ task: t, job: j })
      }
    }
  }
  const overdueTasks = myOpenTasks
    .filter((x) => x.task.due_date && x.task.due_date < today)
    .sort((a, b) => a.task.due_date.localeCompare(b.task.due_date))
  const todayTasks = myOpenTasks
    .filter((x) => !x.task.due_date || x.task.due_date === today)
  const futureTasks = myOpenTasks
    .filter((x) => x.task.due_date && x.task.due_date > today)
    .sort((a, b) => a.task.due_date.localeCompare(b.task.due_date))
  const totalPlanner = overdueTasks.length + todayTasks.length + futureTasks.length

  // Needs Attention: jobs flagged as such. Always render the window.
  const attention = active.filter((j) => j.needs_attention)

  // Every active status, always shown — even empty ones — so the dashboard
  // layout is consistent day-to-day. Sort: non-empty first.
  const byStatus = ACTIVE_STATUS_ORDER
    .map((status) => ({
      status,
      jobs: active.filter((j) => j.status === status),
    }))
    .sort((a, b) => {
      const aEmpty = a.jobs.length === 0 ? 1 : 0
      const bEmpty = b.jobs.length === 0 ? 1 : 0
      return aEmpty - bEmpty
    })

  const nothing = active.length === 0
  const plannerScrolls = totalPlanner >= 4
  const attentionScrolls = attention.length >= 3

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

      {/* PLANNER SECTION — always shown, two windows side-by-side */}
      <section className="planner-section">
        <div className="section-head">
          <span className="section-rail rail-mine" />
          <h2>Planner</h2>
        </div>

        <div className="planner-grid">
          {/* My tasks window */}
          <div className="planner-window">
            <div className={`planner-window-body ${plannerScrolls ? 'planner-window-scroll' : ''}`}>
              {totalPlanner === 0 ? (
                <div className="hint" style={{ padding: '6px 4px' }}>Nothing to show here…</div>
              ) : (
                <>
                  {overdueTasks.length > 0 && (
                    <>
                      <div className="planner-group-label planner-group-overdue">Overdue</div>
                      <div className="planner-stack">
                        {overdueTasks.map(({ task, job }) => (
                          <PlannerTaskRow key={task.id} task={task} job={job} bucket="overdue" />
                        ))}
                      </div>
                    </>
                  )}
                  {todayTasks.length > 0 && (
                    <>
                      <div className="planner-group-label" style={{ marginTop: overdueTasks.length > 0 ? 14 : 0 }}>Today</div>
                      <div className="planner-stack">
                        {todayTasks.map(({ task, job }) => (
                          <PlannerTaskRow key={task.id} task={task} job={job} bucket="today" />
                        ))}
                      </div>
                    </>
                  )}
                  {futureTasks.length > 0 && (
                    <>
                      <div className="planner-group-label" style={{ marginTop: (overdueTasks.length + todayTasks.length) > 0 ? 14 : 0 }}>Upcoming</div>
                      <div className="planner-stack">
                        {futureTasks.map(({ task, job }) => (
                          <PlannerTaskRow key={task.id} task={task} job={job} bucket="future" />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Needs Attention window — always shown */}
          <div className="planner-window attention-window">
            <div className="attention-banner">
              <span className="attention-banner-icon">🚨</span>
              <span>Items that need immediate attention</span>
            </div>
            <div className={`planner-window-body ${attentionScrolls ? 'planner-window-scroll' : ''}`}>
              {attention.length === 0 ? (
                <div className="hint" style={{ padding: '6px 4px' }}>Nothing to show here…</div>
              ) : (
                <div className="planner-stack">
                  {attention.map((j) => (
                    <CompactCard key={j.id} job={j} flag="attention" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

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
