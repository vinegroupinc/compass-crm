import { useEffect, useRef, useState } from 'react'

/**
 * ContactMultiSelect
 *
 * A searchable, multi-select input that displays selected values as removable
 * chips above an autocomplete field. If what's typed doesn't match any option,
 * an "+ Add 'whatever'" row appears so a new contact can be created on the fly.
 *
 * Props:
 *  - label, hint
 *  - value: string[] of currently-selected names
 *  - onChange(nextValues: string[])
 *  - options: array of { id, name } (the available contacts of this type)
 *  - onAddNew(name: string): called when the user picks the inline add option;
 *    should persist the contact and resolve when done.
 *  - placeholder
 */
export function ContactMultiSelect({
  label, hint, value, onChange, options, onAddNew, placeholder,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = options
    .filter((o) => !value.includes(o.name))
    .filter((o) => (q ? o.name.toLowerCase().includes(q) : true))
    .slice(0, 50)

  const exactMatch = options.some((o) => o.name.toLowerCase() === q)
  const showAddNew = q.length > 0 && !exactMatch && !value.includes(query.trim())

  function pick(name) {
    onChange([...value, name])
    setQuery('')
    // Stay open so users can keep adding without re-clicking.
  }

  function remove(name) {
    onChange(value.filter((v) => v !== name))
  }

  async function addNew() {
    if (busy) return
    const name = query.trim()
    if (!name) return
    setBusy(true)
    try {
      await onAddNew(name)
      onChange([...value, name])
      setQuery('')
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) {
        pick(filtered[0].name)
      } else if (showAddNew) {
        addNew()
      }
    }
  }

  return (
    <div className="multi-select" ref={wrapRef}>
      {label && <label>{label}</label>}
      {value.length > 0 && (
        <div className="chip-row">
          {value.map((v) => (
            <span key={v} className="chip">
              {v}
              <button type="button" className="chip-x" onClick={() => remove(v)} aria-label={`Remove ${v}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="multi-select-input-wrap">
        <input
          type="text"
          value={query}
          placeholder={placeholder || 'Search or add new…'}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {open && (filtered.length > 0 || showAddNew) && (
          <div className="multi-select-menu">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className="multi-select-option"
                onClick={() => pick(o.name)}
              >
                {o.name}
              </button>
            ))}
            {showAddNew && (
              <button
                type="button"
                className="multi-select-option multi-select-add"
                onClick={addNew}
                disabled={busy}
              >
                {busy ? 'Adding…' : `+ Add “${query.trim()}”`}
              </button>
            )}
          </div>
        )}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
