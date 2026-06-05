import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { StatusBadge } from '../components/UI'
import { formatDate } from '../lib/time'
import { normalizeAddress } from '../lib/address'

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

  // Exact job-number match wins decisively. Accepts either "100147" or the
  // displayed "C100147" form (the C is purely a display prefix).
  if (job.job_number) {
    const numStr = String(job.job_number)
    const qStripped = q.startsWith('c') ? q.slice(1) : q
    if (qStripped === numStr) {
      return { score: 1000, matchedFields: ['job_number'] }
    }
  }

  function check(field, value) {
    if (!value) return
    if (lc(value).includes(q)) {
      score += FIELD_WEIGHTS[field] || 1
      matchedFields.push(field)
    }
  }
  check('street_address', job.street_address)
  check('unit', job.unit)
  check('management_company', job.management_company)
  check('unit_manager', job.unit_manager)
  check('main_tech', job.main_tech)
  if (job.main_techs && job.main_techs.length > 0) {
    check('main_tech', job.main_techs.join(' '))
  }
  check('subcontractors', job.subcontractors)
  if (job.subcontractor_names && job.subcontractor_names.length > 0) {
    check('subcontractors', job.subcontractor_names.join(' '))
  }
  check('job_type', job.job_type)
  check('status', job.status)
  check('access_info', job.access_info)
  check('crew_access', job.crew_access)
  for (const t of job.tasks || []) {
    if (lc(t.text).includes(q)) {
      score += FIELD_WEIGHTS.task_text
      if (!matchedFields.includes('task_text')) matchedFields.push('task_text')
    }
  }
  for (const n of job.notes || []) {
    if (lc(n.body).includes(q)) {
      score += FIELD_WEIGHTS.note_body
      if (!matchedFields.includes('note_body')) matchedFields.push('note_body')
    }
  }
  return { score, matchedFields }
}

const FIELD_LABELS = {
  job_number: 'job ID',
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
  // mode = 'jobs' (flat search across everything) | 'properties' (grouped by address)
  const [mode, setMode] = useState(params.get('mode') === 'properties' ? 'properties' : 'jobs')
  const [q, setQ] = useState(params.get('q') || '')

  // Keep URL in sync so search/mode is shareable / bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q); else next.delete('q')
    if (mode === 'properties') next.set('mode', 'properties'); else next.delete('mode')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode])

  if (loading) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head"><h1>Search</h1></div>

      {/* Mode toggle */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          className={`btn btn-sm ${mode === 'jobs' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setMode('jobs')}
        >
          Search Jobs
        </button>
        <button
          className={`btn btn-sm ${mode === 'properties' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setMode('properties')}
        >
          Search Properties
        </button>
      </div>

      {mode === 'jobs'
        ? <JobsSearch jobs={jobs} q={q} setQ={setQ} />
        : <PropertiesSearch jobs={jobs} q={q} setQ={setQ} />
      }
    </>
  )
}

/* --------------- jobs (cross-field flat search) -------------------------- */

function JobsSearch({ jobs, q, setQ }) {
  const results = useMemo(() => {
    if (!q.trim()) return []
    return jobs
      .map((j) => ({ job: j, ...scoreJob(j, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return new Date(b.job.created_at) - new Date(a.job.created_at)
      })
  }, [jobs, q])

  return (
    <>
      <input
        autoFocus
        placeholder="Address, Job ID (e.g. C100147), name, anything…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 18 }}
      />
      {!q.trim() && (
        <div className="hint" style={{ padding: '8px 4px 18px' }}>
          Search across every job — addresses, clients, managers, techs, subs,
          notes, access codes, tasks, and the notes log. Results are ranked by
          relevance and recency. Deleted jobs are excluded.
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
                  {job.job_number && <span>🆔 #C{job.job_number}</span>}
                  {job.management_company && <span>🏢 {job.management_company}</span>}
                  {(() => {
                    const tech = (job.main_techs && job.main_techs.length > 0) ? job.main_techs.join(', ') : job.main_tech
                    return tech ? <span>🔧 {tech}</span> : null
                  })()}
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

/* --------------- properties (grouped by normalized address) -------------- */

function PropertiesSearch({ jobs, q, setQ }) {
  // Group every non-deleted job by its normalized address key.
  // Each group displays as one property with its jobs underneath.
  const groups = useMemo(() => {
    const map = new Map()
    for (const j of jobs) {
      const key = normalizeAddress(j.street_address) || j.street_address || ''
      if (!key) continue
      if (!map.has(key)) {
        map.set(key, {
          key,
          // Use the most recent job's original address as the display label,
          // since that's likely the most polished version on file.
          displayAddress: j.street_address,
          mostRecent: new Date(j.created_at).getTime(),
          jobs: [],
        })
      }
      const g = map.get(key)
      g.jobs.push(j)
      const t = new Date(j.created_at).getTime()
      if (t > g.mostRecent) {
        g.mostRecent = t
        g.displayAddress = j.street_address
      }
    }
    let arr = Array.from(map.values())
    // Filter by address-only query if one is set
    if (q.trim()) {
      const qKey = normalizeAddress(q)
      const qLower = q.toLowerCase().trim()
      arr = arr.filter((g) =>
        g.key.includes(qKey) ||
        g.displayAddress.toLowerCase().includes(qLower)
      )
    }
    // Sort each group's jobs newest first
    for (const g of arr) {
      g.jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    // Sort groups by their most recent job (newest property activity first)
    arr.sort((a, b) => b.mostRecent - a.mostRecent)
    return arr
  }, [jobs, q])

  return (
    <>
      <input
        autoFocus
        placeholder="Search by address (e.g. 1531 W 84th)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 18 }}
      />
      {!q.trim() && (
        <div className="hint" style={{ padding: '8px 4px 18px' }}>
          Every property where a job has been created, grouped together.
          Matching ignores abbreviations (W = West, St = Street) and city/state/zip,
          so the same property always groups even if typed differently.
        </div>
      )}
      {q.trim() && groups.length === 0 && (
        <div className="empty">No properties match “{q}”.</div>
      )}
      {groups.length > 0 && (
        <>
          <div className="hint" style={{ marginBottom: 12 }}>
            {groups.length} propert{groups.length === 1 ? 'y' : 'ies'}
          </div>
          {groups.map((g) => (
            <div key={g.key} className="card-pad" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, marginBottom: 4 }}>{g.displayAddress}</h2>
              <div className="hint" style={{ marginBottom: 10 }}>
                {g.jobs.length} job{g.jobs.length === 1 ? '' : 's'} at this property
              </div>
              {g.jobs.map((j) => (
                <Link
                  key={j.id}
                  to={`/job/${j.id}`}
                  className="list-item"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="name">
                    {j.unit ? `Unit ${j.unit} · ` : ''}{j.job_type}
                    <div className="hint">
                      {j.start_date ? formatDate(j.start_date) : 'No date'}
                      {j.management_company ? ` · ${j.management_company}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={j.status} />
                </Link>
              ))}
            </div>
          ))}
        </>
      )}
    </>
  )
}
