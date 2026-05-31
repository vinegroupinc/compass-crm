import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import * as db from '../lib/db'
import { logActivity } from '../lib/activityLog'
import { JOB_TYPES, STATUSES } from '../lib/constants'
import { Toast } from '../components/UI'
import { ContactMultiSelect } from '../components/ContactMultiSelect'
import { AddressAutocomplete } from '../components/AddressAutocomplete'

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
    no_unit: false,
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
    if (!form.no_unit && !form.unit.trim()) {
      setToast('Enter a unit number, or check “No Unit #”'); return
    }
    setBusy(true)
    try {
      // We also write the legacy main_tech / subcontractors text fields so
      // anything that still reads them keeps working. Source of truth is the
      // new arrays.
      const job = await db.createJob({
        street_address: form.street_address.trim(),
        unit: form.no_unit ? null : (form.unit.trim() || null),
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
        needs_attention: false,
      })
      await refresh()
      logActivity({
        kind: 'job_created',
        actor: user,
        targetKind: 'job',
        targetId: job.id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
        payload: { status: job.status, job_type: job.job_type },
      })
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
            <label>Property address *</label>
            <AddressAutocomplete
              value={form.street_address}
              onChange={(v) => set('street_address', v)}
              knownAddresses={addresses}
              placeholder="1253 Vine St Los Angeles, CA 90038"
            />
            <div className="hint" style={{ color: 'var(--attention)', fontWeight: 700 }}>
              DO NOT PUT UNIT NUMBER ON PROPERTY ADDRESS LINE!
            </div>
          </div>

          <div className="field-full unit-row">
            <label className="unit-row-check" title="Check if this property has no unit number">
              <input
                type="checkbox"
                checked={form.no_unit}
                onChange={(e) => {
                  const checked = e.target.checked
                  setForm((f) => ({ ...f, no_unit: checked, unit: checked ? '' : f.unit }))
                }}
              />
              <span>No Unit #</span>
            </label>
            <div>
              <label>Unit # {form.no_unit ? '' : '*'}</label>
              <input
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder={form.no_unit ? 'Not applicable' : 'e.g. 4B'}
                disabled={form.no_unit}
              />
            </div>
            <div>
              <label>Job type</label>
              <select value={form.job_type} onChange={(e) => set('job_type', e.target.value)}>
                {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
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

          <div>
            <label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={s === 'Closed' || s === 'No-Sale'}
                >
                  {s}{(s === 'Closed' || s === 'No-Sale') ? ' — set via Close Job after creation' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field-full date-pair">
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
