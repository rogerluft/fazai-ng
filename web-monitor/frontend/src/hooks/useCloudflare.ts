import { useState, useCallback } from 'react';
import type {
  CloudflareZone,
  DNSRecord,
  CreateDNSRecordPayload,
  FirewallRule,
  SSLSettings,
  UpdateSSLPayload,
  CachePurgePayload,
  Analytics,
  CloudflareAPIResponse,
  CloudflareError,
} from '../types/cloudflare.types';

const API_BASE_URL = 'http://localhost:3001/api/integrations/cloudflare';
const AUTH_CREDENTIALS = btoa('admin:fazai123');

interface FetchOptions extends RequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
}

interface UseCloudflareReturn {
  zones: CloudflareZone[];
  dnsRecords: DNSRecord[];
  firewallRules: FirewallRule[];
  sslSettings: SSLSettings | null;
  analytics: Analytics | null;
  loading: boolean;
  error: CloudflareError | null;
  fetchZones: () => Promise<void>;
  fetchDNSRecords: (zoneId: string) => Promise<void>;
  createDNSRecord: (zoneId: string, payload: CreateDNSRecordPayload) => Promise<boolean>;
  deleteDNSRecord: (zoneId: string, recordId: string) => Promise<boolean>;
  fetchFirewallRules: (zoneId: string) => Promise<void>;
  fetchSSLSettings: (zoneId: string) => Promise<void>;
  updateSSLSettings: (zoneId: string, payload: UpdateSSLPayload) => Promise<boolean>;
  purgeCache: (zoneId: string, payload: CachePurgePayload) => Promise<boolean>;
  fetchAnalytics: (zoneId: string) => Promise<void>;
  clearError: () => void;
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<CloudflareAPIResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Basic ${AUTH_CREDENTIALS}`,
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

export function useCloudflare(): UseCloudflareReturn {
  const [zones, setZones] = useState<CloudflareZone[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [sslSettings, setSslSettings] = useState<SSLSettings | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CloudflareError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<CloudflareZone[]>('/zones');

      if (response.success) {
        setZones(response.result);
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to fetch zones';
        setError({ message: errorMsg, code: response.errors[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDNSRecords = useCallback(async (zoneId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<DNSRecord[]>(`/zones/${zoneId}/dns`);

      if (response.success) {
        setDnsRecords(response.result);
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to fetch DNS records';
        setError({ message: errorMsg, code: response.errors[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const createDNSRecord = useCallback(async (
    zoneId: string,
    payload: CreateDNSRecordPayload
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<DNSRecord>(`/zones/${zoneId}/dns`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.success) {
        await fetchDNSRecords(zoneId);
        return true;
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to create DNS record';
        setError({ message: errorMsg, code: response.errors[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDNSRecords]);

  const deleteDNSRecord = useCallback(async (
    zoneId: string,
    recordId: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ id: string }>(`/zones/${zoneId}/dns/${recordId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        await fetchDNSRecords(zoneId);
        return true;
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to delete DNS record';
        setError({ message: errorMsg, code: response.errors[0]?.code });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDNSRecords]);

  const fetchFirewallRules = useCallback(async (zoneId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<FirewallRule[]>(`/zones/${zoneId}/firewall`);

      if (response.success) {
        setFirewallRules(response.result);
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to fetch firewall rules';
        setError({ message: errorMsg, code: response.errors[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSSLSettings = useCallback(async (zoneId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<SSLSettings>(`/zones/${zoneId}/ssl`);

      if (response.success) {
        setSslSettings(response.result);
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to fetch SSL settings';
        setError({ message: errorMsg, code: response.errors[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSSLSettings = useCallback(async (
    zoneId: string,
    payload: UpdateSSLPayload
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<SSLSettings>(`/zones/${zoneId}/ssl`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (response.success) {
        setSslSettings(response.result);
        return true;
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to update SSL settings';
        setError({ message: errorMsg, code: response.errors[0]?.code });
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

  const purgeCache = useCallback(async (
    zoneId: string,
    payload: CachePurgePayload
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ id: string }>(`/zones/${zoneId}/cache/purge`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.success) {
        return true;
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to purge cache';
        setError({ message: errorMsg, code: response.errors[0]?.code });
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

  const fetchAnalytics = useCallback(async (zoneId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<Analytics>(`/zones/${zoneId}/analytics`);

      if (response.success) {
        setAnalytics(response.result);
      } else {
        const errorMsg = response.errors[0]?.message || 'Failed to fetch analytics';
        setError({ message: errorMsg, code: response.errors[0]?.code });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    zones,
    dnsRecords,
    firewallRules,
    sslSettings,
    analytics,
    loading,
    error,
    fetchZones,
    fetchDNSRecords,
    createDNSRecord,
    deleteDNSRecord,
    fetchFirewallRules,
    fetchSSLSettings,
    updateSSLSettings,
    purgeCache,
    fetchAnalytics,
    clearError,
  };
}
