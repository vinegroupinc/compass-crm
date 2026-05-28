import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { STATUS_COLORS, HIDDEN_FROM_DASHBOARD } from '../lib/constants'
import { laToday, parseISODate, addDays, formatDate, daysBetween } from '../lib/time'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function jobCoversDay(job, isoDay) {
  if (!job.start_date) return false
  const start = job.start_date
  const end = job.end_date || job.start_date
  return isoDay >= start && isoDay <= end
}

export default function Calendar() {
  const { jobs, loading } = useData()
  const today = laToday()
  const [view, setView] = useState('month') // 'month' | 'gantt'

  const scheduled = jobs.filter(
    (j) => j.start_date && !HIDDEN_FROM_DASHBOARD.includes(j.status)
  )

  // Build a 30-day window starting today (LA).
  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < 30; i++) arr.push(addDays(today, i))
    return arr
  }, [today])

  // Pad the month grid to start on the correct weekday.
  const firstDow = parseISODate(days[0]).getUTCDay()
  const padded = [...Array(firstDow).fill(null), ...days]

  if (loading) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <div className="hint">Next 30 days · {formatDate(today)} (LA)</div>
        </div>
        <div className="nav">
          <a className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>30-Day</a>
          <a className={view === 'gantt' ? 'active' : ''} onClick={() => setView('gantt')}>Gantt</a>
        </div>
      </div>

      {view === 'month' && (
        <div className="card-pad">
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid">
            {padded.map((iso, idx) => {
              if (!iso) return <div key={`pad-${idx}`} className="cal-cell dim" />
              const dayJobs = scheduled.filter((j) => jobCoversDay(j, iso))
              const dnum = parseISODate(iso).getUTCDate()
              return (
                <div key={iso} className={`cal-cell ${iso === today ? 'today' : ''}`}>
                  <div className="cal-date">{dnum}</div>
                  {dayJobs.slice(0, 3).map((j) => (
                    <Link key={j.id} to={`/job/${j.id}`}>
                      <div className="cal-event" style={{ background: STATUS_COLORS[j.status] }}>
                        {j.street_address}
                      </div>
                    </Link>
                  ))}
                  {dayJobs.length > 3 && <div className="hint" style={{ fontSize: 9 }}>+{dayJobs.length - 3} more</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'gantt' && (
        <>
          {/* Desktop Gantt */}
          <div className="card-pad gantt-desktop-only">
            <div className="gantt">
              {scheduled.length === 0 && <div className="hint">No scheduled jobs.</div>}
              {scheduled.map((j) => {
                const start = j.start_date
                const end = j.end_date || j.start_date
                const offset = Math.max(0, daysBetween(today, start))
                const span = Math.max(1, daysBetween(start, end) + 1)
                const leftPct = (offset / 30) * 100
                const widthPct = Math.min(100 - leftPct, (span / 30) * 100)
                if (offset > 30) return null
                return (
                  <div className="gantt-row" key={j.id}>
                    <Link to={`/job/${j.id}`} className="gantt-label">{j.street_address}</Link>
                    <div className="gantt-track">
                      <div className="gantt-bar" style={{
                        left: `${leftPct}%`, width: `${widthPct}%`, background: STATUS_COLORS[j.status],
                      }}>
                        {formatDate(start)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile: vertical scheduled list (Gantt collapses) */}
          <div className="card-pad" style={{ display: 'none' }} id="gantt-mobile-list" />
          <div className="job-grid mobile-gantt-list" >
            {scheduled
              .slice()
              .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
              .map((j) => (
                <Link key={j.id} to={`/job/${j.id}`} className="job-card">
                  <div className="badges" style={{ marginBottom: 6 }}>
                    <span className="badge" style={{ background: STATUS_COLORS[j.status] }}>{j.status}</span>
                  </div>
                  <div className="job-title" style={{ fontSize: 15 }}>{j.street_address}</div>
                  <div className="job-meta">
                    <span>📅 {formatDate(j.start_date)}{j.end_date ? ` – ${formatDate(j.end_date)}` : ''}</span>
                  </div>
                </Link>
              ))}
          </div>
        </>
      )}
    </>
  )
}
