import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import * as db from '../lib/db'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, Toast, Modal } from '../components/UI'
import { ContactMultiSelect } from '../components/ContactMultiSelect'
import { JOB_TYPES, STATUSES, STATUS_COLORS } from '../lib/constants'
import { formatTimestamp, formatDate, laToday } from '../lib/time'

const USERS_NOTE =
  'Tasks can be assigned to any team member. Assigned open tasks appear on that person’s dashboard.'

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clients, technicians, subcontractors, team, refresh } = useData()
  const { user } = useAuth()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [toast, setToast] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newTask, setNewTask] = useState('')
  const [taskAssignee, setTaskAssignee] = useState(user.id)
  const [newTaskDue, setNewTaskDue] = useState('')
  const [history, setHistory] = useState([])
  const [sched, setSched] = useState({ start_date: '', end_date: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

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
    try {
      await db.updateJob(job.id, { status }, { statusChanged: status !== job.status })
      await load(); await refresh(); flash(`Status → ${status}`)
    } catch (e) { flash(e?.message || 'Failed') }
  }

  async function toggleFlag(field) {
    try {
      await db.updateJob(job.id, { [field]: !job[field] })
      await load(); await refresh()
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

  async function deleteJob() {
    try {
      await db.softDeleteJob(job.id)
      await refresh()
      navigate('/')
    } catch (e) { flash(e?.message || 'Could not delete') }
  }

  async function postNote() {
    if (!newNote.trim()) return
    try {
      await db.addNote(job.id, newNote, user.id, user.name)
      setNewNote(''); await load(); flash('Note added')
    } catch (e) { flash(e?.message || 'Could not add note') }
  }

  async function deleteNote(noteId) {
    if (!confirm('Delete this message? This cannot be undone.')) return
    try {
      await db.deleteOwnNote(noteId, user.name)
      await load(); flash('Message deleted')
    } catch (e) { flash(e?.message || 'Could not delete (only the author can delete, within 24 hours)') }
  }

  async function addTask() {
    if (!newTask.trim()) return
    const member = team.find((m) => m.id === taskAssignee)
    const assignee = member?.full_name || user.name
    try {
      await db.addTask(job.id, newTask, taskAssignee, assignee, newTaskDue || null)
      setNewTask(''); setNewTaskDue(''); await load(); await refresh(); flash('Task added')
    } catch (e) { flash(e?.message || 'Could not add task') }
  }

  async function changeTaskDue(taskId, dueDate) {
    try {
      await db.setTaskDue(taskId, dueDate || null)
      await load(); await refresh()
    } catch (e) { flash(e?.message || 'Could not update due date') }
  }

  async function changeAssignee(taskId, newUserId) {
    const member = team.find((m) => m.id === newUserId)
    const name = member?.full_name || 'Teammate'
    try {
      await db.reassignTask(taskId, newUserId, name)
      await load(); await refresh(); flash('Task reassigned')
    } catch (e) { flash(e?.message || 'Could not reassign') }
  }

  async function toggleTask(t) {
    try { await db.toggleTask(t.id, !t.done); await load(); await refresh() }
    catch (e) { flash(e?.message || 'Failed') }
  }

  async function removeTask(t) {
    try { await db.deleteTask(t.id); await load(); await refresh() }
    catch (e) { flash(e?.message || 'Failed') }
  }

  if (loading) return <div className="empty">Loading…</div>
  if (!job) return <div className="empty">Job not found.</div>

  const notes = [...(job.notes || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
  const tasks = [...(job.tasks || [])].sort((a, b) => Number(a.done) - Number(b.done))
  const d = draft
  const today = laToday()

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
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </span>
          <button
            className={`btn btn-sm ${job.needs_attention ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => toggleFlag('needs_attention')}
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
              <div className="job-detail-row"><span className="job-detail-label">🧰 Subs</span><span className="job-detail-value">{
                (job.subcontractor_names && job.subcontractor_names.length > 0)
                  ? job.subcontractor_names.join(', ')
                  : (job.subcontractors || '—')
              }</span></div>
              <div className="job-detail-row"><span className="job-detail-label">🔑 Access</span><span className="job-detail-value">{job.access_info || '—'}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">📝 Notes</span><span className="job-detail-value">{job.crew_access || '—'}</span></div>
            </div>
            <div className="job-details-col">
              <div className="job-detail-row"><span className="job-detail-label">🏢 Client</span><span className="job-detail-value">{job.management_company || '—'}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">👤 Manager</span><span className="job-detail-value">{job.unit_manager || '—'}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">🔧 Vine Tech</span><span className="job-detail-value">{
                (job.main_techs && job.main_techs.length > 0)
                  ? job.main_techs.join(', ')
                  : (job.main_tech || '—')
              }</span></div>
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
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
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

      {/* tasks — two columns: list on left (scrolls past 3), form on right */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Tasks</h2>
        <div className="hint" style={{ marginBottom: 12 }}>{USERS_NOTE}</div>

        <div className="split-pane">
          {/* LEFT: task list */}
          <div className="split-pane-left">
            {tasks.length === 0 && <div className="hint">No tasks yet.</div>}
            <div className={`tasks-list ${tasks.length >= 3 ? 'tasks-list-scroll' : ''}`}>
              {tasks.map((t) => (
                <div key={t.id} className="task-row">
                  <div className="task-line" style={{ borderTop: 'none', padding: 0 }}>
                    <button className={`task-check ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t)}>
                      {t.done ? '✓' : ''}
                    </button>
                    <span className={`task-text ${t.done ? 'done' : ''}`} style={{ flex: 1 }}>
                      {t.text}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeTask(t)}>✕</button>
                  </div>
                  <div className="task-meta-row">
                    <select
                      className="task-assignee-select"
                      value={t.assigned_user_id || ''}
                      onChange={(e) => changeAssignee(t.id, e.target.value)}
                      title="Assigned to"
                    >
                      {team.length === 0 && <option value="">{t.assigned_name || 'Unassigned'}</option>}
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                    {/* Compact icon-only date input — CSS hides the date
                        text and keeps only the calendar picker button. */}
                    <input
                      type="date"
                      className="task-date-icon"
                      value={t.due_date || ''}
                      onChange={(e) => changeTaskDue(t.id, e.target.value)}
                      title={t.due_date ? `Shows ${formatDate(t.due_date)}` : 'Set due date'}
                    />
                    {t.due_date && t.due_date > today && (
                      <span className="badge badge-soft" style={{ fontSize: 11 }}>
                        {formatDate(t.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {tasks.length >= 3 && (
              <div className="hint" style={{ marginTop: 8, fontSize: 12 }}>
                Scroll inside the box above — {tasks.length} tasks.
              </div>
            )}
          </div>

          {/* RIGHT: add-task form */}
          <div className="split-pane-right">
            <label>New task</label>
            <textarea
              className="task-add-text"
              placeholder="Describe the task…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addTask() }}
              rows={3}
            />
            <label style={{ marginTop: 12 }}>Assign to</label>
            <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === user.id ? `Me (${m.full_name})` : m.full_name}
                </option>
              ))}
            </select>
            <label style={{ marginTop: 12 }}>Due date (optional)</label>
            <input
              type="date"
              value={newTaskDue}
              onChange={(e) => setNewTaskDue(e.target.value)}
            />
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={addTask}>
              Push to planner
            </button>
            <div className="hint" style={{ marginTop: 8, fontSize: 12 }}>
              Optional date hides the task until that day. Leave blank to show immediately.
            </div>
          </div>
        </div>
      </div>

      {/* notes — two columns: scrollable list on left, add-note form on right */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Notes & updates</h2>
        <div className="hint" style={{ marginBottom: 12 }}>
          Notes are timestamped and cannot be edited. The author can delete their own message within 24 hours.
        </div>

        <div className="split-pane">
          {/* LEFT: notes list */}
          <div className="split-pane-left">
            <div className={`notes-list ${notes.length >= 3 ? 'notes-list-scroll' : ''}`}>
              {notes.length === 0 && <div className="hint">No notes yet.</div>}
              {notes.map((n) => {
                const isDeleted = !!n.deleted_at
                const isAuthor = n.author_id === user.id
                const ageHours = (Date.now() - new Date(n.created_at).getTime()) / 3_600_000
                const canDelete = isAuthor && !isDeleted && ageHours < 24
                return (
                  <div key={n.id} className={`note ${isDeleted ? 'note-deleted' : ''}`}>
                    <div className="note-head">
                      <span className="note-author">{n.author_name}</span>
                      <span className="note-time">{formatTimestamp(n.created_at)}</span>
                    </div>
                    <div className="note-body">{n.body}</div>
                    {canDelete && (
                      <button
                        className="btn btn-ghost btn-sm note-delete-btn"
                        onClick={() => deleteNote(n.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {notes.length >= 3 && (
              <div className="hint" style={{ marginTop: 8, fontSize: 12 }}>
                Scroll inside the box above — {notes.length} messages.
              </div>
            )}
          </div>

          {/* RIGHT: add-note form */}
          <div className="split-pane-right">
            <label>Add a note</label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add an update…"
              rows={5}
            />
            <button className="btn btn-accent btn-block" style={{ marginTop: 10 }} onClick={postNote}>
              Add note
            </button>
          </div>
        </div>
      </div>

      {/* schedule — moved to the bottom of the page per latest design */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Schedule</h2>
        <div className="hint" style={{ marginBottom: 12 }}>
          {job.start_date
            ? `Currently ${formatDate(job.start_date)}${job.end_date ? ` – ${formatDate(job.end_date)}` : ''}.`
            : 'Not yet scheduled.'}
        </div>
        <div className="date-pair">
          <div>
            <label>Scheduled start</label>
            <input type="date" value={sched.start_date}
              onChange={(e) => setSched((s) => ({ ...s, start_date: e.target.value }))} />
          </div>
          <div>
            <label>Scheduled end</label>
            <input type="date" value={sched.end_date}
              onChange={(e) => setSched((s) => ({ ...s, end_date: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-accent btn-sm" style={{ marginTop: 12 }} onClick={saveSchedule}>
          Save schedule
        </button>
      </div>

      {/* property history */}
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
    </>
  )
}
