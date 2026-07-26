'use client';

// Import React's useEffect hook for side effects
import { useEffect } from 'react';

// Import Next.js router for client-side navigation
import { useRouter } from 'next/navigation';

// Import authentication context hook and role routing map
import { useAuth } from '@/contexts/auth-context';
import { HOME_PATH_BY_ROLE } from '@/types/user';

/**
 * Index
 * Redirects users from the root path to the landing page of their role.
 * This component does not render any UI.
 */
export default function Index() {
  const router = useRouter();
  const { ready, role } = useAuth();

  // Wait for the auth boot to resolve, so employees are not bounced through /home
  useEffect(() => {
    if (!ready) return;
    router.replace(role === 'employee' ? HOME_PATH_BY_ROLE.employee : HOME_PATH_BY_ROLE.admin);
  }, [ready, role, router]);

  // No UI is rendered
  return null;
}
