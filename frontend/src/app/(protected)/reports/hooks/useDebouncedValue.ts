'use client';

import * as React from 'react';

/**
 * Simple debounced value hook.
 * - Returns the latest `value` only after `delay` ms of inactivity.
 * - Prevents spamming the API while typing/filtering.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}