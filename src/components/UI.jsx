import { STATUS_COLORS } from '../lib/constants'

// variant: 'dark' renders the dark-ink mark (for light backgrounds like the
// header/login). 'white' renders the white mark (for dark backgrounds).
// No black box anymore — the mark sits directly on whatever is behind it.
export function Logo({ variant = 'dark', className = '', style = {} }) {
  const src = variant === 'white' ? '/logo-white.png' : '/logo-dark.png'
  return <img src={src} alt="Compass" className={`logo ${className}`} style={style} />
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
