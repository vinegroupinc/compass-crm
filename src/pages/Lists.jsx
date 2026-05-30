import { useEffect, useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import * as db from '../lib/db'
import { logActivity } from '../lib/activityLog'
import { Toast, Modal } from '../components/UI'

function typeBadges(c) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {c.is_client && <span className="badge badge-soft" style={{ fontSize: 11 }}>Client</span>}
      {c.is_technician && <span className="badge badge-soft" style={{ fontSize: 11 }}>Technician</span>}
      {c.is_subcontractor && <span className="badge badge-soft" style={{ fontSize: 11 }}>Subcontractor</span>}
    </span>
  )
}

function AddContactModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [types, setTypes] = useState({ is_client: false, is_technician: false, is_subcontractor: false })
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return
    if (!types.is_client && !types.is_technician && !types.is_subcontractor) return
    setBusy(true)
    try {
      await onSave({ name: name.trim(), ...types })
      onClose()
    } finally { setBusy(false) }
  }

  const checked = (k) => types[k]
  const toggle = (k) => setTypes((t) => ({ ...t, [k]: !t[k] }))

  return (
    <Modal onClose={onClose}>
      <h3>New contact</h3>
      <div style={{ marginTop: 12 }}>
        <label>Name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
      </div>
      <div style={{ marginTop: 14 }}>
        <label>Type (select one or more)</label>
        <div className="row row-wrap" style={{ gap: 12, marginTop: 4 }}>
          {[
            ['is_client', 'Client'],
            ['is_technician', 'Technician'],
            ['is_subcontractor', 'Subcontractor'],
          ].map(([k, label]) => (
            <label key={k} className="row" style={{ marginBottom: 0, gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 22, height: 22, minHeight: 'auto' }}
                checked={checked(k)} onChange={() => toggle(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-accent btn-block" disabled={busy || !name.trim() || (!types.is_client && !types.is_technician && !types.is_subcontractor)} onClick={save}>
          {busy ? 'Saving…' : 'Save contact'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Same name already exists? Its types will be merged rather than duplicated.
      </p>
    </Modal>
  )
}

function EditContactModal({ contact, onClose, onSave, onDelete }) {
  const [name, setName] = useState(contact.name)
  const [types, setTypes] = useState({
    is_client: contact.is_client,
    is_technician: contact.is_technician,
    is_subcontractor: contact.is_subcontractor,
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await onSave(contact.id, { name: name.trim(), ...types })
      onClose()
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Delete ${contact.name}? Past jobs that reference this name will keep the name as text.`)) return
    setBusy(true)
    try {
      await onDelete(contact.id)
      onClose()
    } finally { setBusy(false) }
  }

  const toggle = (k) => setTypes((t) => ({ ...t, [k]: !t[k] }))

  return (
    <Modal onClose={onClose}>
      <h3>Edit contact</h3>
      <div style={{ marginTop: 12 }}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label>Type</label>
        <div className="row row-wrap" style={{ gap: 12, marginTop: 4 }}>
          {[
            ['is_client', 'Client'],
            ['is_technician', 'Technician'],
            ['is_subcontractor', 'Subcontractor'],
          ].map(([k, label]) => (
            <label key={k} className="row" style={{ marginBottom: 0, gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 22, height: 22, minHeight: 'auto' }}
                checked={types[k]} onChange={() => toggle(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-accent btn-block" disabled={busy || !name.trim()} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>Delete contact</button>
      </div>
    </Modal>
  )
}

function ContactDetailModal({ contact, jobs, onClose }) {
  return (
    <Modal onClose={onClose}>
      <h3>{contact.name}</h3>
      <div style={{ marginTop: 4, marginBottom: 14 }}>{typeBadges(contact)}</div>
      <div className="hint" style={{ marginBottom: 10 }}>
        {jobs.length === 0
          ? 'No jobs associated with this contact yet.'
          : `${jobs.length} job${jobs.length === 1 ? '' : 's'} found:`}
      </div>
      {jobs.map((j) => (
        <Link
          key={j.id}
          to={`/job/${j.id}`}
          onClick={onClose}
          className="list-item"
          style={{ textDecoration: 'none' }}
        >
          <div className="name">
            {j.street_address}{j.unit ? ` · Unit ${j.unit}` : ''}
            <div className="hint">{j.status} · {j.job_type}</div>
          </div>
        </Link>
      ))}
      <button className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: 12 }}>Close</button>
    </Modal>
  )
}

export default function Contacts() {
  const { contacts, refresh, loading } = useData()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)        // contact being edited
  const [detail, setDetail] = useState(null)          // { contact, jobs }
  const [toast, setToast] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return contacts
    return contacts.filter((c) => c.name.toLowerCase().includes(needle))
  }, [contacts, q])

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 2000) }

  async function openContact(c) {
    try {
      const jobs = await db.getJobsForContactName(c.name)
      setDetail({ contact: c, jobs })
    } catch (e) { flash(e?.message || 'Could not load jobs') }
  }

  async function saveNew(payload) {
    try {
      const created = await db.addContact(payload)
      logActivity({
        kind: 'contact_created',
        actor: user,
        targetKind: 'contact',
        targetId: created?.id,
        targetLabel: payload.name,
      })
      await refresh(); flash('Contact added')
    }
    catch (e) { flash(e?.message || 'Failed') }
  }

  async function saveEdit(id, patch) {
    try {
      await db.updateContact(id, patch)
      logActivity({
        kind: 'contact_updated',
        actor: user,
        targetKind: 'contact',
        targetId: id,
        targetLabel: patch.name || '(edited)',
      })
      await refresh(); flash('Saved')
    }
    catch (e) { flash(e?.message || 'Failed') }
  }

  async function removeContact(id) {
    const c = contacts.find((x) => x.id === id)
    try {
      await db.deleteContact(id)
      logActivity({
        kind: 'contact_deleted',
        actor: user,
        targetKind: 'contact',
        targetId: id,
        targetLabel: c?.name || '(unknown)',
      })
      await refresh(); flash('Deleted')
    }
    catch (e) { flash(e?.message || 'Failed') }
  }

  if (loading) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contacts</h1>
          <div className="hint">Clients, Technicians, and Subcontractors — all in one list.</div>
        </div>
        <button className="btn btn-accent" onClick={() => setAdding(true)}>+ New contact</button>
      </div>

      <input
        placeholder="Search by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 18 }}
      />

      {filtered.length === 0 && (
        <div className="empty">{contacts.length === 0 ? 'No contacts yet.' : `No contacts match “${q}”.`}</div>
      )}

      {filtered.map((c) => (
        <div key={c.id} className="list-item">
          <div className="name" style={{ cursor: 'pointer' }} onClick={() => openContact(c)}>
            {c.name}
            <div style={{ marginTop: 4 }}>{typeBadges(c)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => openContact(c)}>Jobs</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
        </div>
      ))}

      {adding && <AddContactModal onClose={() => setAdding(false)} onSave={saveNew} />}
      {editing && (
        <EditContactModal
          contact={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onDelete={removeContact}
        />
      )}
      {detail && (
        <ContactDetailModal
          contact={detail.contact}
          jobs={detail.jobs}
          onClose={() => setDetail(null)}
        />
      )}
      <Toast message={toast} />
    </>
  )
}
