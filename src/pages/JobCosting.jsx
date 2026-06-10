import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as db from '../lib/db'
import { logActivity } from '../lib/activityLog'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, Toast, Modal } from '../components/UI'
import { formatTimestamp } from '../lib/time'

// Generate a short id for line items so React keys stay stable
function nid() {
  return Math.random().toString(36).slice(2, 10)
}

function money(n) {
  if (n == null || isNaN(n)) return '$0.00'
  const num = Number(n)
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const BUCKETS = [
  { key: 'materials', label: 'Materials' },
  { key: 'subs',      label: 'Subs' },
  { key: 'labor',     label: 'Labor' },
]

export default function JobCosting() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [job, setJob] = useState(null)
  const [costing, setCosting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')

  // Edit modal state — works for both line items and change orders
  const [editing, setEditing] = useState(null)
  // editing shape:
  //   { kind: 'line', bucket: 'materials', index: 0|null, draft: {description, amount} }
  //   { kind: 'co',                       index: 0|null, draft: {description, amount, bucket} }

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 2000) }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [j, c] = await Promise.all([db.getJob(id), db.getJobCosting(id)])
        if (cancelled) return
        setJob(j)
        setCosting(c)
      } catch (e) {
        flash(e?.message || 'Could not load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // Live totals
  const totals = useMemo(() => {
    if (!costing) return null
    const sum = (arr) => (arr || []).reduce((s, it) => s + (Number(it.amount) || 0), 0)
    const materialsTotal = sum(costing.materials)
    const subsTotal      = sum(costing.subs)
    const laborTotal     = sum(costing.labor)
    // Change orders are applied to whichever bucket they belong to. They can
    // be positive or negative. They roll up into the grand total.
    const coByBucket = { materials: 0, subs: 0, labor: 0 }
    for (const co of (costing.change_orders || [])) {
      const b = co.bucket || 'materials'
      coByBucket[b] = (coByBucket[b] || 0) + (Number(co.amount) || 0)
    }
    const grand = materialsTotal + subsTotal + laborTotal
      + coByBucket.materials + coByBucket.subs + coByBucket.labor
    const invoice = Number(costing.invoice) || 0
    const profit = invoice - grand
    const margin = invoice > 0 ? (profit / invoice) * 100 : null
    return {
      materialsTotal, subsTotal, laborTotal,
      coByBucket,
      grand, invoice, profit, margin,
    }
  }, [costing])

  // ── Mutators (they only update local state; nothing hits Supabase until Save) ──
  function setInvoice(v) {
    setCosting((c) => ({ ...c, invoice: v }))
    setDirty(true)
  }
  function upsertLine(bucket, index, draft) {
    setCosting((c) => {
      const next = { ...c }
      const arr = [...(next[bucket] || [])]
      const item = {
        id: index == null ? nid() : (arr[index]?.id || nid()),
        description: draft.description,
        amount: Number(draft.amount) || 0,
      }
      if (index == null) arr.push(item)
      else arr[index] = item
      next[bucket] = arr
      return next
    })
    setDirty(true)
  }
  function deleteLine(bucket, index) {
    if (!confirm('Delete this line item?')) return
    setCosting((c) => {
      const next = { ...c }
      next[bucket] = (next[bucket] || []).filter((_, i) => i !== index)
      return next
    })
    setDirty(true)
  }
  function upsertCO(index, draft) {
    setCosting((c) => {
      const next = { ...c }
      const arr = [...(next.change_orders || [])]
      const item = {
        id: index == null ? nid() : (arr[index]?.id || nid()),
        description: draft.description,
        amount: Number(draft.amount) || 0,
        bucket: draft.bucket || 'materials',
        created_at: index == null ? new Date().toISOString() : (arr[index]?.created_at || new Date().toISOString()),
      }
      if (index == null) arr.push(item)
      else arr[index] = item
      next.change_orders = arr
      return next
    })
    setDirty(true)
  }
  function deleteCO(index) {
    if (!confirm('Delete this change order?')) return
    setCosting((c) => ({ ...c, change_orders: (c.change_orders || []).filter((_, i) => i !== index) }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await db.saveJobCosting(id, costing, user)
      setDirty(false)
      logActivity({
        kind: 'costing_updated',
        actor: user,
        targetKind: 'job',
        targetId: id,
        targetLabel: `${job.street_address}${job.unit ? ' · Unit ' + job.unit : ''}`,
        note: totals
          ? `Invoice ${money(totals.invoice)} · Costs ${money(totals.grand)} · Profit ${money(totals.profit)}`
          : null,
      })
      flash('Costing saved')
    } catch (e) {
      flash(e?.message || 'Could not save')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="empty">Loading…</div>
  if (!job) return <div className="empty">Job not found.</div>

  return (
    <>
      {/* Header — read-only context, not for editing job fields */}
      <div className="page-head">
        <div>
          <Link to={`/job/${id}`} className="hint" style={{ textDecoration: 'none' }}>← Back to job</Link>
          <h1 style={{ marginTop: 4 }}>
            {job.street_address}{job.unit ? <span style={{ color: 'var(--ink-faint)' }}> · Unit {job.unit}</span> : null}
          </h1>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 6 }}>
            <StatusBadge status={job.status} />
            {job.job_number && <span className="job-id-pill" style={{ cursor: 'default' }}>Job ID #C{job.job_number}</span>}
          </div>
        </div>
        <button className="btn btn-accent" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : (dirty ? 'Save changes' : 'Saved')}
        </button>
      </div>

      {/* Summary card */}
      <div className="costing-summary">
        <SummaryStat label="Materials"  value={money(totals.materialsTotal + totals.coByBucket.materials)} />
        <SummaryStat label="Subs"       value={money(totals.subsTotal      + totals.coByBucket.subs)} />
        <SummaryStat label="Labor"      value={money(totals.laborTotal     + totals.coByBucket.labor)} />
        <SummaryStat label="Total Cost" value={money(totals.grand)} strong />
        <SummaryStat label="Invoice"    value={money(totals.invoice)} strong />
        <SummaryStat
          label="Profit"
          value={money(totals.profit)}
          strong
          color={totals.profit >= 0 ? '#16a34a' : '#dc2626'}
        />
        <SummaryStat
          label="Margin"
          value={totals.margin == null ? '—' : `${totals.margin.toFixed(1)}%`}
          color={totals.margin == null ? undefined : (totals.margin >= 0 ? '#16a34a' : '#dc2626')}
        />
      </div>

      {/* Invoice */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Invoice amount</h2>
        <div className="hint" style={{ marginBottom: 10 }}>
          What you're billing the client. Profit = invoice − all costs (including change orders).
        </div>
        <div style={{ maxWidth: 260 }}>
          <label>Invoice ($)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={costing.invoice ?? ''}
            onChange={(e) => setInvoice(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Three buckets */}
      {BUCKETS.map((b) => (
        <BucketCard
          key={b.key}
          title={b.label}
          items={costing[b.key] || []}
          onAdd={() => setEditing({ kind: 'line', bucket: b.key, index: null, draft: { description: '', amount: '' } })}
          onEdit={(i) => setEditing({ kind: 'line', bucket: b.key, index: i, draft: { ...costing[b.key][i] } })}
          onDelete={(i) => deleteLine(b.key, i)}
        />
      ))}

      {/* Change orders */}
      <div className="card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Change orders</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ kind: 'co', index: null, draft: { description: '', amount: '', bucket: 'materials' } })}>+ Add</button>
        </div>
        <div className="hint" style={{ marginTop: 4, marginBottom: 12 }}>
          Additions or subtractions after the original budget. Use negative amounts for subtractions.
        </div>
        {(costing.change_orders || []).length === 0 ? (
          <div className="hint">No change orders.</div>
        ) : (
          (costing.change_orders || []).map((co, i) => (
            <div key={co.id || i} className="costing-row">
              <div className="costing-row-main">
                <div className="costing-row-desc">{co.description || '(no description)'}</div>
                <div className="hint" style={{ fontSize: 12, marginTop: 2 }}>
                  {BUCKETS.find((b) => b.key === co.bucket)?.label || 'Materials'}
                  {co.created_at ? ` · ${formatTimestamp(co.created_at)}` : ''}
                </div>
              </div>
              <div className={`costing-row-amount ${Number(co.amount) < 0 ? 'neg' : ''}`}>
                {money(co.amount)}
              </div>
              <div className="costing-row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ kind: 'co', index: i, draft: { ...co } })}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteCO(i)}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sticky save bar at the bottom when there are unsaved changes */}
      {dirty && (
        <div className="costing-save-bar">
          <span>Unsaved changes</span>
          <button className="btn btn-accent btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if (editing.kind === 'line') upsertLine(editing.bucket, editing.index, draft)
            else upsertCO(editing.index, draft)
            setEditing(null)
          }}
        />
      )}

      <Toast message={toast} />
    </>
  )
}

function SummaryStat({ label, value, strong, color }) {
  return (
    <div className="costing-stat">
      <div className="costing-stat-label">{label}</div>
      <div className={`costing-stat-value ${strong ? 'strong' : ''}`} style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  )
}

function BucketCard({ title, items, onAdd, onEdit, onDelete }) {
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  return (
    <div className="card-pad" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
          <div className="hint" style={{ marginTop: 2 }}>Subtotal {money(total)}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onAdd}>+ Add</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {items.length === 0 ? (
          <div className="hint">No items yet.</div>
        ) : (
          items.map((it, i) => (
            <div key={it.id || i} className="costing-row">
              <div className="costing-row-main">
                <div className="costing-row-desc">{it.description || '(no description)'}</div>
              </div>
              <div className={`costing-row-amount ${Number(it.amount) < 0 ? 'neg' : ''}`}>
                {money(it.amount)}
              </div>
              <div className="costing-row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(i)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(i)}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EditModal({ editing, onClose, onSave }) {
  const [desc, setDesc] = useState(editing.draft.description || '')
  const [amt, setAmt]   = useState(editing.draft.amount ?? '')
  const [bucket, setBucket] = useState(editing.draft.bucket || 'materials')
  const isCO  = editing.kind === 'co'
  const isNew = editing.index == null
  return (
    <Modal onClose={onClose}>
      <h3>{isNew ? 'Add ' : 'Edit '}{isCO ? 'change order' : 'line item'}</h3>
      <label style={{ marginTop: 12 }}>Description</label>
      <input
        autoFocus
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="What is it?"
      />
      <label style={{ marginTop: 12 }}>
        {isCO ? 'Amount ($) — use negative to subtract' : 'Amount ($)'}
      </label>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        placeholder="0.00"
      />
      {isCO && (
        <>
          <label style={{ marginTop: 12 }}>Which bucket does this affect?</label>
          <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
            {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </>
      )}
      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="btn btn-accent btn-block"
          onClick={() => onSave({ description: desc.trim(), amount: amt, bucket })}
        >Save</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
