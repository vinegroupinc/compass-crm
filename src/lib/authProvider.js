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
    // An invited user who has never signed in won't have last_sign_in_at set.
    // We force them through the set-password flow before they can use the app.
    // Recovery (password reset) sessions are detected separately via URL hash
    // in App.jsx, and won't have this flag because the user has previous logins.
    const neverSignedIn = !u.last_sign_in_at
    return {
      id: u.id,
      email: u.email,
      name:
        u.user_metadata?.full_name ||
        u.email?.split('@')[0] ||
        'User',
      needsPasswordSetup: neverSignedIn,
    }
  },
}
