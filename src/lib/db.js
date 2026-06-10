// db.js — all database access in one place.
import { supabase } from './supabaseClient'

/* ---------------- CONTACTS (unified clients/technicians/subs) -------- */

export async function getContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addContact({ name, is_client = false, is_technician = false, is_subcontractor = false, note = null }) {
  // If a contact with the same name exists, merge type flags rather than fail.
  // For the note: keep existing if there is one, otherwise take the new value
  // (so quick "add from job page" calls with no note don't blow away a real note).
  const cleanName = name.trim()
  const cleanNote = (note || '').trim() || null
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .eq('name', cleanName)
    .maybeSingle()
  if (existing) {
    const { data, error } = await supabase
      .from('contacts')
      .update({
        is_client: existing.is_client || is_client,
        is_technician: existing.is_technician || is_technician,
        is_subcontractor: existing.is_subcontractor || is_subcontractor,
        note: existing.note || cleanNote,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('contacts')
    .insert({ name: cleanName, is_client, is_technician, is_subcontractor, note: cleanNote })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContact(id, patch) {
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteContact(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}

// All non-deleted jobs that reference a given contact name in any role.
// Matches across management_company, the new main_techs[] array, the legacy
// main_tech string, and the new subcontractor_names[] array.
export async function getJobsForContactName(name) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .is('deleted_at', null)
    .or(
      [
        `management_company.eq.${name}`,
        `main_tech.eq.${name}`,
        `main_techs.cs.{"${name}"}`,
        `subcontractor_names.cs.{"${name}"}`,
      ].join(',')
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/* ---------------- LEGACY SAVED LISTS (kept for back-compat) ----------- */
// The old list APIs are still here so any unconverted code keeps working,
// but the Contacts page is the canonical UI now.

export async function getList(kind) {
  // kind = 'management_company' | 'tech'
  const { data, error } = await supabase
    .from('saved_list_items')
    .select('*')
    .eq('kind', kind)
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function addListItem(kind, name) {
  const { data, error } = await supabase
    .from('saved_list_items')
    .insert({ kind, name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateListItem(id, name) {
  const { data, error } = await supabase
    .from('saved_list_items')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteListItem(id) {
  const { error } = await supabase.from('saved_list_items').delete().eq('id', id)
  if (error) throw error
}

/* ------------------------------- JOBS ----------------------------------- */

export async function getJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, tasks(*), notes(*)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getJob(id) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, tasks(*), notes(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// Jobs that share the same property as the given address. Matches on the
// NORMALIZED form so abbreviation differences ("W 84th St" vs "West 84th
// Street") still group together. Fetches all and filters client-side, fine
// at this scale.
export async function getJobsByAddress(streetAddress) {
  const { normalizeAddress } = await import('./address.js')
  const key = normalizeAddress(streetAddress)
  if (!key) return []
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).filter((j) => normalizeAddress(j.street_address) === key)
}

// Distinct street addresses for the autocomplete on the new-job form.
// Returns the original strings as users typed them — useful for display and
// for letting people pick the canonical version of a property already on file.
export async function getKnownAddresses() {
  const { data, error } = await supabase
    .from('jobs')
    .select('street_address')
    .is('deleted_at', null)
  if (error) throw error
  const set = new Set((data || []).map((r) => r.street_address).filter(Boolean))
  return [...set].sort()
}

export async function softDeleteJob(id) {
  const { error } = await supabase
    .from('jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function createJob(payload) {
  // status_changed_at is set to now so the 7-day clock starts fresh.
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...payload, status_changed_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateJob(id, patch, opts = {}) {
  const finalPatch = { ...patch }
  // Only a STATUS change resets the 7-day followup clock.
  if (opts.statusChanged) {
    finalPatch.status_changed_at = new Date().toISOString()
  }
  const { data, error } = await supabase
    .from('jobs')
    .update(finalPatch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/* ---------------- TEAM MEMBERS (for task assignment) ------------------- */

export async function getTeamMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true })
  if (error) throw error
  return data || []
}

/* ------------------------------- TASKS ---------------------------------- */
// Multi-assignee model. Old single-assignee columns are still populated
// (first assignee mirrored) so anything querying the old fields still works.

export async function addTask({
  jobId, text, assigneeIds, assigneeNames, dueDate, createdByName,
}) {
  if (!Array.isArray(assigneeIds))  assigneeIds  = []
  if (!Array.isArray(assigneeNames)) assigneeNames = []
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      job_id: jobId,
      text: text.trim(),
      assigned_user_ids: assigneeIds,
      assigned_names:    assigneeNames,
      // Legacy single-assignee mirror (first assignee, for back-compat).
      assigned_user_id: assigneeIds[0] || null,
      assigned_name:    assigneeNames[0] || null,
      due_date: dueDate || null,
      created_by_name: createdByName || null,
      done: false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setTaskDue(id, dueDate) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ due_date: dueDate || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Complete a task with a required completion note (UI defaults blank to "Completed").
export async function completeTask(id, completionNote, completedByName) {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      done: true,
      completed_at: new Date().toISOString(),
      completed_by_name: completedByName || null,
      completion_note: (completionNote && completionNote.trim()) || 'Completed',
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Re-open a completed task (clears the completion fields).
export async function reopenTask(id) {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      done: false,
      completed_at: null,
      completed_by_name: null,
      completion_note: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Update the assignee list on an existing task.
// Generic update for editing a task in place (text, due date, assignees).
// Kept separate from the more-specific helpers above so the call site is
// obvious about what's being changed.
export async function updateTaskFields(id, patch) {
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function reassignTask(id, assigneeIds, assigneeNames) {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      assigned_user_ids: assigneeIds,
      assigned_names: assigneeNames,
      assigned_user_id: assigneeIds[0] || null,
      assigned_name: assigneeNames[0] || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

/* ------------------------------- NOTES ---------------------------------- */
// Notes are append-only by design (RLS blocks UPDATE/DELETE by others).
// The author may edit their OWN note (allowed by RLS policy).

export async function addNote(jobId, body, authorId, authorName) {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      job_id: jobId,
      body: body.trim(),
      author_id: authorId,
      author_name: authorName,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Author-only note deletion (within 24h, enforced server-side by RLS).
// Replaces the body with a tombstone string and sets deleted_at so the UI
// can render it greyed out. We don't DROP the row — keeps the timeline intact.
export async function deleteOwnNote(id, authorName) {
  const { data, error } = await supabase
    .from('notes')
    .update({
      body: `${authorName} deleted a message`,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/* ---------------------- SCHEDULED EVENTS ----------------------- */
// One-off calendar events tied to a specific job (a sub doing work
// on a particular day, a punch-list visit, etc.). Distinct from a
// job's overall start_date / end_date range.

export async function getScheduledEvents() {
  const { data, error } = await supabase
    .from('scheduled_events')
    .select('*')
    .order('event_date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addScheduledEvent({ jobId, title, eventDate, eventTime, createdBy, createdByName }) {
  const { data, error } = await supabase
    .from('scheduled_events')
    .insert({
      job_id: jobId,
      title: title.trim(),
      event_date: eventDate,
      event_time: eventTime || null,
      created_by: createdBy || null,
      created_by_name: createdByName || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteScheduledEvent(id) {
  const { error } = await supabase.from('scheduled_events').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------- JOB COSTING ----------------------- */
// One row per job. We auto-create the row on first read (upsert pattern),
// so callers never have to handle "no row yet" — they always get a usable object.

export async function getJobCosting(jobId) {
  const { data, error } = await supabase
    .from('job_costing')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle()
  if (error) throw error
  // Return a normalized shape even when the row doesn't exist yet
  return data || {
    job_id: jobId,
    invoice: null,
    materials: [], subs: [], labor: [],
    change_orders: [],
    last_updated_at: null,
    last_updated_by: null,
    last_updated_by_name: null,
  }
}

export async function saveJobCosting(jobId, costing, actor) {
  const payload = {
    job_id: jobId,
    invoice: costing.invoice === '' || costing.invoice == null ? null : Number(costing.invoice),
    materials: costing.materials || [],
    subs: costing.subs || [],
    labor: costing.labor || [],
    change_orders: costing.change_orders || [],
    last_updated_at: new Date().toISOString(),
    last_updated_by: actor?.id || null,
    last_updated_by_name: actor?.name || null,
  }
  const { data, error } = await supabase
    .from('job_costing')
    .upsert(payload, { onConflict: 'job_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// For the Job Costing search: pull all costing rows in one shot so we can
// filter by profit, missing data, etc.
export async function getAllJobCosting() {
  const { data, error } = await supabase
    .from('job_costing')
    .select('*')
  if (error) throw error
  return data || []
}
