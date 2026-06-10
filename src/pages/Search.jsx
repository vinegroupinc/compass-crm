import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { StatusBadge } from '../components/UI'
import { formatDate, formatTimestamp } from '../lib/time'
import { normalizeAddress } from '../lib/address'
import { supabase } from '../lib/supabaseClient'
import * as db from '../lib/db'
import { STATUSES } from '../lib/constants'

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
  // mode = 'jobs' | 'properties' | 'costing'
  const initialMode = ['properties', 'costing'].includes(params.get('mode'))
    ? params.get('mode') : 'jobs'
  const [mode, setMode] = useState(initialMode)
  const [q, setQ] = useState(params.get('q') || '')

  // Keep URL in sync so search/mode is shareable / bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q); else next.delete('q')
    if (mode === 'jobs') next.delete('mode'); else next.set('mode', mode)
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode])

  if (loading) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head"><h1>Search</h1></div>

      {/* Mode toggle */}
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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
        <button
          className={`btn btn-sm ${mode === 'costing' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setMode('costing')}
        >
          Search Job Costing
        </button>
      </div>

      {mode === 'jobs' && <JobsSearch jobs={jobs} q={q} setQ={setQ} />}
      {mode === 'properties' && <PropertiesSearch jobs={jobs} q={q} setQ={setQ} />}
      {mode === 'costing' && <CostingSearch jobs={jobs} />}
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

/* --------------- costing search (financial search hub) -------------------- */

function money(n) {
  if (n == null || isNaN(n)) return '$0.00'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// Sum line items + change orders for a costing row → total cost
function totalCostOf(c) {
  if (!c) return 0
  const sum = (arr) => (arr || []).reduce((s, it) => s + (Number(it.amount) || 0), 0)
  return sum(c.materials) + sum(c.subs) + sum(c.labor) + sum(c.change_orders)
}

const STATUS_FILTERABLE = STATUSES.filter((s) => s !== 'New Lead') // dropping noise

function CostingSearch({ jobs }) {
  // Costing data — load on mount
  const [costingRows, setCostingRows] = useState([])
  const [loadingCosting, setLoadingCosting] = useState(true)
  // Status-change events from activity log
  const [statusChanges, setStatusChanges] = useState([])
  const [loadingChanges, setLoadingChanges] = useState(true)

  // ── Filter UI state ──
  const [preset, setPreset] = useState('30')      // '7' | '30' | '90' | 'custom' | 'any'
  const [from, setFrom] = useState('')             // YYYY-MM-DD
  const [to, setTo] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState([])  // multi-select; empty = no status filter
  const [minProfit, setMinProfit] = useState('')
  const [maxProfit, setMaxProfit] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [textQ, setTextQ] = useState('')

  // Compute effective from/to from preset
  const dateRange = useMemo(() => {
    const today = new Date()
    if (preset === 'custom') {
      return {
        from: from || null,
        to: to || null,
      }
    }
    if (preset === 'any') return { from: null, to: null }
    const days = Number(preset) || 30
    const start = new Date(today)
    start.setDate(today.getDate() - days)
    return {
      from: start.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    }
  }, [preset, from, to])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await db.getAllJobCosting()
        if (!cancelled) setCostingRows(rows)
      } catch {
        if (!cancelled) setCostingRows([])
      } finally {
        if (!cancelled) setLoadingCosting(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Pull status-change events. We get a wide net then filter client-side
        // because status events are low-volume relative to other log entries.
        const { data, error } = await supabase
          .from('activity_log')
          .select('id, kind, target_id, payload, note, created_at, actor_name')
          .in('kind', ['job_status_changed', 'job_closed', 'job_created'])
          .order('created_at', { ascending: false })
          .limit(2000)
        if (error) throw error
        if (!cancelled) setStatusChanges(data || [])
      } catch {
        if (!cancelled) setStatusChanges([])
      } finally {
        if (!cancelled) setLoadingChanges(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Costing keyed by job id for fast lookups
  const costingByJob = useMemo(() => {
    const m = new Map()
    for (const c of costingRows) m.set(c.job_id, c)
    return m
  }, [costingRows])

  function toggleStatus(s) {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  // Build the list of matching jobs by combining all filters.
  const results = useMemo(() => {
    const lcQ = textQ.trim().toLowerCase()
    const fromTs = dateRange.from ? new Date(dateRange.from + 'T00:00:00').getTime() : null
    const toTs   = dateRange.to   ? new Date(dateRange.to   + 'T23:59:59').getTime() : null

    // Step 1: if status filters or date range are active, find job IDs that
    // had a matching status-change event in the window.
    let jobsByStatusEvent = null
    const useEventFilter = selectedStatuses.length > 0 || fromTs != null || toTs != null
    if (useEventFilter) {
      jobsByStatusEvent = new Map()  // jobId → array of matching events
      for (const ev of statusChanges) {
        const ts = new Date(ev.created_at).getTime()
        if (fromTs != null && ts < fromTs) continue
        if (toTs   != null && ts > toTs)   continue
        // Determine the target status of this event
        const targetStatus =
          ev.kind === 'job_status_changed' ? (ev.payload?.to || null)
          : ev.kind === 'job_closed' ? (ev.payload?.final_status || 'Closed')
          : ev.kind === 'job_created' ? (ev.payload?.status || null)
          : null
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(targetStatus)) continue
        if (!jobsByStatusEvent.has(ev.target_id)) jobsByStatusEvent.set(ev.target_id, [])
        jobsByStatusEvent.get(ev.target_id).push({ ...ev, targetStatus })
      }
    }

    // Step 2: walk jobs and apply all filters
    const out = []
    for (const j of jobs) {
      // Optional event filter
      if (useEventFilter && !jobsByStatusEvent.has(j.id)) continue

      // Text filter (address, unit, client, job id)
      if (lcQ) {
        const numQ = lcQ.startsWith('c') ? lcQ.slice(1) : lcQ
        const matchId   = j.job_number && String(j.job_number) === numQ
        const matchText = ((j.street_address || '') + ' ' + (j.unit || '') + ' ' + (j.management_company || '')).toLowerCase().includes(lcQ)
        if (!matchId && !matchText) continue
      }

      const costing = costingByJob.get(j.id)
      const cost = totalCostOf(costing)
      const invoice = Number(costing?.invoice) || 0
      const profit = invoice - cost
      const hasCosting = !!costing && (
        invoice > 0 ||
        (costing.materials || []).length > 0 ||
        (costing.subs || []).length > 0 ||
        (costing.labor || []).length > 0
      )

      if (missingOnly && hasCosting) continue
      if (!missingOnly) {
        if (minProfit !== '' && (profit < Number(minProfit) || !hasCosting)) continue
        if (maxProfit !== '' && (profit > Number(maxProfit) || !hasCosting)) continue
      }

      out.push({
        job: j,
        costing,
        cost,
        invoice,
        profit,
        hasCosting,
        events: useEventFilter ? jobsByStatusEvent.get(j.id) : null,
      })
    }

    // Sort: matching events first by most recent event; otherwise by profit desc
    out.sort((a, b) => {
      if (a.events && b.events) {
        const aT = Math.max(...a.events.map((e) => new Date(e.created_at).getTime()))
        const bT = Math.max(...b.events.map((e) => new Date(e.created_at).getTime()))
        return bT - aT
      }
      return b.profit - a.profit
    })
    return out
  }, [jobs, costingByJob, statusChanges, selectedStatuses, dateRange, textQ, minProfit, maxProfit, missingOnly])

  const totals = useMemo(() => {
    let invoice = 0, cost = 0, profit = 0, withCosting = 0
    for (const r of results) {
      if (r.hasCosting) {
        invoice += r.invoice
        cost += r.cost
        profit += r.profit
        withCosting += 1
      }
    }
    return { invoice, cost, profit, withCosting }
  }, [results])

  const loading = loadingCosting || loadingChanges

  return (
    <>
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Filters</h2>
        <div className="hint" style={{ marginBottom: 14 }}>
          Combine date range, status change, profit range, and text search. Leave any
          filter blank to ignore it.
        </div>

        <label>Date range</label>
        <div className="row row-wrap" style={{ gap: 8, marginBottom: 4 }}>
          {[
            ['7',      'Past 7 days'],
            ['30',     'Past 30 days'],
            ['90',     'Past 90 days'],
            ['any',    'Any time'],
            ['custom', 'Custom…'],
          ].map(([val, lbl]) => (
            <button
              key={val}
              className={`btn btn-sm ${preset === val ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setPreset(val)}
            >{lbl}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: 12 }}>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12 }}>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <label style={{ marginTop: 14 }}>Status change in window</label>
        <div className="row row-wrap" style={{ gap: 6 }}>
          {STATUS_FILTERABLE.map((s) => (
            <button
              key={s}
              className={`assignee-chip ${selectedStatuses.includes(s) ? 'on' : ''}`}
              onClick={() => toggleStatus(s)}
            >
              {selectedStatuses.includes(s) ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>
        <div className="hint" style={{ fontSize: 12, marginTop: 4 }}>
          {selectedStatuses.length === 0
            ? 'No status filter — any change counts.'
            : `Showing jobs that hit any of: ${selectedStatuses.join(', ')}`}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <div>
            <label>Min profit ($)</label>
            <input
              type="number"
              inputMode="decimal"
              value={minProfit}
              onChange={(e) => setMinProfit(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label>Max profit ($)</label>
            <input
              type="number"
              inputMode="decimal"
              value={maxProfit}
              onChange={(e) => setMaxProfit(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        <label className="row" style={{ marginTop: 12, marginBottom: 0, gap: 8, cursor: 'pointer', alignItems: 'center' }}>
          <input
            type="checkbox"
            style={{ width: 18, height: 18, minHeight: 'auto' }}
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
            Only show jobs with no costing yet
          </span>
        </label>

        <label style={{ marginTop: 14 }}>Search text (address, Job ID, client)</label>
        <input
          value={textQ}
          onChange={(e) => setTextQ(e.target.value)}
          placeholder="optional"
        />
      </div>

      {/* Roll-up summary */}
      {!loading && results.length > 0 && (
        <div className="costing-summary" style={{ marginBottom: 16 }}>
          <div className="costing-stat">
            <div className="costing-stat-label">Jobs matched</div>
            <div className="costing-stat-value strong">{results.length}</div>
          </div>
          <div className="costing-stat">
            <div className="costing-stat-label">Costing entered for</div>
            <div className="costing-stat-value strong">{totals.withCosting}</div>
          </div>
          <div className="costing-stat">
            <div className="costing-stat-label">Total invoiced</div>
            <div className="costing-stat-value strong">{money(totals.invoice)}</div>
          </div>
          <div className="costing-stat">
            <div className="costing-stat-label">Total cost</div>
            <div className="costing-stat-value strong">{money(totals.cost)}</div>
          </div>
          <div className="costing-stat">
            <div className="costing-stat-label">Total profit</div>
            <div className="costing-stat-value strong" style={{ color: totals.profit >= 0 ? '#16a34a' : '#dc2626' }}>
              {money(totals.profit)}
            </div>
          </div>
        </div>
      )}

      {loading && <div className="empty">Loading…</div>}

      {!loading && results.length === 0 && (
        <div className="empty">No jobs match these filters.</div>
      )}

      {!loading && results.map((r) => (
        <Link key={r.job.id} to={`/job/${r.job.id}/costing`} className="job-card" style={{ marginBottom: 10, display: 'block', textDecoration: 'none' }}>
          <div className="badges" style={{ marginBottom: 6 }}>
            <StatusBadge status={r.job.status} />
            {r.job.job_number && <span className="badge badge-soft">#C{r.job.job_number}</span>}
            <span className="badge badge-soft">{r.job.job_type}</span>
          </div>
          <div className="job-title">
            {r.job.street_address}{r.job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {r.job.unit}</span> : null}
          </div>
          <div className="job-meta" style={{ marginTop: 8 }}>
            {r.hasCosting ? (
              <>
                <span>💵 Invoice {money(r.invoice)}</span>
                <span>📦 Cost {money(r.cost)}</span>
                <span style={{ color: r.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  📈 Profit {money(r.profit)}
                </span>
              </>
            ) : (
              <span className="hint">No costing entered yet.</span>
            )}
          </div>
          {r.events && r.events.length > 0 && (
            <div className="hint" style={{ marginTop: 6, fontSize: 12 }}>
              {r.events.slice(0, 2).map((e, i) => (
                <span key={e.id || i}>
                  {i > 0 ? ' · ' : ''}
                  → {e.targetStatus} on {formatTimestamp(e.created_at)}
                </span>
              ))}
              {r.events.length > 2 && <span> · +{r.events.length - 2} more</span>}
            </div>
          )}
        </Link>
      ))}
    </>
  )
}
