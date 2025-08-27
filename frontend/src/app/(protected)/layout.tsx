// Import the component that restricts access to authenticated users only
import AuthGuard from '@/components/auth-guard';

// Import the main application layout component
import { AppShell } from '@/components/app-shell';

/**
 * ProtectedLayout
 * This layout wraps protected pages, ensuring only authenticated users can access them.
 * It also provides the main application shell structure.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    // AuthGuard checks authentication before rendering children
    <AuthGuard>
      {/* AppShell provides the main UI structure */}
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}