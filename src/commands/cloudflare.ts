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
  // Tenta carregar do config primeiro
  let fazaiConfig: any = {};
  try {
    const { loadConfig } = require('../config');
    fazaiConfig = loadConfig();
  } catch (e) {
    // Fallback to env vars only
  }

  const config: CloudflareConfig = {};
  
  // Prioridade: env vars > fazai config
  // Suporta tanto CLOUDFLARE_API_TOKEN quanto CLOUDFLARE_API_KEY
  if (process.env.CLOUDFLARE_API_TOKEN || fazaiConfig.cloudflareApiToken || fazaiConfig.cloudflareApiKey) {
    config.apiToken = process.env.CLOUDFLARE_API_TOKEN || fazaiConfig.cloudflareApiToken || fazaiConfig.cloudflareApiKey;
  } else if ((process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_API_KEY) || 
             (fazaiConfig.cloudflareEmail && fazaiConfig.cloudflareApiKey)) {
    config.email = process.env.CLOUDFLARE_EMAIL || fazaiConfig.cloudflareEmail;
    config.apiKey = process.env.CLOUDFLARE_API_KEY || fazaiConfig.cloudflareApiKey;
  }
  
  if (process.env.CLOUDFLARE_ACCOUNT_ID || fazaiConfig.cloudflareAccountId) {
    config.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || fazaiConfig.cloudflareAccountId;
  }
  
  return config;
}

/**
 * CLI Handler for Cloudflare commands
 */
export async function handleCloudflare(args: string[]): Promise<void> {
  const config = loadCloudflareConfig();
  
  if (!config.apiToken && !(config.email && config.apiKey)) {
    console.error('❌ Cloudflare credentials not found.');
    console.error('Set CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL+CLOUDFLARE_API_KEY in config or environment.');
    process.exit(1);
  }
  
  const cf = new CloudflareAPI(config);
  const [action, subAction, ...params] = args;

  try {
    switch (action) {
      case 'zones':
      case 'zone': {
        const zones = await cf.listZones();
        console.log('\n📋 Cloudflare Zones:\n');
        zones.forEach((z) => {
          console.log(`  • ${z.name} (${z.id}) - ${z.status}`);
          console.log(`    Account: ${z.account.name} (${z.account.id})`);
        });
        break;
      }

      case 'dns': {
        if (subAction === 'list' && params[0]) {
          const records = await cf.listDNSRecords(params[0]);
          console.log(`\n📋 DNS Records for zone ${params[0]}:\n`);
          records.forEach((r) => {
            console.log(`  • ${r.type.padEnd(6)} ${r.name.padEnd(30)} → ${r.content}`);
            console.log(`    TTL: ${r.ttl} | Proxied: ${r.proxied ? '✅' : '❌'} | ID: ${r.id}`);
          });
        } else if (subAction === 'create' && params.length >= 3) {
          const [zoneId, type, name, content] = params;
          const proxied = params[4] === 'true' || params[4] === '1';
          const record = await cf.createDNSRecord(zoneId!, { type, name, content, proxied });
          console.log(`✅ DNS record created: ${record.id}`);
        } else if (subAction === 'delete' && params.length >= 2) {
          const [zoneId, recordId] = params;
          await cf.deleteDNSRecord(zoneId!, recordId!);
          console.log('✅ DNS record deleted');
        } else {
          console.error('❌ Usage: fazai cloudflare dns list <zoneId>');
          console.error('❌ Usage: fazai cloudflare dns create <zoneId> <type> <name> <content> [proxied]');
          console.error('❌ Usage: fazai cloudflare dns delete <zoneId> <recordId>');
        }
        break;
      }

      case 'workers':
      case 'worker': {
        if (subAction === 'list') {
          const workers = await cf.listWorkers();
          console.log('\n📋 Cloudflare Workers:\n');
          workers.forEach((w: any) => {
            console.log(`  • ${w.id}`);
          });
        } else {
          console.error('❌ Usage: fazai cloudflare workers list');
        }
        break;
      }

      case 'cache': {
        if (subAction === 'purge' && params[0]) {
          await cf.purgeCache(params[0]);
          console.log('✅ Cache purged');
        } else {
          console.error('❌ Usage: fazai cloudflare cache purge <zoneId>');
        }
        break;
      }

      case 'ssl': {
        if (subAction === 'get' && params[0]) {
          const settings = await cf.getSSLSettings(params[0]);
          console.log(`\n🔒 SSL Settings for zone ${params[0]}:`);
          console.log(`  Mode: ${settings.value}`);
        } else if (subAction === 'set' && params.length >= 2) {
          const [zoneId, mode] = params;
          if (!['off', 'flexible', 'full', 'strict'].includes(mode!)) {
            console.error('❌ Invalid SSL mode. Use: off, flexible, full, or strict');
            process.exit(1);
          }
          await cf.updateSSLSettings(zoneId!, mode as any);
          console.log(`✅ SSL mode set to: ${mode}`);
        } else {
          console.error('❌ Usage: fazai cloudflare ssl get <zoneId>');
          console.error('❌ Usage: fazai cloudflare ssl set <zoneId> <off|flexible|full|strict>');
        }
        break;
      }

      default:
        console.error(`❌ Unknown cloudflare action: ${action}\n`);
        console.log('Available commands:');
        console.log('  fazai cloudflare zones');
        console.log('  fazai cloudflare dns list <zoneId>');
        console.log('  fazai cloudflare dns create <zoneId> <type> <name> <content> [proxied]');
        console.log('  fazai cloudflare dns delete <zoneId> <recordId>');
        console.log('  fazai cloudflare workers list');
        console.log('  fazai cloudflare cache purge <zoneId>');
        console.log('  fazai cloudflare ssl get <zoneId>');
        console.log('  fazai cloudflare ssl set <zoneId> <mode>');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Cloudflare operation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
