import { STATUS_COLORS } from '../lib/constants'

// Logo. Two flavors:
//  - 'full' (default): the full logo.jpg with COMPASS wordmark, for login screen
//  - 'header': the C-only logo for the top bar inside the app
export function Logo({ variant = 'full', className = '', style = {} }) {
  const isFull = variant !== 'header'
  const src = isFull ? '/logo.jpg' : '/logo-header.png'
  const alt = isFull ? 'Compass — a Vine Group company' : 'Compass'

  // Small deterrent against casual right-click-save on the sign-in logo.
  // Note: this doesn't stop anyone determined (dev tools, screenshots, direct
  // URL still work) — it just discourages accidental saving.
  const guardProps = isFull
    ? {
        onContextMenu: (e) => e.preventDefault(),
        onDragStart: (e) => e.preventDefault(),
        draggable: false,
        style: {
          ...style,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          pointerEvents: 'auto',
        },
      }
    : { style }

  return (
    <img
      src={src}
      alt={alt}
      className={`logo ${className}`}
      {...guardProps}
    />
  )
}

export function StatusBadge({ status }) {
  return (
    <span className="badge" style={{ background: STATUS_COLORS[status] || '#6b7280' }}>
      {status}
    </span>
  )
}

export function Toast({ message }) {
  if (!message) return null
  return <div className="toast">{message}</div>
}

export function Modal({ children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fade-up" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
