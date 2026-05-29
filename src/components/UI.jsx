import { STATUS_COLORS } from '../lib/constants'

// Logo. Two flavors:
//  - 'full' (default): the full logo.png with COMPASS wordmark, for login screen
//  - 'header': the C-only logo for the top bar inside the app
export function Logo({ variant = 'full', className = '', style = {} }) {
  const src = variant === 'header' ? '/logo-header.png' : '/logo.png'
  const alt = variant === 'header' ? 'Compass' : 'Compass — a Vine Group company'
  return <img src={src} alt={alt} className={`logo ${className}`} style={style} />
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
