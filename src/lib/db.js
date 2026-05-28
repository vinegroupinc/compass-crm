// db.js — all database access in one place.
import { supabase } from './supabaseClient'

/* ---------------- SAVED LISTS (management companies, techs) ------------- */

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

// Jobs that share the same street address (Property History). Unit ignored.
export async function getJobsByAddress(streetAddress) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('street_address', streetAddress)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Distinct street addresses for the autocomplete on the new-job form.
export async function getKnownAddresses() {
  const { data, error } = await supabase
    .from('jobs')
    .select('street_address')
  if (error) throw error
  const set = new Set((data || []).map((r) => r.street_address).filter(Boolean))
  return [...set].sort()
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

/* ------------------------------- TASKS ---------------------------------- */

export async function addTask(jobId, text, assignedUserId, assignedName) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      job_id: jobId,
      text: text.trim(),
      assigned_user_id: assignedUserId || null,
      assigned_name: assignedName || null,
      done: false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleTask(id, done) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ done })
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

export async function editOwnNote(id, body) {
  // RLS ensures only the author can do this.
  const { data, error } = await supabase
    .from('notes')
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
