import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { StatusBadge } from '../components/UI'
import { formatDate } from '../lib/time'

export default function Properties() {
  const { jobs, loading } = useData()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('addr') || '')

  const grouped = useMemo(() => {
    const map = new Map()
    jobs.forEach((j) => {
      if (!map.has(j.street_address)) map.set(j.street_address, [])
      map.get(j.street_address).push(j)
    })
    return [...map.entries()]
      .map(([addr, list]) => ({
        addr,
        list: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }))
      .sort((a, b) => a.addr.localeCompare(b.addr))
  }, [jobs])

  const filtered = grouped.filter((g) =>
    g.addr.toLowerCase().includes(q.toLowerCase())
  )

  if (loading) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head"><h1>Properties</h1></div>
      <input
        placeholder="Search address…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 18 }}
      />
      {filtered.length === 0 && <div className="empty">No properties match.</div>}
      {filtered.map((g) => (
        <section className="section" key={g.addr}>
          <div className="section-head">
            <span className="section-rail" />
            <h2 style={{ fontSize: 17 }}>{g.addr}</h2>
            <span className="section-count">{g.list.length} job(s)</span>
          </div>
          <div className="job-grid">
            {g.list.map((j) => (
              <Link key={j.id} to={`/job/${j.id}`} className="job-card">
                <div className="badges" style={{ marginBottom: 6 }}>
                  <StatusBadge status={j.status} />
                  <span className="badge badge-soft">{j.job_type}</span>
                  {j.unit && <span className="badge badge-soft">Unit {j.unit}</span>}
                </div>
                <div className="job-meta">
                  {j.start_date && <span>📅 {formatDate(j.start_date)}</span>}
                  {j.main_tech && <span>🔧 {j.main_tech}</span>}
                  {j.management_company && <span>🏢 {j.management_company}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
