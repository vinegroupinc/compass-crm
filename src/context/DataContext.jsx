import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import * as db from '../lib/db'
import { daysSinceTimestamp } from '../lib/time'
import { FOLLOWUP_DAYS, HIDDEN_FROM_DASHBOARD } from '../lib/constants'

const DataCtx = createContext(null)

export function DataProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [mgmtList, setMgmtList] = useState([])
  const [techList, setTechList] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setError('')
      const [j, m, t, tm] = await Promise.all([
        db.getJobs(),
        db.getList('management_company'),
        db.getList('tech'),
        db.getTeamMembers(),
      ])
      setJobs(j)
      setMgmtList(m)
      setTechList(t)
      setTeam(tm)
    } catch (e) {
      setError(e?.message || 'Could not load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Active jobs whose status hasn't changed in >= 7 days (LA time).
  const staleJobs = jobs.filter(
    (j) =>
      !HIDDEN_FROM_DASHBOARD.includes(j.status) &&
      daysSinceTimestamp(j.status_changed_at) >= FOLLOWUP_DAYS
  )

  return (
    <DataCtx.Provider
      value={{ jobs, mgmtList, techList, team, loading, error, refresh, staleJobs }}
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
