// Frontend configuration
// Reads from environment variables or falls back to defaults

function getBackendUrl(): string {
  // Check if running in browser (client-side)
  if (typeof window !== 'undefined') {
    // Try to read from window location (same host, different port)
    const hostname = window.location.hostname;
    const port = import.meta.env.VITE_BACKEND_PORT || '3001';
    return `http://${hostname}:${port}`;
  }

  // Fallback for Docker or server-side rendering
  const backendHost = import.meta.env.VITE_BACKEND_HOST || 'localhost';
  const backendPort = import.meta.env.VITE_BACKEND_PORT || '3001';
  return `http://${backendHost}:${backendPort}`;
}

export const config = {
  backendUrl: getBackendUrl(),
  apiEndpoints: {
    tasks: '/api/tasks',
    taskById: (id: string) => `/api/tasks/${id}`,
    taskStream: (id: string) => `/api/tasks/${id}/stream`,
  },
};

export const getApiUrl = (endpoint: string): string => {
  return `${config.backendUrl}${endpoint}`;
};
