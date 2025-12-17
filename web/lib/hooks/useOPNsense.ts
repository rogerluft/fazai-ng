'use client';

import { useState, useCallback } from 'react';
import { getAuthHeader } from '@/lib/api-client';
import type {
  FirewallRule,
  CreateFirewallRulePayload,
  NATRule,
  CreateNATRulePayload,
  VPNTunnel,
  NetworkInterface,
  DHCPLease,
  SystemStatus,
  OPNsenseAPIResponse,
  OPNsenseError,
} from '@/types/opnsense.types';

// Use relative URL for Next.js API routes
const API_BASE_URL = '/api/integrations/opnsense';

interface FetchOptions extends RequestInit {
  method?: 'GET' | 'POST' | 'DELETE';
}

interface UseOPNsenseReturn {
  firewallRules: FirewallRule[];
  natRules: NATRule[];
  vpnTunnels: VPNTunnel[];
  interfaces: NetworkInterface[];
  dhcpLeases: DHCPLease[];
  systemStatus: SystemStatus | null;
  loading: boolean;
  error: OPNsenseError | null;
  fetchFirewallRules: () => Promise<void>;
  addFirewallRule: (payload: CreateFirewallRulePayload) => Promise<boolean>;
  deleteFirewallRule: (uuid: string) => Promise<boolean>;
  applyFirewallChanges: () => Promise<boolean>;
  fetchNATRules: () => Promise<void>;
  addNATRule: (payload: CreateNATRulePayload) => Promise<boolean>;
  deleteNATRule: (uuid: string) => Promise<boolean>;
  applyNATChanges: () => Promise<boolean>;
  fetchVPNTunnels: () => Promise<void>;
  connectVPN: (ikeid: string) => Promise<boolean>;
  disconnectVPN: (ikeid: string) => Promise<boolean>;
  fetchInterfaces: () => Promise<void>;
  fetchDHCPLeases: () => Promise<void>;
  fetchSystemStatus: () => Promise<void>;
  clearError: () => void;
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<OPNsenseAPIResponse<T>> {
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

export function useOPNsense(): UseOPNsenseReturn {
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [natRules, setNatRules] = useState<NATRule[]>([]);
  const [vpnTunnels, setVpnTunnels] = useState<VPNTunnel[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [dhcpLeases, setDhcpLeases] = useState<DHCPLease[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<OPNsenseError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Firewall operations
  const fetchFirewallRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<FirewallRule[]>('/firewall');

      if (response.result === 'ok' && response.data) {
        setFirewallRules(response.data);
      } else {
        const errorMsg = response.message || 'Failed to fetch firewall rules';
        setError({ message: errorMsg });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const addFirewallRule = useCallback(async (
    payload: CreateFirewallRulePayload
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ uuid: string }>('/firewall', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.result === 'ok') {
        await fetchFirewallRules();
        return true;
      } else {
        const errorMsg = response.message || 'Failed to add firewall rule';
        setError({ message: errorMsg });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFirewallRules]);

  const deleteFirewallRule = useCallback(async (uuid: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<void>(`/firewall/${uuid}`, {
        method: 'DELETE',
      });

      if (response.result === 'ok') {
        await fetchFirewallRules();
        return true;
      } else {
        const errorMsg = response.message || 'Failed to delete firewall rule';
        setError({ message: errorMsg });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFirewallRules]);

  const applyFirewallChanges = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<void>('/firewall/apply', {
        method: 'POST',
      });

      if (response.result === 'ok') {
        return true;
      } else {
        const errorMsg = response.message || 'Failed to apply firewall changes';
        setError({ message: errorMsg });
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

  // NAT operations
  const fetchNATRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<NATRule[]>('/nat');

      if (response.result === 'ok' && response.data) {
        setNatRules(response.data);
      } else {
        const errorMsg = response.message || 'Failed to fetch NAT rules';
        setError({ message: errorMsg });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const addNATRule = useCallback(async (
    payload: CreateNATRulePayload
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<{ uuid: string }>('/nat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.result === 'ok') {
        await fetchNATRules();
        return true;
      } else {
        const errorMsg = response.message || 'Failed to add NAT rule';
        setError({ message: errorMsg });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchNATRules]);

  const deleteNATRule = useCallback(async (uuid: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<void>(`/nat/${uuid}`, {
        method: 'DELETE',
      });

      if (response.result === 'ok') {
        await fetchNATRules();
        return true;
      } else {
        const errorMsg = response.message || 'Failed to delete NAT rule';
        setError({ message: errorMsg });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchNATRules]);

  const applyNATChanges = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<void>('/nat/apply', {
        method: 'POST',
      });

      if (response.result === 'ok') {
        return true;
      } else {
        const errorMsg = response.message || 'Failed to apply NAT changes';
        setError({ message: errorMsg });
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

  // VPN operations
  const fetchVPNTunnels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<VPNTunnel[]>('/vpn');

      if (response.result === 'ok' && response.data) {
        setVpnTunnels(response.data);
      } else {
        const errorMsg = response.message || 'Failed to fetch VPN tunnels';
        setError({ message: errorMsg });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const connectVPN = useCallback(async (ikeid: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<void>(`/vpn/${ikeid}/connect`, {
        method: 'POST',
      });

      if (response.result === 'ok') {
        await fetchVPNTunnels();
        return true;
      } else {
        const errorMsg = response.message || 'Failed to connect VPN';
        setError({ message: errorMsg });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchVPNTunnels]);

  const disconnectVPN = useCallback(async (ikeid: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<void>(`/vpn/${ikeid}/disconnect`, {
        method: 'POST',
      });

      if (response.result === 'ok') {
        await fetchVPNTunnels();
        return true;
      } else {
        const errorMsg = response.message || 'Failed to disconnect VPN';
        setError({ message: errorMsg });
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchVPNTunnels]);

  // Interfaces
  const fetchInterfaces = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<NetworkInterface[]>('/interfaces');

      if (response.result === 'ok' && response.data) {
        setInterfaces(response.data);
      } else {
        const errorMsg = response.message || 'Failed to fetch interfaces';
        setError({ message: errorMsg });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  // DHCP Leases
  const fetchDHCPLeases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<DHCPLease[]>('/dhcp/leases');

      if (response.result === 'ok' && response.data) {
        setDhcpLeases(response.data);
      } else {
        const errorMsg = response.message || 'Failed to fetch DHCP leases';
        setError({ message: errorMsg });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  // System Status
  const fetchSystemStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth<SystemStatus>('/system/status');

      if (response.result === 'ok' && response.data) {
        setSystemStatus(response.data);
      } else {
        const errorMsg = response.message || 'Failed to fetch system status';
        setError({ message: errorMsg });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    firewallRules,
    natRules,
    vpnTunnels,
    interfaces,
    dhcpLeases,
    systemStatus,
    loading,
    error,
    fetchFirewallRules,
    addFirewallRule,
    deleteFirewallRule,
    applyFirewallChanges,
    fetchNATRules,
    addNATRule,
    deleteNATRule,
    applyNATChanges,
    fetchVPNTunnels,
    connectVPN,
    disconnectVPN,
    fetchInterfaces,
    fetchDHCPLeases,
    fetchSystemStatus,
    clearError,
  };
}
