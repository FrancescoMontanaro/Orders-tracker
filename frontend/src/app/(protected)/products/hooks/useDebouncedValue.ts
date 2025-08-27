import * as React from 'react';

/**
 * Returns a value that updates only after "delay" ms of inactivity.
 * Useful to avoid spamming the backend while the user is typing.
 * (Same behavior as before; simply isolated.)
 */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}