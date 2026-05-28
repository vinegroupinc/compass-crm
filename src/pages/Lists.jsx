import { useState } from 'react'
import { useData } from '../context/DataContext'
import * as db from '../lib/db'
import { Toast } from '../components/UI'

function ListManager({ title, kind, items, onChange }) {
  const [adding, setAdding] = useState('')
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!adding.trim()) return
    setBusy(true)
    try { await db.addListItem(kind, adding); setAdding(''); await onChange() }
    finally { setBusy(false) }
  }
  async function save(id) {
    await db.updateListItem(id, editVal); setEditId(null); await onChange()
  }
  async function remove(id) {
    await db.deleteListItem(id); await onChange()
  }

  return (
    <div className="card-pad" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{title}</h2>
      {items.length === 0 && <div className="hint" style={{ marginBottom: 10 }}>Nothing here yet.</div>}
      {items.map((it) => (
        <div className="list-item" key={it.id}>
          {editId === it.id ? (
            <>
              <input value={editVal} onChange={(e) => setEditVal(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={() => save(it.id)}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>✕</button>
            </>
          ) : (
            <>
              <span className="name">{it.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(it.id); setEditVal(it.name) }}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(it.id)}>Delete</button>
            </>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <input placeholder={`Add ${title.toLowerCase()}…`} value={adding}
          onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-accent" disabled={busy} onClick={add}>Add</button>
      </div>
    </div>
  )
}

export default function Lists() {
  const { mgmtList, techList, refresh, loading } = useData()
  const [toast] = useState('')
  if (loading) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Saved Lists</h1>
          <div className="hint">These feed the dropdowns on the job form.</div>
        </div>
      </div>
      <ListManager title="Management Companies" kind="management_company" items={mgmtList} onChange={refresh} />
      <ListManager title="Techs" kind="tech" items={techList} onChange={refresh} />
      <Toast message={toast} />
    </>
  )
}
