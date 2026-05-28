import { createContext, useContext, useEffect, useState } from 'react'
import { authProvider } from '../lib/authProvider'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      try {
        const session = await authProvider.getSession()
        setUser(authProvider.normalizeUser(session))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
      unsub = authProvider.onAuthChange((session) => {
        setUser(authProvider.normalizeUser(session))
      })
    })()
    return () => unsub()
  }, [])

  const value = {
    user,
    loading,
    signIn: (email, password) => authProvider.signIn(email, password),
    signOut: () => authProvider.signOut(),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
