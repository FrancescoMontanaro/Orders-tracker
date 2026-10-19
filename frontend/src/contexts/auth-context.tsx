'use client'
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { api, authlessApi } from '@/lib/api-client'
import { setAccessToken, getAccessToken } from '@/lib/token'
import type { CurrentUser, UserRole } from '@/types/user'
import type { SuccessResponse } from '@/types/api'

type LoginInput = { username: string; password: string }

type AuthContextType = {
  isAuthenticated: boolean
  ready: boolean
  loading: boolean
  user: CurrentUser | null
  role: UserRole | null
  isAdmin: boolean
  login: (input: LoginInput) => Promise<CurrentUser | null>
  logout: () => Promise<void>
}

// Create authentication context
const AuthContext = createContext<AuthContextType | null>(null)

/**
 * fetchCurrentUser
 * Loads the authenticated profile (including the role) from the API.
 * Returns null when the profile cannot be retrieved.
 */
async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await api.get<SuccessResponse<CurrentUser>>('/auth/me')
    return data?.data ?? null
  } catch {
    return null
  }
}

/**
 * AuthProvider
 * Provides authentication state and actions to the app.
 * Handles login, logout, token refresh and the current user profile.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [ready, setReady] = useState(false) // gating for hydration

  // On mount, check for access token or try to refresh via cookie
  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const existing = getAccessToken()
        if (existing) {
          // Token in memory: resolve the profile before unblocking the UI, so
          // that role-based routing never runs with an unknown role
          const profile = await fetchCurrentUser()
          if (!cancelled) {
            if (profile) {
              setUser(profile)
              setAuthed(true)
            } else {
              // The token is no longer usable: drop it
              setAccessToken(null)
            }
            setReady(true)
          }
          return
        }

        // No access token: try to refresh using httpOnly cookie
        try {
          const { data } = await authlessApi.post<{ access_token: string; refresh_token?: string }>(
            '/auth/refresh',
            null
          )
          setAccessToken(data.access_token)

          const profile = await fetchCurrentUser()
          if (!cancelled) {
            if (profile) {
              setUser(profile)
              setAuthed(true)
            } else {
              setAccessToken(null)
            }
          }
        } catch {
          // Refresh failed: remain unauthenticated
        } finally {
          if (!cancelled) setReady(true)
        }
      } catch {
        if (!cancelled) setReady(true)
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * login
   * Authenticates user, stores access token and loads the profile.
   * Returns the profile so the caller can route by role.
   */
  async function login(input: LoginInput): Promise<CurrentUser | null> {
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.set('username', input.username)
      form.set('password', input.password)

      // Use authless instance to avoid interceptor issues
      const { data } = await authlessApi.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      setAccessToken(data.access_token)

      // Load the profile: the role drives which pages the user can reach
      const profile = await fetchCurrentUser()

      // Without a profile the role is unknown: fail the login instead of
      // dropping the user into a half-configured session
      if (!profile) {
        setAccessToken(null)
        throw new Error('Impossibile recuperare il profilo utente')
      }

      setUser(profile)
      setAuthed(true)

      return profile
    } finally {
      setLoading(false)
    }
  }

  /**
   * logout
   * Logs out user and clears access token and profile.
   */
  async function logout() {
    try {
      await authlessApi.post('/auth/logout', null) // optional if endpoint exists
    } catch {}
    setAccessToken(null)
    setUser(null)
    setAuthed(false)
  }

  // Memoize context value for performance
  const value = useMemo(
    () => ({
      isAuthenticated: authed,
      ready,
      loading,
      user,
      role: user?.role ?? null,
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }),
    [authed, ready, loading, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth
 * Hook to access authentication context.
 * Throws error if used outside AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
