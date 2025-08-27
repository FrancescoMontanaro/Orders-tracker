'use client';

// Import NextThemesProvider for theme management
import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * ThemeProvider
 * Provides theme context (light/dark/system) to all children.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}