import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { StatusBadge } from '../components/UI'
import { formatDate } from '../lib/time'

// Where each match counts toward relevance. Address/manager/tech get a heavier
// weight than incidental mentions in notes.
const FIELD_WEIGHTS = {
  street_address: 5,
  unit: 4,
  management_company: 4,
  unit_manager: 4,
  main_tech: 4,
  job_type: 2,
  status: 2,
  subcontractors: 3,
  access_info: 3,
  crew_access: 2,    // "notes" stored as crew_access
  task_text: 3,
  note_body: 2,
}

function lc(v) { return (v || '').toString().toLowerCase() }

function scoreJob(job, query) {
  const q = query.toLowerCase().trim()
  if (!q) return { score: 0, matchedFields: [] }
  let score = 0
  const matchedFields = []
  function check(field, value) {
    if (!value) return
    if (lc(value).includes(q)) {
      score += FIELD_WEIGHTS[field] || 1
      matchedFields.push(field)
    }
  }
  // Top-level job fields
  check('street_address', job.street_address)
  check('unit', job.unit)
  check('management_company', job.management_company)
  check('unit_manager', job.unit_manager)
  check('main_tech', job.main_tech)
  check('job_type', job.job_type)
  check('status', job.status)
  check('subcontractors', job.subcontractors)
  check('access_info', job.access_info)
  check('crew_access', job.crew_access)
  // Tasks (text only — assignee names are excluded per spec)
  for (const t of job.tasks || []) {
    if (lc(t.text).includes(q)) {
      score += FIELD_WEIGHTS.task_text
      if (!matchedFields.includes('task_text')) matchedFields.push('task_text')
    }
  }
  // Notes
  for (const n of job.notes || []) {
    if (lc(n.body).includes(q)) {
      score += FIELD_WEIGHTS.note_body
      if (!matchedFields.includes('note_body')) matchedFields.push('note_body')
    }
  }
  return { score, matchedFields }
}

const FIELD_LABELS = {
  street_address: 'address',
  unit: 'unit',
  management_company: 'client',
  unit_manager: 'manager',
  main_tech: 'tech',
  job_type: 'job type',
  status: 'status',
  subcontractors: 'subs',
  access_info: 'access info',
  crew_access: 'notes',
  task_text: 'task',
  note_body: 'notes log',
}

export default function Search() {
  const { jobs, loading } = useData()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || params.get('addr') || '')

  // Keep the URL in sync so the search is shareable / bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q); else next.delete('q')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const results = useMemo(() => {
    if (!q.trim()) return []
    return jobs
      .map((j) => ({ job: j, ...scoreJob(j, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => {
        // Primary: relevance score
        if (b.score !== a.score) return b.score - a.score
        // Tiebreak: newest first
        return new Date(b.job.created_at) - new Date(a.job.created_at)
      })
  }, [jobs, q])

  if (loading) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head"><h1>Search</h1></div>
      <input
        autoFocus
        placeholder="Address, name, lockbox code, anything…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 18 }}
      />
      {!q.trim() && (
        <div className="hint" style={{ padding: '8px 4px 18px' }}>
          Search across every job — addresses, clients, managers, techs, subs, notes,
          access codes, tasks, and the notes log. Results are ranked by relevance
          and recency. Deleted jobs are excluded.
        </div>
      )}
      {q.trim() && results.length === 0 && (
        <div className="empty">No jobs match “{q}”.</div>
      )}
      {results.length > 0 && (
        <>
          <div className="hint" style={{ marginBottom: 12 }}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </div>
          <div className="job-grid">
            {results.map(({ job, matchedFields }) => (
              <Link key={job.id} to={`/job/${job.id}`} className="job-card">
                <div className="badges" style={{ marginBottom: 8 }}>
                  <StatusBadge status={job.status} />
                  <span className="badge badge-soft">{job.job_type}</span>
                </div>
                <div className="job-title">
                  {job.street_address}
                  {job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {job.unit}</span> : null}
                </div>
                <div className="job-meta">
                  {job.management_company && <span>🏢 {job.management_company}</span>}
                  {job.main_tech && <span>🔧 {job.main_tech}</span>}
                  {job.start_date && <span>📅 {formatDate(job.start_date)}</span>}
                </div>
                {matchedFields.length > 0 && (
                  <div className="hint" style={{ marginTop: 8, fontSize: 11 }}>
                    matched in: {matchedFields.map((f) => FIELD_LABELS[f] || f).join(', ')}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
