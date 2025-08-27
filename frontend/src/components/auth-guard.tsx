'use client';

// Import authentication context hook
import { useAuth } from '@/contexts/auth-context';
// Import Next.js router for navigation
import { useRouter } from 'next/navigation';
// Import React's useEffect hook
import { useEffect } from 'react';

/**
 * AuthGuard
 * Protects routes by redirecting unauthenticated users to the login page.
 * Renders children only if authentication is ready and user is authenticated.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, router]);

  // Show nothing until authentication state is ready or user is authenticated
  if (!ready) return null;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}