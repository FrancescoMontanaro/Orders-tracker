import * as React from 'react';

/**
 * Returns a value that only updates after `delay` ms of inactivity.
 * Helps throttling inputs tied to network requests.
 */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
