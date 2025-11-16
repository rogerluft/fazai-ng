/**
 * Cloudflare CLI Commands
 */

import { CloudflareAPI, loadCloudflareConfig } from '../cloudflare.js';

export async function handleCloudflare(args: string[]): Promise<void> {
  const config = loadCloudflareConfig();
  
  if (!config.apiToken && !(config.email && config.apiKey)) {
    console.error('❌ Configure CLOUDFLARE_API_TOKEN no fazai.conf ou environment');
    console.error('   Ou use CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY');
    console.error('   Obtenha em: https://dash.cloudflare.com/profile/api-tokens');
    process.exit(1);
  }

  const cf = new CloudflareAPI(config);
  const [command, ...params] = args;

  try {
    switch (command) {
      case 'zones':
      case 'list-zones': {
        const zones = await cf.listZones();
        console.log('\n📋 Cloudflare Zones:\n');
        zones.forEach((z: any) => {
          console.log(`  ${z.name} (${z.id})`);
          console.log(`    Status: ${z.status} | Account: ${z.account.name}\n`);
        });
        break;
      }

      case 'dns': {
        const [subCmd, zoneId, ...dnsParams] = params;
        
        if (subCmd === 'list') {
          const records = await cf.listDNSRecords(zoneId);
          console.log(`\n📝 DNS Records for zone ${zoneId}:\n`);
          records.forEach((r: any) => {
            console.log(`  ${r.type} ${r.name} → ${r.content}`);
            console.log(`    ID: ${r.id} | TTL: ${r.ttl} | Proxied: ${r.proxied}\n`);
          });
        } else if (subCmd === 'add') {
          const [type, name, content, ttl = '1', proxied = 'false'] = dnsParams;
          const record = await cf.createDNSRecord(zoneId, {
            type,
            name,
            content,
            ttl: parseInt(ttl),
            proxied: proxied === 'true',
          });
          console.log(`✅ DNS Record created: ${record.id}`);
        } else if (subCmd === 'delete') {
          const [recordId] = dnsParams;
          await cf.deleteDNSRecord(zoneId, recordId);
          console.log(`✅ DNS Record ${recordId} deleted`);
        } else {
          console.error('Usage: fazai cf dns [list|add|delete] <zoneId> [...params]');
        }
        break;
      }

      case 'purge': {
        const [zoneId, ...files] = params;
        if (files.length > 0) {
          await cf.purgeCache(zoneId, { files });
          console.log(`✅ Cache purged for ${files.length} files`);
        } else {
          await cf.purgeCache(zoneId);
          console.log('✅ Full cache purge completed');
        }
        break;
      }

      case 'ssl': {
        const [subCmd, zoneId, value] = params;
        if (subCmd === 'get') {
          const settings = await cf.getSSLSettings(zoneId);
          console.log(`🔒 SSL Mode: ${settings.value}`);
        } else if (subCmd === 'set') {
          await cf.updateSSLSettings(zoneId, value as any);
          console.log(`✅ SSL mode updated to: ${value}`);
        }
        break;
      }

      case 'workers': {
        const workers = await cf.listWorkers(config.accountId);
        console.log('\n⚡ Cloudflare Workers:\n');
        workers.forEach((w: any) => {
          console.log(`  ${w.id} - ${w.created_on}\n`);
        });
        break;
      }

      case 'pages': {
        const projects = await cf.listPages(config.accountId);
        console.log('\n📄 Cloudflare Pages:\n');
        projects.forEach((p: any) => {
          console.log(`  ${p.name} (${p.id})`);
          console.log(`    Production: ${p.production_branch}\n`);
        });
        break;
      }

      case 'help':
      default: {
        console.log(`
🌐 FazAI Cloudflare Integration

Usage:
  fazai cf zones                           # List all zones
  fazai cf dns list <zoneId>              # List DNS records
  fazai cf dns add <zoneId> <type> <name> <content> [ttl] [proxied]
  fazai cf dns delete <zoneId> <recordId>
  fazai cf purge <zoneId> [file1] [file2] # Purge cache
  fazai cf ssl get <zoneId>               # Get SSL settings
  fazai cf ssl set <zoneId> <mode>        # Set SSL (off|flexible|full|strict)
  fazai cf workers                        # List workers
  fazai cf pages                          # List pages projects

Configuration:
  Set in fazai.conf or environment:
    CLOUDFLARE_API_TOKEN=your-token
    CLOUDFLARE_ACCOUNT_ID=your-account-id
  
  Or use legacy auth:
    CLOUDFLARE_EMAIL=you@example.com
    CLOUDFLARE_API_KEY=your-key

Get API tokens: https://dash.cloudflare.com/profile/api-tokens
        `);
      }
    }
  } catch (error: any) {
    console.error(`❌ Cloudflare API Error: ${error.message}`);
    process.exit(1);
  }
}
