'use client'

// Import Next.js router for navigation
import { useRouter } from 'next/navigation'
// Import authentication context hook
import { useAuth } from '@/contexts/auth-context'
// Import custom Button component
import { Button } from '@/components/ui/button'
// Import logout icon
import { LogOut } from 'lucide-react'
import * as React from 'react'

/**
 * LogoutButton
 * Logs out the user and redirects to the login page.
 */
export function LogoutButton() {
  const { logout } = useAuth()
  const router = useRouter()

  async function onClick() {
    await logout()
    router.replace('/login')
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <LogOut className="h-4 w-4 mr-2" />
      Logout
    </Button>
  )
}