import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/UI'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (e) {
      setErr(e?.message || 'Sign in failed. Check your email and password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card fade-up">
        <div className="login-logo">
          <Logo />
        </div>
        {/* method/action/name help browser password managers (Chrome etc.) detect this as a real login */}
        <form onSubmit={submit} method="post" action="#" name="signin" autoComplete="on">
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="current-password">Password</label>
            <input
              id="current-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && (
            <div style={{ color: 'var(--attention)', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
              {err}
            </div>
          )}
          <div style={{ textAlign: 'right', marginBottom: 14 }}>
            <Link to="/forgot" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              Forgot password?
            </Link>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="hint" style={{ textAlign: 'center', marginTop: 18, fontSize: 11, lineHeight: 1.5 }}>
          Internal use only by Vine Group Inc and its subsidiaries.
          <br />
          Accounts are managed by <a href="mailto:IT@vinegroupinc.com" style={{ color: 'var(--accent)' }}>IT@vinegroupinc.com</a>
        </p>
      </div>
    </div>
  )
}
