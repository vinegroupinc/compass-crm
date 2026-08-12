import { createClient } from '@supabase/supabase-js'

// Credentials come ONLY from environment variables (Netlify build settings).
// Nothing is hardcoded. See README for setup.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaces a clear message during local dev / preview if env vars are missing.
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Clock-skew tolerant fetch wrapper
//
// When a user's computer clock is slightly ahead of real time, Supabase rejects
// tokens with a "JWT issued at future" error. This wrapper catches that specific
// error (and a couple of related ones) and silently retries the request after a
// short delay. By the time the retry runs, the clock skew has usually resolved
// itself. The user sees nothing.
//
// Only these specific auth-related errors are retried. Everything else is passed
// through untouched.
// ─────────────────────────────────────────────────────────────────────────────

const RETRYABLE_MESSAGES = [
  'JWT issued at future',
  'jwt issued at future',
  'token used before issued',
]

async function retryingFetch(input, init) {
  const MAX_RETRIES = 3
  const DELAY_MS = 1500

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(input, init)

    // Only inspect responses that look like auth failures
    if (response.status !== 401 && response.status !== 400) {
      return response
    }

    // Peek at the response body without consuming it — we need to return
    // it intact if we decide not to retry
    const cloned = response.clone()
    let bodyText = ''
    try { bodyText = await cloned.text() } catch { /* ignore */ }

    const isRetryable = RETRYABLE_MESSAGES.some((msg) =>
      bodyText.toLowerCase().includes(msg.toLowerCase())
    )

    if (!isRetryable || attempt === MAX_RETRIES) {
      return response
    }

    // Wait, then loop and try the request again
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  global: {
    fetch: retryingFetch,
  },
})
