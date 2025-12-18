/**
 * OPNsenseManager - Self-contained implementation for Next.js API routes
 * Manages OPNsense firewall integration
 */

import { loadConfig } from './config-loader';

export interface OPNsenseFirewallRule {
  uuid?: string;
  enabled: boolean;
  sequence: number;
  action: 'pass' | 'block' | 'reject';
  interface: string;
  direction: 'in' | 'out' | 'any';
  protocol: string;
  source: string;
  destination: string;
  port: string;
  description: string;
  log: boolean;
}

export interface OPNsenseNATRule {
  uuid?: string;
  enabled: boolean;
  interface: string;
  protocol: string;
  source: string;
  destination: string;
  target: string;
  targetPort: string;
  description: string;
}

export interface OPNsenseVPNTunnel {
  uuid?: string;
  name: string;
  type: 'ipsec' | 'openvpn' | 'wireguard';
  status: 'up' | 'down' | 'connecting';
  localSubnet: string;
  remoteSubnet: string;
  remoteGateway: string;
}

export interface OPNsenseInterface {
  name: string;
  description: string;
  enabled: boolean;
  ipaddr: string;
  subnet: number;
  gateway?: string;
  status: 'up' | 'down';
  macaddr: string;
}

export interface OPNsenseDHCPLease {
  address: string;
  hostname: string;
  mac: string;
  starts: string;
  ends: string;
  status: 'active' | 'expired' | 'reserved';
}

export interface OPNsenseSystemStatus {
  uptime: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  temperature?: number;
  version: string;
  hostname: string;
}

export class OPNsenseManager {
  private host: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    const config = loadConfig();
    this.host = config.opnsenseHost || process.env.OPNSENSE_HOST || '';
    this.apiKey = config.opnsenseApiKey || process.env.OPNSENSE_API_KEY || '';
    this.apiSecret = config.opnsenseApiSecret || process.env.OPNSENSE_API_SECRET || '';
  }

  private async request(endpoint: string, method: string = 'GET', body?: unknown): Promise<unknown> {
    if (!this.host || !this.apiKey || !this.apiSecret) {
      throw new Error('OPNsense configuration missing. Set OPNSENSE_HOST, OPNSENSE_API_KEY, and OPNSENSE_API_SECRET');
    }

    const url = `${this.host}/api/${endpoint}`;
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OPNsense API error: ${response.status} - ${text}`);
    }

    return response.json();
  }

  // Firewall Rules
  async getFirewallRules(): Promise<OPNsenseFirewallRule[]> {
    const response = await this.request('firewall/filter/searchRule') as { rows: OPNsenseFirewallRule[] };
    return response.rows || [];
  }

  async createFirewallRule(rule: Omit<OPNsenseFirewallRule, 'uuid'>): Promise<OPNsenseFirewallRule> {
    const response = await this.request('firewall/filter/addRule', 'POST', { rule }) as { uuid: string };
    return { ...rule, uuid: response.uuid };
  }

  async updateFirewallRule(uuid: string, rule: Partial<OPNsenseFirewallRule>): Promise<OPNsenseFirewallRule> {
    await this.request(`firewall/filter/setRule/${uuid}`, 'POST', { rule });
    return { ...rule, uuid } as OPNsenseFirewallRule;
  }

  async deleteFirewallRule(uuid: string): Promise<void> {
    await this.request(`firewall/filter/delRule/${uuid}`, 'POST');
  }

  async applyFirewallRules(): Promise<void> {
    await this.request('firewall/filter/apply', 'POST');
  }

  // NAT Rules
  async getNATRules(): Promise<OPNsenseNATRule[]> {
    const response = await this.request('firewall/nat/searchRule') as { rows: OPNsenseNATRule[] };
    return response.rows || [];
  }

  async createNATRule(rule: Omit<OPNsenseNATRule, 'uuid'>): Promise<OPNsenseNATRule> {
    const response = await this.request('firewall/nat/addRule', 'POST', { rule }) as { uuid: string };
    return { ...rule, uuid: response.uuid };
  }

  async updateNATRule(uuid: string, rule: Partial<OPNsenseNATRule>): Promise<OPNsenseNATRule> {
    await this.request(`firewall/nat/setRule/${uuid}`, 'POST', { rule });
    return { ...rule, uuid } as OPNsenseNATRule;
  }

  async deleteNATRule(uuid: string): Promise<void> {
    await this.request(`firewall/nat/delRule/${uuid}`, 'POST');
  }

  // VPN Tunnels
  async getVPNTunnels(): Promise<OPNsenseVPNTunnel[]> {
    try {
      const ipsec = await this.request('ipsec/tunnel/searchPhase1') as { rows: unknown[] };
      const tunnels: OPNsenseVPNTunnel[] = (ipsec.rows || []).map((t: unknown) => {
        const tunnel = t as Record<string, unknown>;
        return {
          uuid: tunnel.uuid as string,
          name: tunnel.descr as string || 'IPsec Tunnel',
          type: 'ipsec' as const,
          status: (tunnel.enabled as string) === '1' ? 'up' as const : 'down' as const,
          localSubnet: tunnel.local_subnet as string || '',
          remoteSubnet: tunnel.remote_subnet as string || '',
          remoteGateway: tunnel.remote_gateway as string || '',
        };
      });
      return tunnels;
    } catch {
      return [];
    }
  }

  // Interfaces
  async getInterfaces(): Promise<OPNsenseInterface[]> {
    const response = await this.request('interfaces/overview/export') as Record<string, unknown>;
    const interfaces: OPNsenseInterface[] = [];

    for (const [name, data] of Object.entries(response)) {
      const iface = data as Record<string, unknown>;
      interfaces.push({
        name,
        description: iface.descr as string || name,
        enabled: (iface.enable as string) === '1',
        ipaddr: iface.ipaddr as string || '',
        subnet: parseInt(iface.subnet as string || '24', 10),
        gateway: iface.gateway as string,
        status: (iface.status as string) === 'up' ? 'up' : 'down',
        macaddr: iface.macaddr as string || '',
      });
    }

    return interfaces;
  }

  // DHCP Leases
  async getDHCPLeases(): Promise<OPNsenseDHCPLease[]> {
    const response = await this.request('dhcpv4/leases/searchLease') as { rows: unknown[] };
    return (response.rows || []).map((lease: unknown) => {
      const l = lease as Record<string, unknown>;
      return {
        address: l.address as string || '',
        hostname: l.hostname as string || 'Unknown',
        mac: l.mac as string || '',
        starts: l.starts as string || '',
        ends: l.ends as string || '',
        status: (l.state as string) === 'active' ? 'active' as const : 'expired' as const,
      };
    });
  }

  // System Status
  async getSystemStatus(): Promise<OPNsenseSystemStatus> {
    try {
      const [dashboard, firmware] = await Promise.all([
        this.request('diagnostics/activity/getActivity') as Promise<Record<string, unknown>>,
        this.request('core/firmware/status') as Promise<Record<string, unknown>>,
      ]);

      return {
        uptime: dashboard.uptime as string || 'Unknown',
        cpuUsage: parseFloat(dashboard.cpu as string || '0'),
        memoryUsage: parseFloat(dashboard.memory as string || '0'),
        diskUsage: parseFloat(dashboard.disk as string || '0'),
        temperature: dashboard.temperature ? parseFloat(dashboard.temperature as string) : undefined,
        version: firmware.product_version as string || 'Unknown',
        hostname: firmware.product_name as string || 'OPNsense',
      };
    } catch {
      return {
        uptime: 'Unknown',
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        version: 'Unknown',
        hostname: 'OPNsense',
      };
    }
  }
}
