// authProvider.js
// A thin, swappable abstraction over the authentication backend.
// The rest of the app NEVER imports supabase for auth directly — it uses
// these functions. To swap providers later (Auth0, Cognito, Clerk, etc.),
// re-implement this file's exported functions and nothing else changes.

import { supabase } from './supabaseClient'

export const authProvider = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  onAuthChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session)
    })
    return () => data.subscription.unsubscribe()
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Returns a normalized user object the app understands, regardless of backend.
  normalizeUser(session) {
    if (!session?.user) return null
    const u = session.user

    // Detect "this user just used an invite link and has not yet set a password."
    // Supabase counts the link click as a sign-in, so we can't use
    // last_sign_in_at alone. But on an invite-link click, email_confirmed_at
    // and last_sign_in_at fire essentially simultaneously (same millisecond
    // tick on the server). On any real subsequent login, they'll differ by
    // far more than a few seconds. A 30-second window is generous and safe.
    let needsPasswordSetup = false
    if (u.email_confirmed_at && u.last_sign_in_at) {
      const confirmed = new Date(u.email_confirmed_at).getTime()
      const signedIn = new Date(u.last_sign_in_at).getTime()
      if (Math.abs(signedIn - confirmed) < 30_000) {
        needsPasswordSetup = true
      }
    }

    return {
      id: u.id,
      email: u.email,
      name:
        u.user_metadata?.full_name ||
        u.email?.split('@')[0] ||
        'User',
      needsPasswordSetup,
    }
  },
}
