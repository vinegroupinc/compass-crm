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

  const staleJobs = jobs.filter(
    (j) =>
      !HIDDEN_FROM_DASHBOARD.includes(j.status) &&
      daysSinceTimestamp(j.status_changed_at) >= FOLLOWUP_DAYS
  )

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
