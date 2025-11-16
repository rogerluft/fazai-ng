/**
 * Cloudflare API Integration
 * Gerencia zones, DNS records, workers, pages e configurações via API
 */

import https from 'https';

interface CloudflareConfig {
  apiToken?: string;
  email?: string;
  apiKey?: string;
  accountId?: string;
}

interface Zone {
  id: string;
  name: string;
  status: string;
  account: { id: string; name: string };
}

interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

export class CloudflareAPI {
  private config: CloudflareConfig;
  private baseUrl = 'api.cloudflare.com';

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  private async request(method: string, path: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiToken) {
        headers['Authorization'] = `Bearer ${this.config.apiToken}`;
      } else if (this.config.email && this.config.apiKey) {
        headers['X-Auth-Email'] = this.config.email;
        headers['X-Auth-Key'] = this.config.apiKey;
      } else {
        throw new Error('API Token ou Email+API Key são obrigatórios');
      }

      const body = data ? JSON.stringify(data) : undefined;
      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body).toString();
      }

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/client/v4${path}`,
        method,
        headers,
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (parsed.success) {
              resolve(parsed.result);
            } else {
              reject(new Error(`Cloudflare API Error: ${JSON.stringify(parsed.errors)}`));
            }
          } catch (err) {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async listZones(): Promise<Zone[]> {
    return this.request('GET', '/zones');
  }

  async getZone(zoneId: string): Promise<Zone> {
    return this.request('GET', `/zones/${zoneId}`);
  }

  async listDNSRecords(zoneId: string, filters?: { type?: string; name?: string }): Promise<DNSRecord[]> {
    const params = new URLSearchParams(filters as any).toString();
    const path = `/zones/${zoneId}/dns_records${params ? '?' + params : ''}`;
    return this.request('GET', path);
  }

  async createDNSRecord(zoneId: string, record: Partial<DNSRecord>): Promise<DNSRecord> {
    return this.request('POST', `/zones/${zoneId}/dns_records`, record);
  }

  async updateDNSRecord(zoneId: string, recordId: string, record: Partial<DNSRecord>): Promise<DNSRecord> {
    return this.request('PUT', `/zones/${zoneId}/dns_records/${recordId}`, record);
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<{ id: string }> {
    return this.request('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
  }

  async purgeCache(zoneId: string, options?: { files?: string[]; tags?: string[]; hosts?: string[] }): Promise<any> {
    return this.request('POST', `/zones/${zoneId}/purge_cache`, options || { purge_everything: true });
  }

  async getSSLSettings(zoneId: string): Promise<any> {
    return this.request('GET', `/zones/${zoneId}/settings/ssl`);
  }

  async updateSSLSettings(zoneId: string, value: 'off' | 'flexible' | 'full' | 'strict'): Promise<any> {
    return this.request('PATCH', `/zones/${zoneId}/settings/ssl`, { value });
  }

  async listWorkers(accountId?: string): Promise<any[]> {
    const accId = accountId || this.config.accountId;
    if (!accId) throw new Error('Account ID required');
    return this.request('GET', `/accounts/${accId}/workers/scripts`);
  }

  async deployWorker(accountId: string, scriptName: string, script: string, metadata?: any): Promise<any> {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata || {}));
    formData.append('script', new Blob([script], { type: 'application/javascript' }));
    return this.request('PUT', `/accounts/${accountId}/workers/scripts/${scriptName}`, formData);
  }

  async listPages(accountId?: string): Promise<any[]> {
    const accId = accountId || this.config.accountId;
    if (!accId) throw new Error('Account ID required');
    return this.request('GET', `/accounts/${accId}/pages/projects`);
  }

  async getPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<any> {
    return this.request('GET', `/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`);
  }
}

export function loadCloudflareConfig(): CloudflareConfig {
  const config: CloudflareConfig = {};
  
  if (process.env.CLOUDFLARE_API_TOKEN) {
    config.apiToken = process.env.CLOUDFLARE_API_TOKEN;
  } else if (process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_API_KEY) {
    config.email = process.env.CLOUDFLARE_EMAIL;
    config.apiKey = process.env.CLOUDFLARE_API_KEY;
  }
  
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    config.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  }
  
  return config;
}
