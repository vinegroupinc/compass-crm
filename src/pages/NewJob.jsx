import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import * as db from '../lib/db'
import { JOB_TYPES, STATUSES } from '../lib/constants'
import { Toast } from '../components/UI'

// A select that includes an inline "+ Add new…" option. Picking it reveals a
// small text box; saving adds the item to the shared list AND selects it.
function SelectWithAdd({ label, hint, value, onChange, items, onAdd, placeholder }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const name = text.trim()
    if (!name) return
    setBusy(true)
    try {
      await onAdd(name)     // persists to the list
      onChange(name)        // selects the new value
      setText('')
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label>{label}</label>
      {!adding ? (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === '__add__') { setAdding(true); return }
            onChange(e.target.value)
          }}
        >
          <option value="">— Select —</option>
          {items.map((it) => <option key={it.id} value={it.name}>{it.name}</option>)}
          <option value="__add__">+ Add new…</option>
        </select>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <input
            autoFocus
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), save())}
          />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setText('') }}>✕</button>
        </div>
      )}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export default function NewJob() {
  const navigate = useNavigate()
  const { mgmtList, techList, refresh } = useData()
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
    main_tech: '',
    subcontractors: '',
    crew_access: '',
    status: 'New Lead',
    needs_attention: false,
    high_priority: false,
  })

  useEffect(() => {
    db.getKnownAddresses().then(setAddresses).catch(() => {})
  }, [])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function addMgmt(name) {
    await db.addListItem('management_company', name)
    await refresh()
  }
  async function addTech(name) {
    await db.addListItem('tech', name)
    await refresh()
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.street_address.trim()) { setToast('Street address is required'); return }
    setBusy(true)
    try {
      const job = await db.createJob({
        ...form,
        street_address: form.street_address.trim(),
        unit: form.unit.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })
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

          <SelectWithAdd
            label="Management company"
            hint="Pick one or add a new company on the spot."
            value={form.management_company}
            onChange={(v) => set('management_company', v)}
            items={mgmtList}
            onAdd={addMgmt}
            placeholder="New company name"
          />

          <div>
            <label>Manager</label>
            <input value={form.unit_manager} onChange={(e) => set('unit_manager', e.target.value)} placeholder="Name" />
          </div>

          <SelectWithAdd
            label="Main tech"
            hint="Pick one or add a new tech on the spot."
            value={form.main_tech}
            onChange={(v) => set('main_tech', v)}
            items={techList}
            onAdd={addTech}
            placeholder="New tech name"
          />

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
            <label>Subcontractor(s)</label>
            <input value={form.subcontractors} onChange={(e) => set('subcontractors', e.target.value)}
              placeholder="e.g. Zahava Electrical, Lubov Plumbing" />
          </div>

          <div className="field-full">
            <label>Notes</label>
            <textarea value={form.crew_access} onChange={(e) => set('crew_access', e.target.value)}
              placeholder="Access information, tenant contact information, additional notes…" />
          </div>

          <div className="field-full">
            <div className="row row-wrap" style={{ gap: 18 }}>
              <label className="row" style={{ marginBottom: 0, gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 22, height: 22, minHeight: 'auto' }}
                  checked={form.needs_attention} onChange={(e) => set('needs_attention', e.target.checked)} />
                ⚠ Needs Attention
              </label>
              <label className="row" style={{ marginBottom: 0, gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 22, height: 22, minHeight: 'auto' }}
                  checked={form.high_priority} onChange={(e) => set('high_priority', e.target.checked)} />
                ★ High Priority
              </label>
            </div>
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
