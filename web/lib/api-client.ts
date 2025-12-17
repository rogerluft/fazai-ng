/**
 * API Client with authentication for FazAI Web UI
 * Provides consistent fetch wrapper with Basic Auth
 */

'use client';

// Default credentials
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'fazai123';

interface AuthCredentials {
  username: string;
  password: string;
}

/**
 * Get stored credentials from localStorage or use defaults
 */
export function getCredentials(): AuthCredentials {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('fazai_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.username && parsed.password) {
          return parsed;
        }
      } catch {
        // Invalid stored credentials
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
 * Get Authorization header value
 */
export function getAuthHeader(): string {
  const creds = getCredentials();
  return `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
}

/**
 * Make authenticated API request
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
