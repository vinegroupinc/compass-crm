import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Logo } from '../components/UI'
import { AuthFooter } from '../components/AuthFooter'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/set-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (e) {
      setErr(e?.message || 'Could not send reset email. Please try again.')
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
        {sent ? (
          <>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, textAlign: 'center', marginBottom: 10 }}>
              Check your email
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.55 }}>
              If an account exists for <strong>{email}</strong>, we just sent a password reset link.
              The link is good for one hour.
            </p>
            <Link to="/" className="btn btn-ghost btn-block" style={{ marginTop: 20 }}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, textAlign: 'center', marginBottom: 6 }}>
              Reset your password
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, marginBottom: 18 }}>
              Enter your email and we'll send you a link to set a new password.
            </p>
            <form onSubmit={submit} method="post" action="#">
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {err && (
                <div style={{ color: 'var(--attention)', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                  {err}
                </div>
              )}
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 18 }}>
              <Link to="/" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
      <AuthFooter />
    </div>
  )
}
