'use client';

// Import theme context hook
import { useTheme } from 'next-themes';
// Import icons for theme toggle
import { Moon, Sun } from 'lucide-react';
// Import custom Button component
import { Button } from '@/components/ui/button';
import * as React from 'react';

/**
 * ThemeToggle
 * Button to toggle between light and dark themes.
 * Shows sun icon for dark mode, moon icon for light mode.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}