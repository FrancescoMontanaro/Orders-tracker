// Import Next.js metadata type for static site metadata
import type { Metadata } from 'next';

// Import the ThemeProvider to manage application themes (light/dark mode)
import { ThemeProvider } from '@/components/theme-provider';

// Import the AuthProvider to manage authentication state across the app
import { AuthProvider } from '@/contexts/auth-context';

// Import global CSS styles for the entire application
import './globals.css';

// Define static metadata for the application (title and description)
export const metadata: Metadata = {
  title: 'Tracker Ordini',
  description: 'Applicazione per la gestione degli ordini e delle consegne',
  icons: {
    icon: '/icons/logo_32x32.png', // default favicon
    shortcut: '/icons/logo_16x16.png', // older browsers
    apple: '/icons/logo.png', // iOS home screen
  }
};

/**
 * RootLayout
 * This is the root layout for the entire application.
 * It wraps all pages with ThemeProvider and AuthProvider,
 * and sets up the HTML structure and language.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        {/* ThemeProvider manages theme state (e.g., dark/light mode) */}
        <ThemeProvider>
          {/* AuthProvider supplies authentication context to all children */}
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}