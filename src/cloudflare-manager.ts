/**
 * Cloudflare API Manager
 * Gerencia recursos Cloudflare via API
 */

import { loadConfig } from './config';

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  account: {
    id: string;
    name: string;
  };
}

interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

interface CloudflareWorker {
  id: string;
  name: string;
  script: string;
  routes?: string[];
}

// Interfaces for new methods
interface CloudflareFirewallRule {
  id: string;
  description: string;
  action: string;
  paused: boolean;
  filter: {
    id: string;
    expression: string;
    paused: boolean;
  };
}

interface CloudflareSSLSettings {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  editable: boolean;
  modified_on: string;
}

interface CloudflareCachePurge {
  id: string;
}

interface CloudflareAnalytics {
  totals: {
    requests: number;
    bandwidth: number;
    threats: number;
    pageviews: number;
  };
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
      throw new Error('CLOUDFLARE_API_KEY não configurada');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
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

  // Zones
  async listZones(): Promise<CloudflareZone[]> {
    return this.request('/zones');
  }

  async getZone(zoneId: string): Promise<CloudflareZone> {
    return this.request(`/zones/${zoneId}`);
  }

  // DNS Records
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

  // Workers
  async listWorkers(): Promise<CloudflareWorker[]> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }
    return this.request(`/accounts/${this.accountId}/workers/scripts`);
  }

  async deployWorker(name: string, script: string, routes?: string[]): Promise<void> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }

    await this.request(`/accounts/${this.accountId}/workers/scripts/${name}`, {
      method: 'PUT',
      body: script,
      headers: {
        'Content-Type': 'application/javascript',
      },
    });

    if (routes && routes.length > 0) {
      for (const route of routes) {
        await this.createWorkerRoute(name, route);
      }
    }
  }

  async createWorkerRoute(workerName: string, pattern: string): Promise<void> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }

    const zones = await this.listZones();
    if (zones.length === 0) {
      throw new Error('Nenhuma zona encontrada');
    }

    const zoneId = zones[0].id;

    await this.request(`/zones/${zoneId}/workers/routes`, {
      method: 'POST',
      body: JSON.stringify({
        pattern,
        script: workerName,
      }),
    });
  }

  async getWorker(name: string): Promise<string> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }
    return this.request(`/accounts/${this.accountId}/workers/scripts/${name}`);
  }

  async deleteWorker(name: string): Promise<void> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }
    return this.request(`/accounts/${this.accountId}/workers/scripts/${name}`, {
      method: 'DELETE',
    });
  }

  // AI Gateway (Gemini via Cloudflare)
  async createAIGateway(name: string, config: any): Promise<any> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }

    return this.request(`/accounts/${this.accountId}/ai-gateway/gateways`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...config,
      }),
    });
  }

  async listAIGateways(): Promise<any[]> {
    if (!this.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID não configurada');
    }
    return this.request(`/accounts/${this.accountId}/ai-gateway/gateways`);
  }

  // Firewall Rules
  async listFirewallRules(zoneId: string): Promise<CloudflareFirewallRule[]> {
    return this.request(`/zones/${zoneId}/firewall/rules`);
  }

  // SSL Settings
  async getSSLSettings(zoneId: string): Promise<CloudflareSSLSettings> {
    return this.request(`/zones/${zoneId}/settings/ssl`);
  }

  async updateSSLMode(zoneId: string, mode: 'off' | 'flexible' | 'full' | 'strict'): Promise<CloudflareSSLSettings> {
    return this.request(`/zones/${zoneId}/settings/ssl`, {
      method: 'PATCH',
      body: JSON.stringify({ value: mode }),
    });
  }

  // Cache
  async purgeCache(zoneId: string, options: { purge_everything?: boolean; files?: string[]; tags?: string[] }): Promise<CloudflareCachePurge> {
    const body: any = {};
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

  // Analytics
  async getAnalytics(zoneId: string, since: string = '-1440'): Promise<CloudflareAnalytics> {
    // since: -1440 for last 24 hours
    const response = await this.request(`/zones/${zoneId}/analytics/dashboard?since=${since}`);
    return response;
  }
}
