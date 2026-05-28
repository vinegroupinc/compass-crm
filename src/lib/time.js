// time.js — all date logic anchored to America/Los_Angeles.
// We never rely on the browser's local timezone for "today".

const TZ = 'America/Los_Angeles'

// Returns 'YYYY-MM-DD' for the current date in LA, regardless of device TZ.
export function laToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts // en-CA gives YYYY-MM-DD
}

// Current LA timestamp as a Date-ish ISO string for display.
export function laNowLabel() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
}

// Parse 'YYYY-MM-DD' into a UTC-noon Date to avoid off-by-one from TZ shifts.
export function parseISODate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

// Whole days between two 'YYYY-MM-DD' strings (b - a).
export function daysBetween(aISO, bISO) {
  const a = parseISODate(aISO)
  const b = parseISODate(bISO)
  if (!a || !b) return 0
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

// Days since a full ISO timestamp (e.g. status_changed_at) until LA today.
export function daysSinceTimestamp(isoTimestamp) {
  if (!isoTimestamp) return 0
  const then = new Date(isoTimestamp)
  // Convert "then" to its LA calendar date
  const thenLA = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(then)
  return daysBetween(thenLA, laToday())
}

// Format an ISO timestamp for note/audit display in LA time.
export function formatTimestamp(isoTimestamp) {
  if (!isoTimestamp) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTimestamp))
}

// Format a 'YYYY-MM-DD' for friendly display (no time).
export function formatDate(iso) {
  const d = parseISODate(iso)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', // d is already noon-UTC anchored
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

// Add n days to an ISO date string, returning a new ISO date string.
export function addDays(iso, n) {
  const d = parseISODate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export { TZ }
