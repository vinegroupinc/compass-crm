import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { KIND_LABELS, KIND_CATEGORIES, logActivity } from '../lib/activityLog'
import { formatTimestamp } from '../lib/time'
import { Modal } from '../components/UI'
import { isAdmin, setAdmin } from './AdminLogin'

// Icon per kind for the activity rows
const KIND_ICONS = {
  job_created:        '🏗️',
  job_status_changed: '🔄',
  job_deleted:        '🗑️',
  job_closed:         '✅',
  task_created:       '📌',
  task_completed:     '☑️',
  attention_set:      '🚨',
  attention_cleared:  '🟢',
  contact_created:    '👤',
  contact_updated:    '✏️',
  contact_deleted:    '🗑️',
  costing_updated:    '💰',
  login:              '🔑',
  logout:             '👋',
}

const PAGE_SIZE = 100  // load this many at a time

export default function Admin() {
  const navigate = useNavigate()
  const { jobs, refresh } = useData()
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [showMore, setShowMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // ── Job management section state ──
  const [jobSearch, setJobSearch] = useState('')
  const [deletingJob, setDeletingJob] = useState(null) // the job pending delete confirm
  const [jobBusy, setJobBusy] = useState(false)

  // Guard: must be admin
  useEffect(() => {
    if (!isAdmin()) navigate('/admin/login')
  }, [navigate])

  async function load(limit = PAGE_SIZE) {
    try {
      setError('')
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit + 1) // fetch one extra to know if more exist
      if (error) throw error
      const rows = data || []
      setHasMore(rows.length > limit)
      setEntries(rows.slice(0, limit))
    } catch (e) {
      setError(e?.message || 'Could not load activity log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(PAGE_SIZE) }, [])

  function signOutAdmin() {
    setAdmin(false)
    navigate('/')
  }

  // Unique actor list for the user filter dropdown
  const actors = useMemo(() => {
    const seen = new Map()
    for (const e of entries) {
      if (e.actor_id && e.actor_name && !seen.has(e.actor_id)) {
        seen.set(e.actor_id, e.actor_name)
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  // Apply category + actor filters
  const filtered = useMemo(() => {
    const cat = KIND_CATEGORIES.find((c) => c.id === category)
    return entries.filter((e) => {
      if (cat?.kinds && !cat.kinds.includes(e.kind)) return false
      if (actorFilter !== 'all' && e.actor_id !== actorFilter) return false
      return true
    })
  }, [entries, category, actorFilter])

  // ── Job management: filter visible jobs by search query ──
  const jobMatches = useMemo(() => {
    const q = jobSearch.trim().toLowerCase()
    if (!q) return []
    const numericQ = q.startsWith('c') ? q.slice(1) : q
    return jobs.filter((j) => {
      if (j.job_number && String(j.job_number) === numericQ) return true
      const addr = (j.street_address || '').toLowerCase()
      const unit = (j.unit || '').toLowerCase()
      const mc = (j.management_company || '').toLowerCase()
      return addr.includes(q) || unit.includes(q) || mc.includes(q)
    }).slice(0, 25)
  }, [jobs, jobSearch])

  async function confirmDeleteJob() {
    if (!deletingJob) return
    setJobBusy(true)
    try {
      // Permanent delete (the prior soft-delete still soft-deleted via
      // updated_at; here we want a real, full-removal since this is admin).
      const { error } = await supabase.from('jobs').delete().eq('id', deletingJob.id)
      if (error) throw error
      logActivity({
        kind: 'job_deleted',
        actor: user,
        targetKind: 'job',
        targetId: deletingJob.id,
        targetLabel: `${deletingJob.street_address}${deletingJob.unit ? ' · Unit ' + deletingJob.unit : ''}`,
        note: `Job ID #C${deletingJob.job_number} deleted by admin`,
      })
      setDeletingJob(null)
      setJobSearch('')
      await refresh()
      await load(PAGE_SIZE)  // refresh the activity log so the deletion shows up
    } catch (e) {
      setError(e?.message || 'Could not delete job')
    } finally {
      setJobBusy(false)
    }
  }

  if (loading) return <div className="empty">Loading activity log…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <div className="hint">Activity log. Owner-visible only.</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={signOutAdmin}>Exit admin</button>
      </div>

      {error && (
        <div className="empty" style={{ color: 'var(--attention)' }}>{error}</div>
      )}

      {/* ── Job management ── */}
      <section className="admin-section">
        <h2 style={{ fontSize: 17, marginBottom: 6 }}>Job management</h2>
        <div className="hint" style={{ marginBottom: 10 }}>
          Search by Job ID, address, or client. Delete is permanent.
        </div>
        <input
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
          placeholder="e.g. C100147 or 1531 W 84th"
        />
        {jobSearch.trim() && (
          <div className="admin-job-results">
            {jobMatches.length === 0 && (
              <div className="hint" style={{ padding: 12 }}>No jobs match.</div>
            )}
            {jobMatches.map((j) => (
              <div key={j.id} className="admin-job-row">
                <Link to={`/job/${j.id}`} className="admin-job-info">
                  <div className="admin-job-id">#C{j.job_number}</div>
                  <div className="admin-job-addr">
                    {j.street_address}{j.unit ? ` · Unit ${j.unit}` : ''}
                  </div>
                  <div className="hint" style={{ fontSize: 12 }}>
                    {j.status} · {j.job_type}
                    {j.management_company ? ` · ${j.management_company}` : ''}
                  </div>
                </Link>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setDeletingJob(j)}
                >Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="admin-divider" />
      <h2 style={{ fontSize: 17, marginBottom: 10 }}>Activity log</h2>
      {/* Category pills */}
      <div className="admin-cats">
        {KIND_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`admin-cat ${category === c.id ? 'on' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* User filter + count */}
      <div className="admin-controls">
        <div>
          <label style={{ marginTop: 0 }}>Filter by user</label>
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
            <option value="all">All users</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="hint" style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
          {filtered.length} event{filtered.length === 1 ? '' : 's'} shown
          {entries.length !== filtered.length && ` (of ${entries.length} loaded)`}
        </div>
      </div>

      {/* Log */}
      <div className="admin-log">
        {filtered.length === 0 && (
          <div className="hint" style={{ padding: 18 }}>Nothing matches the current filters.</div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="admin-log-row">
            <span className="admin-log-icon">{KIND_ICONS[e.kind] || '•'}</span>
            <div className="admin-log-body">
              <div className="admin-log-head">
                <span className="admin-log-kind">{KIND_LABELS[e.kind] || e.kind}</span>
                <span className="admin-log-time">{formatTimestamp(e.created_at)}</span>
              </div>
              <div className="admin-log-meta">
                <strong>{e.actor_name || 'System'}</strong>
                {e.target_label && <> · {
                  e.target_kind === 'job' && e.target_id
                    ? <Link to={`/job/${e.target_id}`} style={{ color: 'var(--accent)' }}>{e.target_label}</Link>
                    : e.target_label
                }</>}
              </div>
              {e.note && (
                <div className="admin-log-note">{e.note}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && !showMore && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setShowMore(true); load(PAGE_SIZE * 5) }}
          >
            Load more (showing latest {PAGE_SIZE})
          </button>
        </div>
      )}

      {deletingJob && (
        <Modal onClose={() => !jobBusy && setDeletingJob(null)}>
          <h3>Delete this job?</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6 }}>
            <strong>Job ID #C{deletingJob.job_number}</strong><br />
            {deletingJob.street_address}{deletingJob.unit ? ` · Unit ${deletingJob.unit}` : ''}
          </p>
          <p style={{ color: 'var(--attention)', fontSize: 13, marginTop: 10 }}>
            This is permanent. All notes, tasks, and scheduled events on this
            job will be removed too.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-danger btn-block"
              onClick={confirmDeleteJob}
              disabled={jobBusy}
            >{jobBusy ? 'Deleting…' : 'Yes, delete permanently'}</button>
            <button
              className="btn btn-ghost"
              onClick={() => setDeletingJob(null)}
              disabled={jobBusy}
            >Cancel</button>
          </div>
        </Modal>
      )}
    </>
  )
}
