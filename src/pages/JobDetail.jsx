import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import * as db from '../lib/db'
import { logActivity } from '../lib/activityLog'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, Toast, Modal } from '../components/UI'
import { ContactMultiSelect } from '../components/ContactMultiSelect'
import { JOB_TYPES, STATUSES, STATUS_COLORS } from '../lib/constants'
import { formatTimestamp, formatDate, formatTime, laToday } from '../lib/time'

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clients, technicians, subcontractors, team, events: scheduledEvents, refresh } = useData()
  const { user } = useAuth()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [toast, setToast] = useState('')
  const [history, setHistory] = useState([])
  const [sched, setSched] = useState({ start_date: '', end_date: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ---- Job Planner state ----
  // One textarea drives either "Add update" or "Push task to planner"
  const [composer, setComposer] = useState('')
  // Default the new-task date to today (LA tz). User can change before pushing.
  const [taskDue, setTaskDue] = useState(() => laToday())
  // Multi-assignee: default to just me
  const [taskAssignees, setTaskAssignees] = useState([user.id])
  // What the composer is currently doing: null = nothing chosen yet,
  // 'task' = pushing a task, 'note' = posting an update.
  const [composerMode, setComposerMode] = useState(null)
  // Active completion modal: holds the task being completed, plus the note draft
  const [completing, setCompleting] = useState(null) // { taskId, taskText } | null
  const [completionNote, setCompletionNote] = useState('')

  // Inline form for adding a scheduled event from this job's Schedule card
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState(() => laToday())
  const [eventTime, setEventTime] = useState('')
  const [addingEvent, setAddingEvent] = useState(false)

  // Needs Attention modal (when setting it; clearing is one-tap)
  const [settingAttention, setSettingAttention] = useState(false)
  const [attentionNoteDraft, setAttentionNoteDraft] = useState('')

  // Close Job modal
  const [closing, setClosing] = useState(false)
  const [closeNote, setCloseNote] = useState('')
  const [closeNoSale, setCloseNoSale] = useState(false)

  // Edit task modal
  const [editingTask, setEditingTask] = useState(null) // the task row, or null
  const [editTaskText, setEditTaskText] = useState('')
  const [editTaskDue, setEditTaskDue] = useState('')
  const [editTaskAssignees, setEditTaskAssignees] = useState([])

  const load = useCallback(async () => {
    try {
      const j = await db.getJob(id)
      setJob(j)
      // Normalize array fields so the edit form can read them directly even
      // for jobs created before the multi-select migration.
      const splitOrEmpty = (s) =>
        s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []
      setDraft({
        ...j,
        main_techs: (j.main_techs && j.main_techs.length > 0)
          ? j.main_techs
          : splitOrEmpty(j.main_tech),
        subcontractor_names: (j.subcontractor_names && j.subcontractor_names.length > 0)
          ? j.subcontractor_names
          : splitOrEmpty(j.subcontractors),
      })
      setSched({
        start_date: j.start_date || '',
        end_date: j.end_date || '',
      })
      const h = await db.getJobsByAddress(j.street_address)
      setHistory(h.filter((x) => x.id !== j.id))
    } catch (e) {
      setToast(e?.message || 'Could not load job')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 2200) }

  async function saveEdits() {
    const statusChanged = draft.status !== job.status
    try {
      const main_techs = draft.main_techs || []
      const subcontractor_names = draft.subcontractor_names || []
      await db.updateJob(job.id, {
        street_address: draft.street_address.trim(),
        unit: draft.unit?.trim() || null,
        management_company: draft.management_company,
        unit_manager: draft.unit_manager,
        job_type: draft.job_type,
        main_techs,
        main_tech: main_techs.join(', ') || null,                       // legacy mirror
        subcontractor_names,
        subcontractors: subcontractor_names.join(', ') || null,         // legacy mirror
        access_info: draft.access_info,
        crew_access: draft.crew_access,
        status: draft.status,
        needs_attention: draft.needs_attention,
      }, { statusChanged })
      setEditing(false)
      await load()
      await refresh()
      flash(statusChanged ? 'Saved — followup clock reset' : 'Saved')
    } catch (e) { flash(e?.message || 'Save failed') }
  }

  async function quickStatus(status) {
    const prev = job.status
    try {
      await db.updateJob(job.id, { status }, { statusChanged: status !== prev })
      await load(); await refresh(); flash(`Status → ${status}`)
      if (status !== prev) {
        logActivity({
          kind: 'job_status_changed',
          actor: user,
          targetKind: 'job',
          targetId: job.id,
          targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
          note: `${prev} → ${status}`,
          payload: { from: prev, to: status },
        })
      }
    } catch (e) { flash(e?.message || 'Failed') }
  }

  // Generic flag toggle (kept for non-attention flags if added later).
  async function toggleFlag(field) {
    try {
      await db.updateJob(job.id, { [field]: !job[field] })
      await load(); await refresh()
    } catch (e) { flash(e?.message || 'Failed') }
  }

  // Needs Attention: setting → prompts for an optional note; clearing → wipes
  // the note and logs the clear. Both flow through the admin activity log only.
  async function setNeedsAttention(note) {
    try {
      await db.updateJob(job.id, { needs_attention: true, attention_note: (note || '').trim() || null })
      await load(); await refresh()
      logActivity({
        kind: 'attention_set',
        actor: user,
        targetKind: 'job',
        targetId: job.id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
        note: (note || '').trim() || null,
      })
      flash('Marked Needs Attention')
    } catch (e) { flash(e?.message || 'Failed') }
  }
  async function clearNeedsAttention() {
    try {
      await db.updateJob(job.id, { needs_attention: false, attention_note: null })
      await load(); await refresh()
      logActivity({
        kind: 'attention_cleared',
        actor: user,
        targetKind: 'job',
        targetId: job.id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
      })
      flash('Cleared Needs Attention')
    } catch (e) { flash(e?.message || 'Failed') }
  }

  async function saveSchedule() {
    try {
      await db.updateJob(job.id, {
        start_date: sched.start_date || null,
        end_date: sched.end_date || null,
      })
      await load(); await refresh(); flash('Schedule updated')
    } catch (e) { flash(e?.message || 'Could not update schedule') }
  }

  async function addEventToJob() {
    if (!eventTitle.trim()) { flash('Give the event a name'); return }
    if (!eventDate) { flash('Pick a date'); return }
    try {
      await db.addScheduledEvent({
        jobId: job.id,
        title: eventTitle,
        eventDate, eventTime,
        createdBy: user.id, createdByName: user.name,
      })
      setEventTitle(''); setEventTime(''); setEventDate(laToday())
      setAddingEvent(false)
      await refresh()
      flash('Event added')
    } catch (e) { flash(e?.message || 'Could not add event') }
  }

  async function removeEvent(ev) {
    if (!confirm('Delete this event?')) return
    try {
      await db.deleteScheduledEvent(ev.id)
      await refresh()
      flash('Event deleted')
    } catch (e) { flash(e?.message || 'Failed') }
  }

  async function deleteJob() {
    try {
      await db.softDeleteJob(job.id)
      logActivity({
        kind: 'job_deleted',
        actor: user,
        targetKind: 'job',
        targetId: job.id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
      })
      await refresh()
      navigate('/')
    } catch (e) { flash(e?.message || 'Could not delete') }
  }

  // Close Job: sets status to "Closed" or "No-Sale", logs to BOTH admin and job timeline.
  async function confirmClose() {
    const newStatus = closeNoSale ? 'No-Sale' : 'Closed'
    const trimmed = (closeNote || '').trim()
    try {
      // Update status + persist the close note
      await db.updateJob(job.id, {
        status: newStatus,
        closed_note: trimmed || null,
      }, { statusChanged: true })
      // Also drop the close note into the job's notes log so it shows in timeline
      if (trimmed) {
        await db.addNote(
          job.id,
          `Job closed${closeNoSale ? ' (No-Sale)' : ''}: ${trimmed}`,
          user.id, user.name,
        )
      } else {
        await db.addNote(
          job.id,
          `Job closed${closeNoSale ? ' (No-Sale)' : ''}.`,
          user.id, user.name,
        )
      }
      // Admin log
      logActivity({
        kind: 'job_closed',
        actor: user,
        targetKind: 'job',
        targetId: job.id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
        note: trimmed || null,
        payload: { no_sale: closeNoSale, final_status: newStatus },
      })
      setClosing(false); setCloseNote(''); setCloseNoSale(false)
      await load(); await refresh()
      flash(`Job closed → ${newStatus}`)
    } catch (e) { flash(e?.message || 'Could not close') }
  }

  // ---- composer actions ----

  async function addUpdate() {
    const text = composer.trim()
    if (!text) { flash('Type something first'); return }
    try {
      await db.addNote(job.id, text, user.id, user.name)
      setComposer('')
      setComposerMode(null)
      await load()
      flash('Update added')
    } catch (e) { flash(e?.message || 'Could not add update') }
  }

  async function pushTask() {
    const text = composer.trim()
    if (!text) { flash('Type the task first'); return }
    if (!taskDue) { flash('Pick a due date'); return }
    if (taskAssignees.length === 0) { flash('Assign at least one person'); return }
    const assigneeNames = taskAssignees.map((id) => {
      const m = team.find((x) => x.id === id)
      return m?.full_name || 'Teammate'
    })
    try {
      const created = await db.addTask({
        jobId: job.id,
        text,
        assigneeIds: taskAssignees,
        assigneeNames,
        dueDate: taskDue,
        createdByName: user.name,
      })
      logActivity({
        kind: 'task_created',
        actor: user,
        targetKind: 'task',
        targetId: created?.id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
        note: text,
        payload: { assignees: assigneeNames, due_date: taskDue },
      })
      setComposer('')
      setComposerMode(null)
      // Keep the assignees + date so a quick second task can use the same context;
      // a fresh "today" date is more useful than carrying yesterday over though,
      // so reset the date if it's now in the past.
      if (taskDue < laToday()) setTaskDue(laToday())
      await load(); await refresh()
      flash('Task pushed to planner')
    } catch (e) { flash(e?.message || 'Could not create task') }
  }

  // ---- task lifecycle ----

  function startComplete(task) {
    setCompleting({ taskId: task.id, taskText: task.text })
    setCompletionNote('')
  }

  async function confirmComplete() {
    if (!completing) return
    try {
      await db.completeTask(completing.taskId, completionNote, user.name)
      logActivity({
        kind: 'task_completed',
        actor: user,
        targetKind: 'task',
        targetId: completing.taskId,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
        note: completing.taskText,
        payload: { completion_note: completionNote || 'Completed' },
      })
      setCompleting(null); setCompletionNote('')
      await load(); await refresh()
      flash('Task completed')
    } catch (e) { flash(e?.message || 'Could not complete task') }
  }

  async function reopenTask(task) {
    if (!confirm('Re-open this task? It will appear in assignees\' planners again.')) return
    try {
      await db.reopenTask(task.id)
      await load(); await refresh()
      flash('Task re-opened')
    } catch (e) { flash(e?.message || 'Failed') }
  }

  // Open the edit-task modal pre-filled with the task's current state.
  function startEdit(task) {
    setEditingTask(task)
    setEditTaskText(task.text || '')
    setEditTaskDue(task.due_date || '')
    const ids = (task.assigned_user_ids && task.assigned_user_ids.length > 0)
      ? task.assigned_user_ids
      : (task.assigned_user_id ? [task.assigned_user_id] : [])
    setEditTaskAssignees(ids)
  }
  function toggleEditAssignee(uid) {
    setEditTaskAssignees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    )
  }
  async function saveEditTask() {
    if (!editingTask) return
    const trimmed = editTaskText.trim()
    if (!trimmed) { flash('Task text can\'t be blank'); return }
    if (!editTaskDue) { flash('Pick a due date'); return }
    if (editTaskAssignees.length === 0) { flash('Assign at least one person'); return }
    const names = editTaskAssignees.map((id) => {
      const m = team.find((x) => x.id === id)
      return m?.full_name || 'Teammate'
    })
    try {
      // Two writes: text + due date (via setTaskDue can't carry text), and
      // assignees (via reassignTask). We update the row directly to avoid
      // adding yet another db helper.
      await db.updateTaskFields(editingTask.id, {
        text: trimmed,
        due_date: editTaskDue,
        assigned_user_ids: editTaskAssignees,
        assigned_names: names,
        assigned_user_id: editTaskAssignees[0] || null,
        assigned_name: names[0] || null,
      })
      setEditingTask(null)
      await load(); await refresh()
      flash('Task updated')
    } catch (e) { flash(e?.message || 'Could not save') }
  }

  async function changeTaskDue(taskId, dueDate) {
    try {
      await db.setTaskDue(taskId, dueDate)
      await load(); await refresh()
    } catch (e) { flash(e?.message || 'Could not update due date') }
  }

  async function deleteTask(t) {
    if (!confirm('Delete this task? This cannot be undone.')) return
    try {
      await db.deleteTask(t.id)
      await load(); await refresh()
      flash('Task deleted')
    } catch (e) { flash(e?.message || 'Failed') }
  }

  // ---- notes ----

  async function deleteNote(noteId) {
    if (!confirm('Delete this message? This cannot be undone.')) return
    try {
      await db.deleteOwnNote(noteId, user.name)
      await load(); flash('Message deleted')
    } catch (e) { flash(e?.message || 'Could not delete (only the author can delete, within 24 hours)') }
  }

  if (loading) return <div className="empty">Loading…</div>
  if (!job) return <div className="empty">Job not found.</div>

  const notes = [...(job.notes || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
  const allTasks = job.tasks || []
  const today = laToday()
  const d = draft

  // Open tasks at the top, sorted by due date ascending (soonest first;
  // tasks with no due date appear last in their group).
  const openTasks = allTasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const ad = a.due_date || '9999-12-31'
      const bd = b.due_date || '9999-12-31'
      return ad.localeCompare(bd)
    })

  // Activity timeline: notes + task-completed events, reverse-chronological.
  // Task CREATIONS are intentionally not shown here — they're logged to the
  // admin activity log only. Completions stay (for accountability).
  const events = []
  for (const n of notes) {
    events.push({
      kind: 'note',
      when: n.created_at,
      id: 'note-' + n.id,
      note: n,
    })
  }
  for (const t of allTasks) {
    if (t.done && t.completed_at) {
      events.push({
        kind: 'task-completed',
        when: t.completed_at,
        id: 'td-' + t.id,
        task: t,
      })
    }
  }
  events.sort((a, b) => new Date(b.when) - new Date(a.when))

  // Names for the multi-assignee picker (label = "Me" for current user)
  function pickerLabel(m) {
    return m.id === user.id ? `${m.full_name} (Me)` : m.full_name
  }
  function toggleAssignee(uid) {
    setTaskAssignees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    )
  }
  function assigneesLabel() {
    if (taskAssignees.length === 0) return 'No one'
    const names = taskAssignees
      .map((id) => team.find((m) => m.id === id)?.full_name?.split(' ')[0] || '?')
    if (names.length <= 2) return names.join(' & ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  }

  return (
    <>
      <div className="page-head job-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to="/" className="hint">← Dashboard</Link>
          <h1 style={{ marginTop: 4 }}>
            {job.street_address}{job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {job.unit}</span> : null}
          </h1>
          <div className="hint job-schedule-row">
            {job.start_date
              ? `Scheduled ${formatDate(job.start_date)}${job.end_date ? ` – ${formatDate(job.end_date)}` : ''}`
              : 'Not yet scheduled'}
          </div>
        </div>
        <div className="row row-wrap job-head-actions" style={{ gap: 8 }}>
          {/* Clickable colored status pill — native <select> overlays for mobile-friendly dropdown */}
          <span
            className="status-pill"
            style={{ background: STATUS_COLORS[job.status] || '#6b7280' }}
            title="Click to change status"
          >
            {job.status}
            <span className="status-pill-caret">▾</span>
            <select
              className="status-pill-select"
              value={job.status}
              onChange={(e) => quickStatus(e.target.value)}
              aria-label="Change status"
            >
              {STATUSES.map((s) => (
                <option
                  key={s}
                  value={s}
                  // Closed and No-Sale can only be set via the Close Job
                  // button (which captures a note and an admin-log entry).
                  disabled={(s === 'Closed' || s === 'No-Sale') && job.status !== s}
                >
                  {s}
                </option>
              ))}
            </select>
          </span>
          <button
            className={`btn btn-sm ${job.needs_attention ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => {
              if (job.needs_attention) {
                clearNeedsAttention()
              } else {
                setAttentionNoteDraft('')
                setSettingAttention(true)
              }
            }}
          >
            ⚠ {job.needs_attention ? 'Clear Attention' : 'Needs Attention'}
          </button>
          {!editing && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const splitOrEmpty = (s) => s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []
              setDraft({
                ...job,
                main_techs: (job.main_techs && job.main_techs.length > 0) ? job.main_techs : splitOrEmpty(job.main_tech),
                subcontractor_names: (job.subcontractor_names && job.subcontractor_names.length > 0) ? job.subcontractor_names : splitOrEmpty(job.subcontractors),
              })
              setEditing(true)
            }}>Edit</button>
          )}
        </div>
      </div>

      {/* details / edit */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        {!editing ? (
          <div className="job-details-split">
            <div className="job-details-col">
              <div className="job-detail-row"><span className="job-detail-label">🏢 Client</span><span className="job-detail-value">{job.management_company || '—'}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">👤 Manager</span><span className="job-detail-value">{job.unit_manager || '—'}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">🔧 Vine Tech</span><span className="job-detail-value">{
                (job.main_techs && job.main_techs.length > 0)
                  ? job.main_techs.join(', ')
                  : (job.main_tech || '—')
              }</span></div>
            </div>
            <div className="job-details-col">
              <div className="job-detail-row"><span className="job-detail-label">🧰 Subs</span><span className="job-detail-value">{
                (job.subcontractor_names && job.subcontractor_names.length > 0)
                  ? job.subcontractor_names.join(', ')
                  : (job.subcontractors || '—')
              }</span></div>
              <div className="job-detail-row"><span className="job-detail-label">🔑 Access</span><span className="job-detail-value">{job.access_info || '—'}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">📝 Notes</span><span className="job-detail-value">{job.crew_access || '—'}</span></div>
            </div>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <div className="field-full">
                <label>Street address</label>
                <input value={d.street_address} onChange={(e) => setDraft({ ...d, street_address: e.target.value })} />
              </div>
              <div><label>Unit # (optional)</label>
                <input value={d.unit || ''} onChange={(e) => setDraft({ ...d, unit: e.target.value })} /></div>
              <div><label>Job type</label>
                <select value={d.job_type} onChange={(e) => setDraft({ ...d, job_type: e.target.value })}>
                  {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select></div>
              <div><label>Client (Management Company)</label>
                <select value={d.management_company || ''} onChange={(e) => setDraft({ ...d, management_company: e.target.value })}>
                  <option value="">— Select —</option>
                  {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select></div>
              <div><label>Manager</label>
                <input value={d.unit_manager || ''} onChange={(e) => setDraft({ ...d, unit_manager: e.target.value })} /></div>
              <div className="field-full">
                <ContactMultiSelect
                  label="Vine Tech"
                  value={d.main_techs || []}
                  onChange={(v) => setDraft({ ...d, main_techs: v })}
                  options={technicians}
                  onAddNew={async (name) => { await db.addContact({ name, is_technician: true }); await refresh() }}
                  placeholder="Search or add a Vine Tech…"
                />
              </div>
              <div><label>Status</label>
                <select value={d.status} onChange={(e) => setDraft({ ...d, status: e.target.value })}>
                  {STATUSES.map((s) => (
                    <option
                      key={s}
                      value={s}
                      disabled={(s === 'Closed' || s === 'No-Sale') && d.status !== s}
                    >
                      {s}
                    </option>
                  ))}
                </select></div>
              <div className="field-full">
                <ContactMultiSelect
                  label="Subcontractor(s)"
                  value={d.subcontractor_names || []}
                  onChange={(v) => setDraft({ ...d, subcontractor_names: v })}
                  options={subcontractors}
                  onAddNew={async (name) => { await db.addContact({ name, is_subcontractor: true }); await refresh() }}
                  placeholder="e.g. Zahava Electrical, Lubov Plumbing"
                />
              </div>
              <div className="field-full"><label>Access Information</label>
                <textarea value={d.access_info || ''} onChange={(e) => setDraft({ ...d, access_info: e.target.value })}
                  placeholder="Lockbox code, gate code, parking, where to find keys…" /></div>
              <div className="field-full"><label>Notes</label>
                <textarea value={d.crew_access || ''} onChange={(e) => setDraft({ ...d, crew_access: e.target.value })}
                  placeholder="Scope, tenant contact information, additional notes…" /></div>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-accent btn-block" onClick={saveEdits}>Save changes</button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>

      {/* COMPOSER — "Create a Task & Leave a Note" with mode toggle */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div className="composer-head">
          <h2 style={{ fontSize: 18, margin: 0 }}>Create a Task &amp; Leave a Note</h2>
          <div className="composer-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={composerMode === 'task'}
              className={`composer-toggle-btn ${composerMode === 'task' ? 'on' : ''}`}
              onClick={() => setComposerMode('task')}
            >
              Create a task
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={composerMode === 'note'}
              className={`composer-toggle-btn ${composerMode === 'note' ? 'on' : ''}`}
              onClick={() => setComposerMode('note')}
            >
              Leave a note
            </button>
          </div>
        </div>

        {composerMode === null && (
          <div className="hint" style={{ marginTop: 8, marginBottom: 14 }}>
            Pick "Create a task" or "Leave a note" above to get started.
          </div>
        )}

        <div className={`planner-composer ${composerMode === null ? 'composer-disabled' : ''}`} style={{ marginTop: 14 }}>
          <div className="planner-composer-left">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder={
                composerMode === 'task'
                  ? 'Describe the task…'
                  : composerMode === 'note'
                    ? 'Write your update…'
                    : 'Pick "Create a task" or "Leave a note" first'
              }
              rows={4}
              disabled={composerMode === null}
            />
            {composerMode === 'task' && (
              <div className="planner-task-options">
                <div>
                  <label>Assign to (one or more)</label>
                  <div className="assignee-chips">
                    {team.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`assignee-chip ${taskAssignees.includes(m.id) ? 'on' : ''}`}
                        onClick={() => toggleAssignee(m.id)}
                      >
                        {taskAssignees.includes(m.id) ? '✓ ' : ''}{pickerLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label>Due date</label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="planner-composer-right">
            <button
              className="btn btn-primary btn-block"
              onClick={pushTask}
              disabled={composerMode !== 'task'}
            >
              Push task to planner
            </button>
            <button
              className="btn btn-accent btn-block"
              onClick={addUpdate}
              disabled={composerMode !== 'note'}
            >
              Post note
            </button>
          </div>
        </div>
      </div>

      {/* OPEN TASKS + ACTIVITY TIMELINE */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>
          Job Planner <span className="section-count" style={{ marginLeft: 6 }}>{openTasks.length}</span>
        </h2>
        {openTasks.length === 0 && <div className="hint">No open tasks.</div>}
        {openTasks.length > 0 && (
          <div className={openTasks.length >= 3 ? 'planner-tasks-scroll' : ''}>
            {openTasks.map((t) => {
              const overdue = t.due_date && t.due_date < today
              const names = (t.assigned_names && t.assigned_names.length > 0)
                ? t.assigned_names.join(', ')
                : (t.assigned_name || 'Unassigned')
              return (
                <div key={t.id} className="planner-task">
                  <button
                    className="task-check"
                    onClick={() => startComplete(t)}
                    aria-label="Complete task"
                  />
                  <div className="planner-task-body">
                    <div className="planner-task-text">{t.text}</div>
                    <div className="planner-task-meta">
                      <span>👥 {names}</span>
                      <span className={overdue ? 'overdue' : ''}>
                        📅 Due {t.due_date ? formatDate(t.due_date) : '—'}
                        {overdue ? ' (overdue)' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => startEdit(t)}
                    title="Edit task"
                  >Edit</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteTask(t)}
                    title="Delete task"
                  >✕</button>
                </div>
              )
            })}
          </div>
        )}

        <h2 style={{ fontSize: 18, marginTop: 22, marginBottom: 10 }}>Activity</h2>
        <div className="hint" style={{ marginBottom: 10 }}>
          All updates, task creations, and completions — newest first.
        </div>
        {events.length === 0 && <div className="hint">Nothing yet.</div>}
        {events.length > 0 && (
          <div className={events.length >= 3 ? 'activity-list-scroll' : ''}>
            {events.map((ev) => {
              if (ev.kind === 'note') {
                const n = ev.note
                const isDeleted = !!n.deleted_at
                const isAuthor = n.author_id === user.id
                const ageHours = (Date.now() - new Date(n.created_at).getTime()) / 3_600_000
                const canDelete = isAuthor && !isDeleted && ageHours < 24
                return (
                  <div key={ev.id} className={`activity-item ${isDeleted ? 'note-deleted' : ''}`}>
                    <span className="activity-icon" title="Update">💬</span>
                    <div className="activity-body">
                      <div className="note-head">
                        <span className="note-author">{n.author_name}</span>
                        <span className="note-time">{formatTimestamp(n.created_at)}</span>
                      </div>
                      <div className="note-body">{n.body}</div>
                      {canDelete && (
                        <button
                          className="btn btn-ghost btn-sm note-delete-btn"
                          onClick={() => deleteNote(n.id)}
                        >Delete</button>
                      )}
                    </div>
                  </div>
                )
              }
              if (ev.kind === 'task-completed') {
                const t = ev.task
                return (
                  <div key={ev.id} className="activity-item activity-completed">
                    <span className="activity-icon" title="Task completed">✅</span>
                    <div className="activity-body">
                      <div className="note-head">
                        <span className="note-author">{t.completed_by_name || 'Someone'} completed a task</span>
                        <span className="note-time">{formatTimestamp(t.completed_at)}</span>
                      </div>
                      <div className="note-body">
                        <span style={{ textDecoration: 'line-through', color: 'var(--ink-faint)' }}>{t.text}</span>
                        {t.completion_note && (
                          <div style={{ marginTop: 6 }}>{t.completion_note}</div>
                        )}
                        <button
                          className="link-btn"
                          style={{ marginTop: 6, fontSize: 12 }}
                          onClick={() => reopenTask(t)}
                        >Re-open task</button>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            })}
          </div>
        )}
      </div>

      {/* schedule + property history — paired side-by-side at the bottom */}
      <div className="bottom-grid">
        <div className="card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Schedule</h2>
          <div className="hint" style={{ marginBottom: 12 }}>
            {job.start_date
              ? `Currently ${formatDate(job.start_date)}${job.end_date ? ` – ${formatDate(job.end_date)}` : ''}.`
              : 'Not yet scheduled.'}
          </div>
          <div>
            <label>Scheduled start</label>
            <input type="date" value={sched.start_date}
              onChange={(e) => setSched((s) => ({ ...s, start_date: e.target.value }))} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Scheduled end</label>
            <input type="date" value={sched.end_date}
              onChange={(e) => setSched((s) => ({ ...s, end_date: e.target.value }))} />
          </div>
          <button className="btn btn-accent btn-sm" style={{ marginTop: 14 }} onClick={saveSchedule}>
            Save schedule
          </button>
        </div>

        <div className="bottom-right-stack">

        <div className="card-pad">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Schedule a day event</h2>
            {!addingEvent && (
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingEvent(true)}>+ Add</button>
            )}
          </div>
          <div className="hint" style={{ marginBottom: 12 }}>
            One-off entries that show on the calendar (e.g. a sub coming on a specific day).
          </div>

          {(() => {
            const jobEvents = (scheduledEvents || [])
              .filter((e) => e.job_id === job.id)
              .sort((a, b) => (a.event_date + (a.event_time || '')).localeCompare(b.event_date + (b.event_time || '')))
            if (jobEvents.length === 0 && !addingEvent) {
              return <div className="hint">No events yet.</div>
            }
            return (
              <div className={jobEvents.length >= 2 ? 'day-events-scroll' : ''}>
                {jobEvents.map((ev) => (
                  <div key={ev.id} className="list-item" style={{ marginTop: 0, marginBottom: 8 }}>
                    <div className="name">
                      {ev.event_time ? formatTime(ev.event_time) + ' · ' : ''}{ev.title}
                      <div className="hint" style={{ marginTop: 4 }}>{formatDate(ev.event_date)}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeEvent(ev)}>✕</button>
                  </div>
                ))}
              </div>
            )
          })()}

          {addingEvent && (
            <div style={{ marginTop: 12, padding: 12, background: '#fafbfc', border: '1px solid var(--line)', borderRadius: 8 }}>
              <label>Title</label>
              <input
                autoFocus
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="e.g. Reglaze"
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <label>Date</label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div>
                  <label>Start time</label>
                  <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                </div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-accent btn-sm btn-block" onClick={addEventToJob}>Save event</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAddingEvent(false); setEventTitle(''); setEventTime('') }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Property history</h2>
          <div className="hint" style={{ marginBottom: 12 }}>
            Other jobs at {job.street_address} (any unit).
          </div>
          {history.length === 0 && <div className="hint">No other jobs at this address.</div>}
          {history.map((h) => (
            <Link key={h.id} to={`/job/${h.id}`} className="list-item" style={{ textDecoration: 'none' }}>
              <div className="name">
                {h.unit ? `Unit ${h.unit} · ` : ''}{h.job_type}
                <div className="hint">{h.start_date ? formatDate(h.start_date) : 'No date'}</div>
              </div>
              <StatusBadge status={h.status} />
            </Link>
          ))}
          <Link to={`/properties?addr=${encodeURIComponent(job.street_address)}`} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>
            View Full Property History →
          </Link>
        </div>

        </div> {/* end bottom-right-stack */}
      </div>

      {/* Close Job — final action that retires a job to Closed or No-Sale */}
      {!['Closed', 'No-Sale'].includes(job.status) && (
        <div className="close-zone">
          <div className="close-zone-text">
            <h3 style={{ margin: 0 }}>Wrap up this job</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
              Use when you're done. Closes the job and moves it off the dashboard.
            </p>
          </div>
          <button className="btn btn-accent" onClick={() => setClosing(true)}>
            Close Job
          </button>
        </div>
      )}

      {/* Danger Zone — separated and clearly marked so deletion is deliberate. */}
      <div className="danger-zone">
        <h3>Danger Zone</h3>
        <p>Deleting this job removes it from the dashboard, calendar, and search.</p>
        <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
          Delete this job
        </button>
      </div>

      <Toast message={toast} />

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)}>
          <h3>Delete this job?</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6 }}>
            <strong>{job.street_address}{job.unit ? ` · Unit ${job.unit}` : ''}</strong> will be removed
            from the dashboard, calendar, and search.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-danger btn-block" onClick={deleteJob}>Yes, delete</button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {completing && (
        <Modal onClose={() => setCompleting(null)}>
          <h3>Complete task</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6, marginBottom: 14 }}>
            <strong>{completing.taskText}</strong>
          </p>
          <label>Add a note (what did you do?)</label>
          <textarea
            autoFocus
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            placeholder="e.g. Manager wants brown flooring."
            rows={4}
          />
          <div className="hint" style={{ marginTop: 4, fontSize: 12 }}>
            Leave blank to log it as "Completed."
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-accent btn-block" onClick={confirmComplete}>Mark complete</button>
            <button className="btn btn-ghost" onClick={() => setCompleting(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {settingAttention && (
        <Modal onClose={() => setSettingAttention(false)}>
          <h3>Mark Needs Attention</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6, marginBottom: 14 }}>
            Flagged jobs show up at the top of everyone's dashboard.
          </p>
          <label>Note (optional)</label>
          <textarea
            autoFocus
            value={attentionNoteDraft}
            onChange={(e) => setAttentionNoteDraft(e.target.value)}
            placeholder="e.g. Client unreachable for 3 days."
            rows={3}
          />
          <div className="row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                setNeedsAttention(attentionNoteDraft)
                setSettingAttention(false)
              }}
            >Mark Needs Attention</button>
            <button className="btn btn-ghost" onClick={() => setSettingAttention(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {editingTask && (
        <Modal onClose={() => setEditingTask(null)}>
          <h3>Edit task</h3>
          <label style={{ marginTop: 12 }}>Task</label>
          <textarea
            autoFocus
            value={editTaskText}
            onChange={(e) => setEditTaskText(e.target.value)}
            rows={3}
          />
          <label style={{ marginTop: 12 }}>Assign to (one or more)</label>
          <div className="assignee-chips">
            {team.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`assignee-chip ${editTaskAssignees.includes(m.id) ? 'on' : ''}`}
                onClick={() => toggleEditAssignee(m.id)}
              >
                {editTaskAssignees.includes(m.id) ? '✓ ' : ''}
                {m.id === user.id ? `${m.full_name} (Me)` : m.full_name}
              </button>
            ))}
          </div>
          <label style={{ marginTop: 12 }}>Due date</label>
          <input
            type="date"
            value={editTaskDue}
            onChange={(e) => setEditTaskDue(e.target.value)}
          />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-accent btn-block" onClick={saveEditTask}>Save changes</button>
            <button className="btn btn-ghost" onClick={() => setEditingTask(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {closing && (
        <Modal onClose={() => setClosing(false)}>
          <h3>Are you sure you want to close this job?</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6, marginBottom: 14 }}>
            <strong>{job.street_address}{job.unit ? ` · Unit ${job.unit}` : ''}</strong> will
            be moved off the dashboard. You can still find it in Property History and Search.
          </p>
          <label>Closing note (optional)</label>
          <textarea
            autoFocus
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            placeholder="e.g. Final walkthrough done, invoice sent."
            rows={3}
          />
          <label className="row" style={{ marginTop: 12, marginBottom: 0, gap: 8, cursor: 'pointer', alignItems: 'center' }}>
            <input
              type="checkbox"
              style={{ width: 18, height: 18, minHeight: 'auto' }}
              checked={closeNoSale}
              onChange={(e) => setCloseNoSale(e.target.checked)}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
              No-Sale — we didn't go through with the job
            </span>
          </label>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-accent btn-block" onClick={confirmClose}>
              Yes, close job
            </button>
            <button className="btn btn-ghost" onClick={() => setClosing(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  )
}
