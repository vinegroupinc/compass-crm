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

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
