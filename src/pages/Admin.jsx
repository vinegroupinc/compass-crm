import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { KIND_LABELS, KIND_CATEGORIES } from '../lib/activityLog'
import { formatTimestamp } from '../lib/time'
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
  login:              '🔑',
  logout:             '👋',
}

const PAGE_SIZE = 100  // load this many at a time

export default function Admin() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [showMore, setShowMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

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
    </>
  )
}
