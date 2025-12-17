/**
 * Config loader for Next.js API routes
 * Loads configuration from fazai.conf or environment variables
 */

import * as fs from 'fs';
import * as path from 'path';

interface FazAIConfig {
  cloudflareApiKey?: string;
  cloudflareAccountId?: string;
  spamExpertsApiKey?: string;
  spamExpertsHost?: string;
  opnsenseHost?: string;
  opnsenseApiKey?: string;
  opnsenseApiSecret?: string;
  webUiUsername?: string;
  webUiPassword?: string;
}

let cachedConfig: FazAIConfig | null = null;

export function loadConfig(): FazAIConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const config: FazAIConfig = {};

  // Try to load from fazai.conf
  const configPaths = [
    '/etc/fazai/fazai.conf',
    path.join(process.env.HOME || '', '.config/fazai/fazai.conf'),
    path.join(process.cwd(), 'fazai.conf'),
    path.join(process.cwd(), '../fazai.conf'),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) {
            continue;
          }

          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');

          switch (key.trim().toUpperCase()) {
            case 'CLOUDFLARE_API_KEY':
              config.cloudflareApiKey = value;
              break;
            case 'CLOUDFLARE_ACCOUNT_ID':
              config.cloudflareAccountId = value;
              break;
            case 'SPAMEXPERTS_API_KEY':
              config.spamExpertsApiKey = value;
              break;
            case 'SPAMEXPERTS_HOST':
              config.spamExpertsHost = value;
              break;
            case 'OPNSENSE_HOST':
              config.opnsenseHost = value;
              break;
            case 'OPNSENSE_API_KEY':
              config.opnsenseApiKey = value;
              break;
            case 'OPNSENSE_API_SECRET':
              config.opnsenseApiSecret = value;
              break;
            case 'WEB_UI_USERNAME':
              config.webUiUsername = value;
              break;
            case 'WEB_UI_PASSWORD':
              config.webUiPassword = value;
              break;
          }
        }
        break; // Found and loaded config, stop searching
      }
    } catch {
      // Continue to next config path
    }
  }

  // Override with environment variables
  config.cloudflareApiKey = process.env.CLOUDFLARE_API_KEY || config.cloudflareApiKey;
  config.cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.cloudflareAccountId;
  config.spamExpertsApiKey = process.env.SPAMEXPERTS_API_KEY || config.spamExpertsApiKey;
  config.spamExpertsHost = process.env.SPAMEXPERTS_HOST || config.spamExpertsHost;
  config.opnsenseHost = process.env.OPNSENSE_HOST || config.opnsenseHost;
  config.opnsenseApiKey = process.env.OPNSENSE_API_KEY || config.opnsenseApiKey;
  config.opnsenseApiSecret = process.env.OPNSENSE_API_SECRET || config.opnsenseApiSecret;
  config.webUiUsername = process.env.WEB_UI_USERNAME || config.webUiUsername || 'admin';
  config.webUiPassword = process.env.WEB_UI_PASSWORD || config.webUiPassword || 'fazai123';

  cachedConfig = config;
  return config;
}

/**
 * Get web UI credentials from config
 */
export function getWebUICredentials(): { username: string; password: string } {
  const config = loadConfig();
  return {
    username: config.webUiUsername || 'admin',
    password: config.webUiPassword || 'fazai123',
  };
}
