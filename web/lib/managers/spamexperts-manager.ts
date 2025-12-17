/**
 * SpamExpertsManager - Self-contained implementation for Next.js API routes
 * Manages SpamExperts email protection integration
 */

import { loadConfig } from './config-loader';

export interface SpamExpertsDomain {
  domain: string;
  status: 'active' | 'pending' | 'suspended';
  created: string;
  mxRecords: string[];
  deliveryHost: string;
  totalMessages: number;
  spamBlocked: number;
  virusBlocked: number;
}

export interface SpamExpertsQuarantineItem {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  size: number;
  reason: string;
  score: number;
}

export interface SpamExpertsReport {
  domain: string;
  period: string;
  totalMessages: number;
  deliveredMessages: number;
  blockedSpam: number;
  blockedVirus: number;
  quarantined: number;
  rejected: number;
}

export interface SpamExpertsListEntry {
  address: string;
  type: 'whitelist' | 'blacklist';
  scope: 'sender' | 'recipient' | 'domain';
  created: string;
}

export class SpamExpertsManager {
  private host: string;
  private apiKey: string;

  constructor() {
    const config = loadConfig();
    this.host = config.spamExpertsHost || process.env.SPAMEXPERTS_HOST || '';
    this.apiKey = config.spamExpertsApiKey || process.env.SPAMEXPERTS_API_KEY || '';
  }

  private async request(endpoint: string, method: string = 'GET', body?: unknown): Promise<unknown> {
    if (!this.host || !this.apiKey) {
      throw new Error('SpamExperts configuration missing. Set SPAMEXPERTS_HOST and SPAMEXPERTS_API_KEY');
    }

    const url = `${this.host}/api/${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SpamExperts API error: ${response.status} - ${text}`);
    }

    return response.json();
  }

  // Domains
  async getDomains(): Promise<SpamExpertsDomain[]> {
    const response = await this.request('domains') as { domains: SpamExpertsDomain[] };
    return response.domains || [];
  }

  async getDomain(domain: string): Promise<SpamExpertsDomain | null> {
    try {
      return await this.request(`domains/${encodeURIComponent(domain)}`) as SpamExpertsDomain;
    } catch {
      return null;
    }
  }

  async addDomain(domain: string, deliveryHost: string): Promise<SpamExpertsDomain> {
    return await this.request('domains', 'POST', { domain, deliveryHost }) as SpamExpertsDomain;
  }

  async updateDomain(domain: string, settings: Partial<SpamExpertsDomain>): Promise<SpamExpertsDomain> {
    return await this.request(`domains/${encodeURIComponent(domain)}`, 'PUT', settings) as SpamExpertsDomain;
  }

  async deleteDomain(domain: string): Promise<void> {
    await this.request(`domains/${encodeURIComponent(domain)}`, 'DELETE');
  }

  // Quarantine
  async getQuarantine(domain?: string, limit: number = 100): Promise<SpamExpertsQuarantineItem[]> {
    const params = new URLSearchParams();
    if (domain) params.set('domain', domain);
    params.set('limit', limit.toString());

    const response = await this.request(`quarantine?${params.toString()}`) as { items: SpamExpertsQuarantineItem[] };
    return response.items || [];
  }

  async releaseQuarantineItem(id: string): Promise<void> {
    await this.request(`quarantine/${id}/release`, 'POST');
  }

  async deleteQuarantineItem(id: string): Promise<void> {
    await this.request(`quarantine/${id}`, 'DELETE');
  }

  async releaseAllQuarantine(domain: string): Promise<{ released: number }> {
    return await this.request(`quarantine/release-all`, 'POST', { domain }) as { released: number };
  }

  // Reports
  async getReport(domain: string, period: 'day' | 'week' | 'month' = 'day'): Promise<SpamExpertsReport> {
    return await this.request(`reports/${encodeURIComponent(domain)}?period=${period}`) as SpamExpertsReport;
  }

  async getReports(period: 'day' | 'week' | 'month' = 'day'): Promise<SpamExpertsReport[]> {
    const response = await this.request(`reports?period=${period}`) as { reports: SpamExpertsReport[] };
    return response.reports || [];
  }

  // Whitelist/Blacklist
  async getWhitelist(domain?: string): Promise<SpamExpertsListEntry[]> {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    const response = await this.request(`lists/whitelist${params}`) as { entries: SpamExpertsListEntry[] };
    return response.entries || [];
  }

  async getBlacklist(domain?: string): Promise<SpamExpertsListEntry[]> {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    const response = await this.request(`lists/blacklist${params}`) as { entries: SpamExpertsListEntry[] };
    return response.entries || [];
  }

  async addToWhitelist(address: string, scope: 'sender' | 'recipient' | 'domain' = 'sender'): Promise<SpamExpertsListEntry> {
    return await this.request('lists/whitelist', 'POST', { address, scope }) as SpamExpertsListEntry;
  }

  async addToBlacklist(address: string, scope: 'sender' | 'recipient' | 'domain' = 'sender'): Promise<SpamExpertsListEntry> {
    return await this.request('lists/blacklist', 'POST', { address, scope }) as SpamExpertsListEntry;
  }

  async removeFromWhitelist(address: string): Promise<void> {
    await this.request(`lists/whitelist/${encodeURIComponent(address)}`, 'DELETE');
  }

  async removeFromBlacklist(address: string): Promise<void> {
    await this.request(`lists/blacklist/${encodeURIComponent(address)}`, 'DELETE');
  }

  // Statistics
  async getStatistics(domain?: string): Promise<{
    totalDomains: number;
    totalMessages: number;
    spamBlocked: number;
    virusBlocked: number;
    quarantined: number;
  }> {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return await this.request(`statistics${params}`) as {
      totalDomains: number;
      totalMessages: number;
      spamBlocked: number;
      virusBlocked: number;
      quarantined: number;
    };
  }
}
