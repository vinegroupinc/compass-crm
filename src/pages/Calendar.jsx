import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import * as db from '../lib/db'
import { Modal, StatusBadge, Toast } from '../components/UI'
import { laToday, formatDate, formatTime } from '../lib/time'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// All dates here are plain YYYY-MM-DD strings, never JS Date objects, to
// avoid timezone weirdness. Comparisons are string-lexicographic.
function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function partsFromYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}
function todayParts() { return partsFromYmd(laToday()) }
function isBetween(date, start, end) {
  if (!start) return false
  if (!end) return date === start
  return date >= start && date <= end
}
function shiftMonth(y, m, delta) {
  const total = y * 12 + m + delta
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
}

// Build a 6-row × 7-col grid of days for the visible month, with leading
// and trailing days from neighboring months greyed.
function monthCells(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDaysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  // leading days (prev month)
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevDaysInMonth - i
    const { y, m } = shiftMonth(year, month, -1)
    cells.push({ y, m, d, inMonth: false, ymd: ymd(y, m, d) })
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, inMonth: true, ymd: ymd(year, month, d) })
  }
  // trailing days (next month) to fill to 42 cells (6 rows)
  const need = 42 - cells.length
  for (let i = 1; i <= need; i++) {
    const { y, m } = shiftMonth(year, month, 1)
    cells.push({ y, m, d: i, inMonth: false, ymd: ymd(y, m, i) })
  }
  return cells
}

export default function CalendarPage() {
  const { jobs, events, refresh } = useData()
  const { user } = useAuth()
  const [{ y, m }, setView] = useState(() => {
    const { y, m } = todayParts()
    return { y, m }
  })
  const [selectedDate, setSelectedDate] = useState(null)
  const [toast, setToast] = useState('')
  const [addingForDate, setAddingForDate] = useState(null)

  const today = laToday()
  const tParts = todayParts()

  const cells = useMemo(() => monthCells(y, m), [y, m])

  // Bucket entries per day for fast lookup.
  // Each entry: { kind: 'job'|'event', sortKey, label, ...refs }
  const byDate = useMemo(() => {
    const map = new Map()
    function push(date, entry) {
      if (!map.has(date)) map.set(date, [])
      map.get(date).push(entry)
    }
    for (const job of jobs) {
      if (!job.start_date) continue
      const end = job.end_date || job.start_date
      // Iterate dates from start to end inclusive (small range, fine to enumerate)
      let cur = job.start_date
      // Safety cap so a bad date never freezes us
      let safety = 0
      while (cur && cur <= end && safety < 400) {
        push(cur, {
          kind: 'job',
          id: 'j-' + job.id + '-' + cur,
          sortKey: '1-' + cur, // jobs sort before events on the same day
          job,
        })
        const p = partsFromYmd(cur)
        const next = new Date(p.y, p.m, p.d + 1)
        cur = ymd(next.getFullYear(), next.getMonth(), next.getDate())
        safety++
      }
    }
    for (const ev of events) {
      // Standalone events (no job) still appear; tied events join their job
      const job = ev.job_id ? jobs.find((j) => j.id === ev.job_id) : null
      if (ev.job_id && !job) continue // job was deleted, skip
      push(ev.event_date, {
        kind: 'event',
        id: 'e-' + ev.id,
        sortKey: '2-' + (ev.event_time || '00:00:00'),
        event: ev,
        job,
      })
    }
    // Sort each day's entries
    for (const arr of map.values()) {
      arr.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    }
    return map
  }, [jobs, events])

  function go(delta) { const next = shiftMonth(y, m, delta); setView(next) }
  function goToday() { const t = todayParts(); setView({ y: t.y, m: t.m }) }

  async function createEvent({ jobId, title, eventDate, eventTime, noJob }) {
    if (!noJob && !jobId) { setToast('Pick a job, or check "not associated with a job"'); return }
    if (!title.trim()) { setToast('Give it a name'); return }
    if (!eventDate) { setToast('Pick a date'); return }
    try {
      await db.addScheduledEvent({
        jobId: noJob ? null : jobId,
        title, eventDate, eventTime,
        createdBy: user.id, createdByName: user.name,
      })
      await refresh()
      setAddingForDate(null)
      setToast('Event added')
      setTimeout(() => setToast(''), 1800)
    } catch (e) { setToast(e?.message || 'Could not add'); setTimeout(() => setToast(''), 2200) }
  }

  async function removeEvent(ev) {
    if (!confirm('Delete this event?')) return
    try {
      await db.deleteScheduledEvent(ev.id)
      await refresh()
      setToast('Event deleted')
      setTimeout(() => setToast(''), 1800)
    } catch (e) { setToast(e?.message || 'Could not delete'); setTimeout(() => setToast(''), 2200) }
  }

  const selectedItems = selectedDate ? (byDate.get(selectedDate) || []) : []

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <div className="hint">Tap a date to see everything happening that day. Tap “+ Event” to add a one-off entry.</div>
        </div>
      </div>

      {/* Month nav */}
      <div className="cal-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => go(-1)} aria-label="Previous month">←</button>
        <div className="cal-toolbar-title">{MONTH_NAMES[m]} {y}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => go(1)} aria-label="Next month">→</button>
        <button className="btn btn-ghost btn-sm cal-today-btn" onClick={goToday}>Today</button>
        <button className="btn btn-accent btn-sm" onClick={() => setAddingForDate(today)}>+ Event</button>
      </div>

      {/* Weekday header */}
      <div className="cal-grid cal-weekday-row">
        {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
      </div>

      {/* Month grid */}
      <div className="cal-grid">
        {cells.map((c) => {
          const items = byDate.get(c.ymd) || []
          const isToday = c.ymd === today
          return (
            <button
              key={c.ymd + (c.inMonth ? '-in' : '-out')}
              className={`cal-cell ${c.inMonth ? '' : 'cal-cell-out'} ${isToday ? 'cal-cell-today' : ''}`}
              onClick={() => setSelectedDate(c.ymd)}
            >
              <div className="cal-cell-head">
                <span className="cal-cell-day">{c.d}</span>
                {items.length > 0 && <span className="cal-cell-dot">{items.length}</span>}
              </div>
              <div className="cal-cell-items">
                {items.slice(0, 3).map((it) => (
                  it.kind === 'job' ? (
                    <span key={it.id} className="cal-chip cal-chip-job" title={`${it.job.status} · ${it.job.street_address}`}>
                      <span className="cal-chip-dot" style={{ background: statusColor(it.job.status) }} />
                      <span className="cal-chip-text">{it.job.street_address}</span>
                    </span>
                  ) : (
                    <span key={it.id} className="cal-chip cal-chip-event" title={`${formatTime(it.event.event_time) || ''} ${it.event.title}`}>
                      <span className="cal-chip-icon">🕐</span>
                      <span className="cal-chip-text">
                        {it.event.event_time ? formatTime(it.event.event_time) + ' · ' : ''}{it.event.title}
                      </span>
                    </span>
                  )
                ))}
                {items.length > 3 && (
                  <span className="cal-chip-more">+{items.length - 3} more</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Day expand modal */}
      {selectedDate && (
        <Modal onClose={() => setSelectedDate(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={{ margin: 0 }}>{formatDate(selectedDate)}</h3>
            <button
              className="btn btn-accent btn-sm"
              onClick={() => { setAddingForDate(selectedDate); setSelectedDate(null) }}
            >+ Event</button>
          </div>

          {selectedItems.length === 0 && (
            <div className="hint" style={{ marginTop: 12 }}>Nothing scheduled this day.</div>
          )}

          {selectedItems.map((it) => (
            it.kind === 'job' ? (
              <Link
                key={it.id}
                to={`/job/${it.job.id}`}
                onClick={() => setSelectedDate(null)}
                className="list-item"
                style={{ textDecoration: 'none', marginTop: 12 }}
              >
                <div className="name">
                  {it.job.street_address}{it.job.unit ? ` · Unit ${it.job.unit}` : ''}
                  <div className="hint" style={{ marginTop: 4 }}>
                    {it.job.job_type} ·{' '}
                    {it.job.start_date === it.job.end_date || !it.job.end_date
                      ? formatDate(it.job.start_date)
                      : `${formatDate(it.job.start_date)} – ${formatDate(it.job.end_date)}`}
                  </div>
                </div>
                <StatusBadge status={it.job.status} />
              </Link>
            ) : (
              <div key={it.id} className="list-item" style={{ marginTop: 12 }}>
                <div className="name">
                  {it.event.event_time ? formatTime(it.event.event_time) + ' · ' : ''}{it.event.title}
                  {it.job && (
                    <div className="hint" style={{ marginTop: 4 }}>
                      <Link
                        to={`/job/${it.job.id}`}
                        onClick={() => setSelectedDate(null)}
                        style={{ color: 'var(--accent)' }}
                      >
                        {it.job.street_address}{it.job.unit ? ` · Unit ${it.job.unit}` : ''}
                      </Link>
                    </div>
                  )}
                  {!it.job && (
                    <div className="hint" style={{ marginTop: 4 }}>Standalone event</div>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeEvent(it.event)}
                  title="Delete event"
                >✕</button>
              </div>
            )
          ))}
        </Modal>
      )}

      {/* Add-event modal */}
      {addingForDate && (
        <EventComposer
          initialDate={addingForDate}
          jobs={jobs}
          onClose={() => setAddingForDate(null)}
          onSave={createEvent}
        />
      )}

      <Toast message={toast} />
    </>
  )
}

// Map status name → color, for the chip dot. Keeps in sync with badge colors.
function statusColor(status) {
  // Lazy import to avoid circular CSS-vars resolve
  const map = {
    'New Lead':        '#2563eb',
    'Estimating':      '#0891b2',
    'Estimate Sent':   '#0d9488',
    'Approved':        '#16a34a',
    'Scheduled':       '#65a30d',
    'In Progress':     '#ca8a04',
    'Punch List':      '#ea580c',
    'Final Walk':      '#db2777',
    'Billed':          '#7c3aed',
    'Closed':          '#475569',
    'On Hold':         '#9ca3af',
  }
  return map[status] || '#6b7280'
}

function EventComposer({ initialDate, jobs, onClose, onSave }) {
  const [jobId, setJobId] = useState('')
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState(initialDate)
  const [eventTime, setEventTime] = useState('')
  const [noJob, setNoJob] = useState(false)
  const activeJobs = jobs.filter((j) => !['Billed','Closed'].includes(j.status))

  return (
    <Modal onClose={onClose}>
      <h3>New calendar event</h3>
      <div className="hint" style={{ marginTop: 4, marginBottom: 14 }}>
        A one-off entry that shows on the calendar.
      </div>
      <label>Job</label>
      <select
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        disabled={noJob}
        style={noJob ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        <option value="">— Pick a job —</option>
        {activeJobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.street_address}{j.unit ? ` · Unit ${j.unit}` : ''} ({j.status})
          </option>
        ))}
      </select>
      <label className="row" style={{ marginTop: 8, marginBottom: 0, gap: 8, cursor: 'pointer', alignItems: 'center' }}>
        <input
          type="checkbox"
          style={{ width: 18, height: 18, minHeight: 'auto' }}
          checked={noJob}
          onChange={(e) => { setNoJob(e.target.checked); if (e.target.checked) setJobId('') }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
          This event is not associated with a job
        </span>
      </label>
      <label style={{ marginTop: 12 }}>Title / what's happening</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reglaze" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <label>Date</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div>
          <label>Start time (optional)</label>
          <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="btn btn-accent btn-block"
          onClick={() => onSave({ jobId, title, eventDate, eventTime, noJob })}
        >Save event</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
