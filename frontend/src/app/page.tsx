'use client';

// Import React's useEffect hook for side effects
import { useEffect } from 'react';

// Import Next.js router for client-side navigation
import { useRouter } from 'next/navigation';

/**
 * Index
 * Redirects users from the root path to the /home page.
 * This component does not render any UI.
 */
export default function Index() {
  const router = useRouter();

  // On mount, redirect to /home
  useEffect(() => {
    router.replace('/home');
  }, [router]);

  // No UI is rendered
  return null;
}