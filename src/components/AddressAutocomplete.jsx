import { useEffect, useRef, useState } from 'react'
import { normalizeAddress } from '../lib/address'

/**
 * AddressAutocomplete
 *
 * Plain text input + suggestion dropdown. The dropdown is hidden by default
 * (clicking the field does NOT open it). It appears only after the user
 * types at least 2 characters, and shows any known addresses whose normalized
 * form contains the normalized query. Selecting a suggestion replaces the
 * input value with the original (canonical) address string already on file.
 *
 * Props:
 *   value, onChange — the controlled text value of the input
 *   knownAddresses  — string[] of every existing address (originals)
 *   placeholder
 */
export function AddressAutocomplete({ value, onChange, knownAddresses = [], placeholder }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Close when clicking outside.
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Build the suggestion list only when there's meaningful input.
  let suggestions = []
  if (value && value.trim().length >= 2) {
    const qKey = normalizeAddress(value)
    if (qKey) {
      suggestions = knownAddresses
        .filter((a) => {
          const k = normalizeAddress(a)
          return k && (k.includes(qKey) || qKey.includes(k))
        })
        // Don't suggest the exact-typed value as a "pick this"
        .filter((a) => a !== value)
        .slice(0, 8)
    }
  }

  const showMenu = open && suggestions.length > 0

  function pick(addr) {
    onChange(addr)
    setOpen(false)
  }

  return (
    <div className="address-ac" ref={wrapRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        // Notable: NO onFocus={setOpen(true)} — typing is what opens it.
        placeholder={placeholder}
        required
        autoComplete="off"
      />
      {showMenu && (
        <div className="address-ac-menu">
          <div className="address-ac-hint">Existing addresses matching what you typed:</div>
          {suggestions.map((a) => (
            <button
              key={a}
              type="button"
              className="address-ac-option"
              onClick={() => pick(a)}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
