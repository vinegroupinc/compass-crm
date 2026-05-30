import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Hardcoded admin credentials. Per the spec — the 3 users of Compass are
// all owners, and the Admin button is only visible when logged in, so this
// is treated as a "useful for owners, not a state secret" gate.
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'vc'

// We use sessionStorage (not localStorage) so admin access doesn't persist
// across browser restarts. Closing the tab signs you out of admin.
export const ADMIN_SESSION_KEY = 'compass_admin_session'
export function isAdmin() {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'
}
export function setAdmin(on) {
  if (on) sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
  else sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

export default function AdminLogin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Must be logged into Compass first — admin is an additional layer.
  if (!user) {
    return (
      <div className="empty">
        Please sign in to Compass first, then use the Admin link in the footer.
      </div>
    )
  }

  function submit(e) {
    e.preventDefault()
    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setAdmin(true)
      navigate('/admin')
    } else {
      setError('Incorrect username or password.')
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '40px auto' }}>
      <div className="card-pad">
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Admin</h1>
        <div className="hint" style={{ marginBottom: 16 }}>
          Owner access. Closes when you close the tab.
        </div>
        <form method="post" onSubmit={submit} autoComplete="off">
          <label>Username</label>
          <input
            name="admin_username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
          <label style={{ marginTop: 12 }}>Password</label>
          <input
            name="admin_password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          {error && (
            <div style={{ color: 'var(--attention)', fontSize: 13, marginTop: 10 }}>{error}</div>
          )}
          <button type="submit" className="btn btn-accent btn-block" style={{ marginTop: 16 }}>
            Sign in to admin
          </button>
        </form>
      </div>
    </div>
  )
}
