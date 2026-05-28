import { STATUS_COLORS } from '../lib/constants'

export function LogoChip({ className = '' }) {
  return (
    <span className={`logo-chip ${className}`}>
      <img src="/logo.png" alt="Compass" />
    </span>
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
