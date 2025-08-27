let accessTokenMemory: string | null = null;
let isHydrated = false;

/**
 * getAccessToken
 * Retrieves access token from memory or sessionStorage (client-side).
 */
export function getAccessToken(): string | null {
  if (!isHydrated) {
    if (typeof window !== 'undefined') {
      accessTokenMemory = sessionStorage.getItem('access_token');
      isHydrated = true;
    }
  }
  return accessTokenMemory;
}

/**
 * setAccessToken
 * Stores access token in memory and sessionStorage (client-side).
 */
export function setAccessToken(token: string | null) {
  accessTokenMemory = token;
  if (typeof window !== 'undefined') {
    if (token) sessionStorage.setItem('access_token', token);
    else sessionStorage.removeItem('access_token');
  }
}

/**
 * hasAccessToken
 * Returns true if an access token is present.
 */
export function hasAccessToken(): boolean {
  return !!getAccessToken();
}