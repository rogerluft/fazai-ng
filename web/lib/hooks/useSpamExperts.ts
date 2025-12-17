'use client';

import { useState, useCallback } from 'react';
import { getAuthHeader } from '@/lib/api-client';
import type {
  SpamExpertsDomain,
  QuarantineMessage,
  SpamReport,
  ListEntry,
  AddDomainPayload,
  AddListEntryPayload,
  SpamExpertsAPIResponse,
  SpamExpertsError,
} from '@/types/spamexperts.types';

// Use relative URL for Next.js API routes
const API_BASE_URL = '/api/integrations/spamexperts';

interface FetchOptions extends RequestInit {
  method?: 'GET' | 'POST' | 'DELETE';
}

interface UseSpamExpertsReturn {
  domains: SpamExpertsDomain[];
  quarantine: QuarantineMessage[];
  report: SpamReport | null;
  whitelist: ListEntry[];
  blacklist: ListEntry[];
  loading: boolean;
  error: SpamExpertsError | null;
  fetchDomains: () => Promise<void>;
  addDomain: (payload: AddDomainPayload) => Promise<boolean>;
  removeDomain: (domain: string) => Promise<boolean>;
  fetchQuarantine: (domain: string) => Promise<void>;
  releaseMessage: (id: string) => Promise<boolean>;
  deleteMessage: (id: string) => Promise<boolean>;
  fetchReport: (domain: string, period?: '24h' | '7d' | '30d') => Promise<void>;
  fetchList: (type: 'whitelist' | 'blacklist') => Promise<void>;
  addToList: (type: 'whitelist' | 'blacklist', payload: AddListEntryPayload) => Promise<boolean>;
  removeFromList: (type: 'whitelist' | 'blacklist', entry: string) => Promise<boolean>;
  clearError: () => void;
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<SpamExpertsAPIResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
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

export function useSpamExperts(): UseSpamExpertsReturn {
  const [domains, setDomains] = useState<SpamExpertsDomain[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineMessage[]>([]);
  const [report, setReport] = useState<SpamReport | null>(null);
  const [whitelist, setWhitelist] = useState<ListEntry[]>([]);
  const [blacklist, setBlacklist] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SpamExpertsError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<SpamExpertsDomain[]>('/domains');

      if (response.success) {
        setDomains(response.result);
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to fetch domains';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const addDomain = useCallback(async (payload: AddDomainPayload): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<SpamExpertsDomain>('/domains', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.success) {
        await fetchDomains();
        return true;
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to add domain';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDomains]);

  const removeDomain = useCallback(async (domain: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ domain: string }>(`/domains/${domain}`, {
        method: 'DELETE',
      });

      if (response.success) {
        await fetchDomains();
        return true;
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to remove domain';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDomains]);

  const fetchQuarantine = useCallback(async (domain: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<QuarantineMessage[]>(`/quarantine/${domain}`);

      if (response.success) {
        setQuarantine(response.result);
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to fetch quarantine';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const releaseMessage = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ id: string }>(`/quarantine/${id}/release`, {
        method: 'POST',
      });

      if (response.success) {
        setQuarantine(prev => prev.filter(msg => msg.id !== id));
        return true;
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to release message';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ id: string }>(`/quarantine/${id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        setQuarantine(prev => prev.filter(msg => msg.id !== id));
        return true;
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to delete message';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReport = useCallback(async (
    domain: string,
    period: '24h' | '7d' | '30d' = '24h'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<SpamReport>(`/reports/${domain}?period=${period}`);

      if (response.success) {
        setReport(response.result);
      } else {
        const errorMsg = response.errors?.[0]?.message || 'Failed to fetch report';
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchList = useCallback(async (type: 'whitelist' | 'blacklist') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<ListEntry[]>(`/lists/${type}`);

      if (response.success) {
        if (type === 'whitelist') {
          setWhitelist(response.result);
        } else {
          setBlacklist(response.result);
        }
      } else {
        const errorMsg = response.errors?.[0]?.message || `Failed to fetch ${type}`;
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const addToList = useCallback(async (
    type: 'whitelist' | 'blacklist',
    payload: AddListEntryPayload
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<ListEntry>(`/lists/${type}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.success) {
        await fetchList(type);
        return true;
      } else {
        const errorMsg = response.errors?.[0]?.message || `Failed to add to ${type}`;
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  const removeFromList = useCallback(async (
    type: 'whitelist' | 'blacklist',
    entry: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ entry: string }>(`/lists/${type}/${encodeURIComponent(entry)}`, {
        method: 'DELETE',
      });

      if (response.success) {
        await fetchList(type);
        return true;
      } else {
        const errorMsg = response.errors?.[0]?.message || `Failed to remove from ${type}`;
        setError({ message: errorMsg, code: response.errors?.[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  return {
    domains,
    quarantine,
    report,
    whitelist,
    blacklist,
    loading,
    error,
    fetchDomains,
    addDomain,
    removeDomain,
    fetchQuarantine,
    releaseMessage,
    deleteMessage,
    fetchReport,
    fetchList,
    addToList,
    removeFromList,
    clearError,
  };
}
