'use client'
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { authlessApi } from '@/lib/api-client'
import { setAccessToken, getAccessToken } from '@/lib/token'

type LoginInput = { username: string; password: string }

type AuthContextType = {
  isAuthenticated: boolean
  ready: boolean
  loading: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

// Create authentication context
const AuthContext = createContext<AuthContextType | null>(null)

/**
 * AuthProvider
 * Provides authentication state and actions to the app.
 * Handles login, logout, and token refresh logic.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false) // gating for hydration

  // On mount, check for access token or try to refresh via cookie
  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const existing = getAccessToken()
        if (existing) {
          if (!cancelled) {
            setAuthed(true)
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
          if (!cancelled) {
            setAccessToken(data.access_token)
            setAuthed(true)
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
   * Authenticates user and stores access token.
   */
  async function login(input: LoginInput) {
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
      setAuthed(true)
    } finally {
      setLoading(false)
    }
  }

  /**
   * logout
   * Logs out user and clears access token.
   */
  async function logout() {
    try {
      await authlessApi.post('/auth/logout', null) // optional if endpoint exists
    } catch {}
    setAccessToken(null)
    setAuthed(false)
  }

  // Memoize context value for performance
  const value = useMemo(
    () => ({ isAuthenticated: authed, ready, loading, login, logout }),
    [authed, ready, loading]
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