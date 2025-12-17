/**
 * Authentication Middleware
 * Implements HTTP Basic Auth using credentials from /etc/fazai/fazai.conf
 */

import { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import basicAuth from 'express-basic-auth';

/**
 * Interface for configuration data
 */
interface AuthConfig {
  username: string;
  password: string;
}

/**
 * Loads authentication credentials from /etc/fazai/fazai.conf
 * @returns Object with username and password
 */
function loadAuthConfig(): AuthConfig {
  try {
    const configContent = readFileSync('/etc/fazai/fazai.conf', 'utf-8');
    const lines = configContent.split('\n');

    let username = 'admin'; // default
    let password = 'fazai123'; // default

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse WEB_UI_USERNAME
      if (trimmed.startsWith('WEB_UI_USERNAME=')) {
        const value = trimmed.split('=')[1]?.trim();
        if (value) {
          username = value;
        }
      }

      // Parse WEB_UI_PASSWORD
      if (trimmed.startsWith('WEB_UI_PASSWORD=')) {
        const value = trimmed.split('=')[1]?.trim();
        if (value) {
          password = value;
        }
      }
    }

    console.log(`[Auth] Loaded credentials for user: ${username}`);
    return { username, password };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(`[Auth] Could not read /etc/fazai/fazai.conf: ${err.message}`);
    console.warn('[Auth] Using default credentials: admin/fazai123');
    return { username: 'admin', password: 'fazai123' };
  }
}

/**
 * Creates and returns the basic auth middleware
 */
export function createAuthMiddleware() {
  const config = loadAuthConfig();

  // Create users object for express-basic-auth
  const users: Record<string, string> = {};
  users[config.username] = config.password;

  return basicAuth({
    users,
    challenge: true,
    realm: 'FazAI Web Monitor',
    unauthorizedResponse: (req: Request) => {
      return {
        success: false,
        error: 'Authentication required'
      };
    }
  });
}

/**
 * Export default middleware instance
 */
export const authMiddleware = createAuthMiddleware();
