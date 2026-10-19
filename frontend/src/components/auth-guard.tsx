'use client';

// Import authentication context hook
import { useAuth } from '@/contexts/auth-context';
// Import Next.js router for navigation
import { useRouter, usePathname } from 'next/navigation';
// Import React's useEffect hook
import { useEffect } from 'react';
// Import role routing helpers
import { EMPLOYEE_ALLOWED_PATHS, HOME_PATH_BY_ROLE } from '@/types/user';

/**
 * isAllowedForEmployee
 * Employees can only open the daily deliveries summary.
 */
function isAllowedForEmployee(pathname: string | null): boolean {
  if (!pathname) return false;
  return EMPLOYEE_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * AuthGuard
 * Protects routes by redirecting unauthenticated users to the login page,
 * and employees to the only page they are allowed to see.
 * The backend enforces the same rules: this is only a UX shortcut.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Employees outside their allowed page must be redirected
  const blockedForRole = role === 'employee' && !isAllowedForEmployee(pathname);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (blockedForRole) {
      router.replace(HOME_PATH_BY_ROLE.employee);
    }
  }, [ready, isAuthenticated, blockedForRole, router]);

  // Show nothing until authentication state is ready or user is authenticated
  if (!ready) return null;
  if (!isAuthenticated) return null;
  if (blockedForRole) return null;

  return <>{children}</>;
}
