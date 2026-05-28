import { useState } from 'react'
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
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Password</label>
            <input
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
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="hint" style={{ textAlign: 'center', marginTop: 18 }}>
          Internal use only. Accounts are managed by your administrator.
        </p>
      </div>
    </div>
  )
}
