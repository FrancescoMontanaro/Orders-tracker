import * as React from 'react';

// Simple debounced state: re-emits value only after "delay" ms of idleness.
// Prevents hammering the API while the user is typing.
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}