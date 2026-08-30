import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Logo } from '../components/UI'
import { AuthFooter } from '../components/AuthFooter'

// This page handles BOTH:
//   - new user setting password from an invite email
//   - existing user resetting password from a recovery email
// Both flows arrive here with a temporary Supabase session, set by the link.
export default function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState(null) // null = checking, true/false

  useEffect(() => {
    // Supabase v2 places auth tokens from email links in the URL hash; the
    // client picks them up automatically and creates a temporary session.
    // We just need to confirm a session exists.
    let cancelled = false
    async function check() {
      // Allow a brief tick for supabase-js to parse the URL hash.
      await new Promise((r) => setTimeout(r, 200))
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setHasSession(!!data.session)
    }
    check()
    return () => { cancelled = true }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setErr('Passwords do not match.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // Sign them out so they go through a clean login with their new password.
      await supabase.auth.signOut()
      setDone(true)
      // Redirect to login after a brief success message.
      setTimeout(() => navigate('/', { replace: true }), 2000)
    } catch (e) {
      setErr(e?.message || 'Could not set password. The link may have expired — request a new one.')
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

        {done ? (
          <>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
              Password set
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>
              Taking you to sign in…
            </p>
          </>
        ) : hasSession === false ? (
          <>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
              Link expired or invalid
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, marginBottom: 18 }}>
              This link is no longer valid. Request a new reset email or contact your administrator.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/forgot')}>
              Request a new link
            </button>
          </>
        ) : hasSession === null ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Loading…</p>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, textAlign: 'center', marginBottom: 6 }}>
              Set your password
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14, marginBottom: 18 }}>
              Choose a password of at least 8 characters.
            </p>
            <form onSubmit={submit} method="post" action="#">
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {err && (
                <div style={{ color: 'var(--attention)', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                  {err}
                </div>
              )}
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Saving…' : 'Set password'}
              </button>
            </form>
          </>
        )}
      </div>
      <AuthFooter />
    </div>
  )
}
