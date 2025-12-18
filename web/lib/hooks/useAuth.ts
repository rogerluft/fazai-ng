/**
 * Authentication hook for FazAI Web UI
 * Provides fetch wrapper with Basic Auth
 */

'use client';

import { useCallback } from 'react';

// Default credentials - can be customized via localStorage or context
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'fazai123';

interface AuthCredentials {
  username: string;
  password: string;
}

/**
 * Get stored credentials or defaults
 */
function getCredentials(): AuthCredentials {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('fazai_auth');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Invalid stored credentials, use defaults
      }
    }
  }
  return { username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD };
}

/**
 * Store credentials in localStorage
 */
export function setCredentials(username: string, password: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('fazai_auth', JSON.stringify({ username, password }));
  }
}

/**
 * Clear stored credentials
 */
export function clearCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('fazai_auth');
  }
}

/**
 * Hook that provides authenticated fetch function
 */
export function useAuth() {
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const creds = getCredentials();
    const authHeader = btoa(`${creds.username}:${creds.password}`);

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
    });
  }, []);

  const login = useCallback((username: string, password: string) => {
    setCredentials(username, password);
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
  }, []);

  const getStoredCredentials = useCallback(() => {
    return getCredentials();
  }, []);

  return {
    fetchWithAuth,
    login,
    logout,
    getStoredCredentials,
  };
}

/**
 * Standalone fetch with auth (for use outside React components)
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const creds = getCredentials();
  const authHeader = btoa(`${creds.username}:${creds.password}`);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
  });
}
