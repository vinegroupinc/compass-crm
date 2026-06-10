// activityLog.js — one place to write to the admin activity_log table.
// Best-effort: log failures are swallowed so they never block the main action.

import { supabase } from './supabaseClient'

export async function logActivity({
  kind, actor, targetKind, targetId, targetLabel, note, payload,
}) {
  try {
    await supabase.from('activity_log').insert({
      kind,
      actor_id:    actor?.id || null,
      actor_name:  actor?.name || actor?.full_name || null,
      target_kind: targetKind || null,
      target_id:   targetId ? String(targetId) : null,
      target_label: targetLabel || null,
      note: note || null,
      payload: payload || null,
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[activity_log] write failed:', e?.message || e)
  }
}

// Human-readable labels for each kind, used in the admin UI.
export const KIND_LABELS = {
  job_created:        'Created Job',
  job_status_changed: 'Status Changed',
  job_deleted:        'Deleted Job',
  job_closed:         'Closed Job',
  task_created:       'Created Task',
  task_completed:     'Completed Task',
  attention_set:      'Marked Needs Attention',
  attention_cleared:  'Cleared Needs Attention',
  contact_created:    'Created Contact',
  contact_updated:    'Edited Contact',
  contact_deleted:    'Deleted Contact',
  costing_updated:    'Updated Job Costing',
  login:              'Login',
  logout:             'Logout',
}

// Category groups for the filter pills in the admin UI.
export const KIND_CATEGORIES = [
  { id: 'all',        label: 'All',                kinds: null },
  { id: 'jobs',       label: 'Jobs',               kinds: ['job_created','job_status_changed','job_deleted','job_closed'] },
  { id: 'tasks',      label: 'Tasks',              kinds: ['task_created','task_completed'] },
  { id: 'attention',  label: 'Needs Attention',    kinds: ['attention_set','attention_cleared'] },
  { id: 'contacts',   label: 'Contacts',           kinds: ['contact_created','contact_updated','contact_deleted'] },
  { id: 'costing',    label: 'Costing',            kinds: ['costing_updated'] },
  { id: 'auth',       label: 'Logins / Logouts',   kinds: ['login','logout'] },
]
