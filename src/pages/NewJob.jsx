import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import * as db from '../lib/db'
import { JOB_TYPES, STATUSES } from '../lib/constants'
import { Toast } from '../components/UI'
import { ContactMultiSelect } from '../components/ContactMultiSelect'

// A single-select that includes an inline "+ Add new…" option for clients.
function ClientSelect({ value, onChange, options, onAdd }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const name = text.trim()
    if (!name) return
    setBusy(true)
    try { await onAdd(name); onChange(name); setText(''); setAdding(false) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <label>Client (Management Company)</label>
      {!adding ? (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === '__add__') { setAdding(true); return }
            onChange(e.target.value)
          }}
        >
          <option value="">— Select —</option>
          {options.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          <option value="__add__">+ Add new client…</option>
        </select>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <input autoFocus placeholder="New client name" value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), save())} />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setText('') }}>✕</button>
        </div>
      )}
    </div>
  )
}

export default function NewJob() {
  const navigate = useNavigate()
  const { clients, technicians, subcontractors, refresh } = useData()
  const { user } = useAuth()
  const [addresses, setAddresses] = useState([])
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    street_address: '',
    unit: '',
    management_company: '',
    unit_manager: '',
    job_type: 'Turn',
    start_date: '',
    end_date: '',
    main_techs: [],          // array of names
    subcontractor_names: [], // array of names
    access_info: '',
    crew_access: '',
    status: 'New Lead',
    needs_attention: false,
  })

  useEffect(() => {
    db.getKnownAddresses().then(setAddresses).catch(() => {})
  }, [])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function addClient(name) {
    await db.addContact({ name, is_client: true })
    await refresh()
  }
  async function addTechnician(name) {
    await db.addContact({ name, is_technician: true })
    await refresh()
  }
  async function addSub(name) {
    await db.addContact({ name, is_subcontractor: true })
    await refresh()
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.street_address.trim()) { setToast('Street address is required'); return }
    setBusy(true)
    try {
      // We also write the legacy main_tech / subcontractors text fields so
      // anything that still reads them keeps working. Source of truth is the
      // new arrays.
      const job = await db.createJob({
        street_address: form.street_address.trim(),
        unit: form.unit.trim() || null,
        management_company: form.management_company,
        unit_manager: form.unit_manager,
        job_type: form.job_type,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        main_techs: form.main_techs,
        main_tech: form.main_techs.join(', ') || null, // legacy mirror
        subcontractor_names: form.subcontractor_names,
        subcontractors: form.subcontractor_names.join(', ') || null, // legacy mirror
        access_info: form.access_info,
        crew_access: form.crew_access,
        status: form.status,
        needs_attention: form.needs_attention,
      })
      // Seed the Notes & Updates log with access info and initial notes.
      const access = (form.access_info || '').trim()
      const notes = (form.crew_access || '').trim()
      if (access) await db.addNote(job.id, `Access information: ${access}`, user.id, user.name)
      if (notes) await db.addNote(job.id, notes, user.id, user.name)
      await refresh()
      navigate(`/job/${job.id}`)
    } catch (err) {
      setToast(err?.message || 'Could not save job')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head"><h1>New Job</h1></div>
      <form className="card-pad" onSubmit={submit}>
        <div className="form-grid">
          <div className="field-full">
            <label>Property address (street) *</label>
            <input
              list="known-addresses"
              value={form.street_address}
              onChange={(e) => set('street_address', e.target.value)}
              placeholder="123 Maple Ave"
              required
            />
            <datalist id="known-addresses">
              {addresses.map((a) => <option key={a} value={a} />)}
            </datalist>
            <div className="hint">Property history groups by this street address. Keep unit number separate below.</div>
          </div>

          <div>
            <label>Unit # (optional)</label>
            <input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. 4B" />
          </div>

          <div>
            <label>Job type</label>
            <select value={form.job_type} onChange={(e) => set('job_type', e.target.value)}>
              {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <ClientSelect
            value={form.management_company}
            onChange={(v) => set('management_company', v)}
            options={clients}
            onAdd={addClient}
          />

          <div>
            <label>Manager</label>
            <input value={form.unit_manager} onChange={(e) => set('unit_manager', e.target.value)} placeholder="Name" />
          </div>

          <div className="field-full">
            <ContactMultiSelect
              label="Vine Tech"
              hint="Search and select one or more Vine Techs. Add a new tech if not in the list."
              value={form.main_techs}
              onChange={(v) => set('main_techs', v)}
              options={technicians}
              onAddNew={addTechnician}
              placeholder="Search or add a Vine Tech…"
            />
          </div>

          <div>
            <label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label>Scheduled start</label>
            <input type="date" value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)} />
          </div>
          <div>
            <label>Scheduled end</label>
            <input type="date" value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)} />
          </div>

          <div className="field-full">
            <ContactMultiSelect
              label="Subcontractor(s)"
              hint="Search and select one or more subs. Add a new sub if not in the list."
              value={form.subcontractor_names}
              onChange={(v) => set('subcontractor_names', v)}
              options={subcontractors}
              onAddNew={addSub}
              placeholder="e.g. Zahava Electrical, Lubov Plumbing"
            />
          </div>

          <div className="field-full">
            <label>Access Information</label>
            <textarea value={form.access_info} onChange={(e) => set('access_info', e.target.value)}
              placeholder="Lockbox code, gate code, parking, where to find keys…" />
          </div>

          <div className="field-full">
            <label>Notes</label>
            <textarea value={form.crew_access} onChange={(e) => set('crew_access', e.target.value)}
              placeholder="Scope, tenant contact information, additional notes…" />
          </div>

          <div className="field-full">
            <label className="row" style={{ marginBottom: 0, gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 22, height: 22, minHeight: 'auto' }}
                checked={form.needs_attention} onChange={(e) => set('needs_attention', e.target.checked)} />
              ⚠ Needs Attention
            </label>
          </div>
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn btn-accent btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Create Job'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
      <Toast message={toast} />
    </>
  )
}
