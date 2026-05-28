// constants.js — shared enums and rules.

export const STATUSES = [
  'New Lead',
  'Waiting Scope',
  'Estimate Needed',
  'Estimate Sent',
  'Approved',
  'Scheduled',
  'In Progress',
  'Complete',
  'Billed',
  'Closed',
  'Be-Back',
]

// Statuses hidden from the main dashboard (still appear in Property History).
export const HIDDEN_FROM_DASHBOARD = ['Billed', 'Closed']

export const JOB_TYPES = [
  'Turn',
  'Renovation',
  'Maintenance',
  'Heavy Maintenance',
  'Other',
]

// Display order for the "rest of active jobs" grouping on the dashboard.
export const ACTIVE_STATUS_ORDER = STATUSES.filter(
  (s) => !HIDDEN_FROM_DASHBOARD.includes(s)
)

// Color tokens per status (used for badges). All readable on white.
export const STATUS_COLORS = {
  'New Lead': '#6b7280',
  'Waiting Scope': '#8b5cf6',
  'Estimate Needed': '#d97706',
  'Estimate Sent': '#0891b2',
  Approved: '#0d9488',
  Scheduled: '#2563eb',
  'In Progress': '#ca8a04',
  Complete: '#16a34a',
  Billed: '#475569',
  Closed: '#94a3b8',
  'Be-Back': '#dc2626',
}

export const FOLLOWUP_DAYS = 7
