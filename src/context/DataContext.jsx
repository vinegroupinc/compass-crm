import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import * as db from '../lib/db'
import { daysSinceTimestamp } from '../lib/time'
import { FOLLOWUP_DAYS, HIDDEN_FROM_DASHBOARD } from '../lib/constants'

const DataCtx = createContext(null)

export function DataProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [contacts, setContacts] = useState([])
  const [team, setTeam] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setError('')
      const [j, c, tm, ev] = await Promise.all([
        db.getJobs(),
        db.getContacts(),
        db.getTeamMembers(),
        db.getScheduledEvents(),
      ])
      setJobs(j)
      setContacts(c)
      setTeam(tm)
      setEvents(ev)
    } catch (e) {
      setError(e?.message || 'Could not load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Derived filtered lists per type — handy for dropdowns.
  const clients = contacts.filter((c) => c.is_client)
  const technicians = contacts.filter((c) => c.is_technician)
  const subcontractors = contacts.filter((c) => c.is_subcontractor)

  // A job is "stale" only when nothing has happened on it in FOLLOWUP_DAYS.
  // "Something happening" includes: status changed, a note posted, a task
  // created, or a task completed. If any of those is within the window, the
  // job is being worked on and shouldn't pop up the check-in reminder.
  const staleJobs = jobs.filter((j) => {
    if (HIDDEN_FROM_DASHBOARD.includes(j.status)) return false

    const candidates = []
    if (j.status_changed_at) candidates.push(j.status_changed_at)
    for (const n of (j.notes || [])) {
      if (n.created_at && !n.deleted_at) candidates.push(n.created_at)
    }
    for (const t of (j.tasks || [])) {
      if (t.created_at)   candidates.push(t.created_at)
      if (t.completed_at) candidates.push(t.completed_at)
    }
    if (candidates.length === 0) return false

    // Most-recent activity timestamp wins
    const latest = candidates.reduce((a, b) => (a > b ? a : b))
    return daysSinceTimestamp(latest) >= FOLLOWUP_DAYS
  })

  return (
    <DataCtx.Provider
      value={{
        jobs, contacts, clients, technicians, subcontractors,
        team, events, loading, error, refresh, staleJobs,
      }}
    >
      {children}
    </DataCtx.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
