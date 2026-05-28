import { STATUS_COLORS } from '../lib/constants'

// Single logo image (white background, black mark + wordmark), used as-is.
export function Logo({ className = '', style = {} }) {
  return <img src="/logo.png" alt="Compass — a Vine Group company" className={`logo ${className}`} style={style} />
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
