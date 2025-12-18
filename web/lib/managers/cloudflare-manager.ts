/**
 * CloudflareManager for Next.js API routes
 * Provides Cloudflare API integration
 */

import { loadConfig } from './config-loader';

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  account: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    frequency: string;
    legacy_id: string;
    is_subscribed: boolean;
    can_subscribe: boolean;
  };
  name_servers: string[];
  original_name_servers: string[];
  original_registrar: string | null;
  original_dnshost: string | null;
  created_on: string;
  modified_on: string;
  activated_on: string | null;
  paused: boolean;
  type: string;
}

export interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  proxiable: boolean;
  ttl: number;
  locked: boolean;
  zone_id: string;
  zone_name: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareFirewallRule {
  id: string;
  description: string;
  action: string;
  paused: boolean;
  priority: number | null;
  filter: {
    id: string;
    expression: string;
    paused: boolean;
    description: string;
  };
  created_on: string;
  modified_on: string;
}

export interface CloudflareSSLSettings {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  editable: boolean;
  modified_on: string;
}

export interface CloudflareAnalytics {
  totals: {
    requests: { all: number; cached: number; uncached: number };
    bandwidth: { all: number; cached: number; uncached: number };
    threats: { all: number };
    pageviews: { all: number };
    uniques: { all: number };
  };
  timeseries: Array<Record<string, unknown>>;
}

export class CloudflareManager {
  private apiKey: string;
  private accountId: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor() {
    const config = loadConfig();
    this.apiKey = config.cloudflareApiKey || process.env.CLOUDFLARE_API_KEY || '';
    this.accountId = config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';

    if (!this.apiKey) {
      throw new Error('CLOUDFLARE_API_KEY not configured');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
    }

    return data.result;
  }

  async listZones(): Promise<CloudflareZone[]> {
    return this.request('/zones');
  }

  async getZone(zoneId: string): Promise<CloudflareZone> {
    return this.request(`/zones/${zoneId}`);
  }

  async listDNSRecords(zoneId: string): Promise<CloudflareDNSRecord[]> {
    return this.request(`/zones/${zoneId}/dns_records`);
  }

  async createDNSRecord(
    zoneId: string,
    record: Partial<CloudflareDNSRecord>
  ): Promise<CloudflareDNSRecord> {
    return this.request(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  async updateDNSRecord(
    zoneId: string,
    recordId: string,
    record: Partial<CloudflareDNSRecord>
  ): Promise<CloudflareDNSRecord> {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<void> {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async listFirewallRules(zoneId: string): Promise<CloudflareFirewallRule[]> {
    return this.request(`/zones/${zoneId}/firewall/rules`);
  }

  async getSSLSettings(zoneId: string): Promise<CloudflareSSLSettings> {
    return this.request(`/zones/${zoneId}/settings/ssl`);
  }

  async updateSSLMode(
    zoneId: string,
    mode: 'off' | 'flexible' | 'full' | 'strict'
  ): Promise<CloudflareSSLSettings> {
    return this.request(`/zones/${zoneId}/settings/ssl`, {
      method: 'PATCH',
      body: JSON.stringify({ value: mode }),
    });
  }

  async purgeCache(
    zoneId: string,
    options: { purge_everything?: boolean; files?: string[]; tags?: string[] }
  ): Promise<{ id: string }> {
    const body: Record<string, unknown> = {};
    if (options.purge_everything) {
      body.purge_everything = true;
    } else if (options.files) {
      body.files = options.files;
    } else if (options.tags) {
      body.tags = options.tags;
    }

    return this.request(`/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getAnalytics(zoneId: string, since: string = '-1440'): Promise<CloudflareAnalytics> {
    return this.request(`/zones/${zoneId}/analytics/dashboard?since=${since}`);
  }
}
