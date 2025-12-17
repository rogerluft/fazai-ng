/**
 * Cloudflare API Routes
 * Endpoints for managing Cloudflare resources
 */

import { Router, Request, Response } from 'express';
import { CloudflareManager } from '../../../../src/cloudflare-manager';

const router = Router();

/**
 * Cloudflare API response interface matching frontend expectations
 */
interface CloudflareAPIResponse<T = unknown> {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
}

/**
 * Helper to create CloudflareManager instance
 */
function getManager(): CloudflareManager {
  return new CloudflareManager();
}

/**
 * Helper to create success response
 */
function successResponse<T>(result: T): CloudflareAPIResponse<T> {
  return {
    success: true,
    result,
    errors: [],
    messages: []
  };
}

/**
 * Helper to create error response
 */
function errorResponse(code: number, message: string): CloudflareAPIResponse<never> {
  return {
    success: false,
    result: null as never,
    errors: [{ code, message }],
    messages: []
  };
}

/**
 * GET /zones - List all Cloudflare zones
 */
router.get('/zones', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const zones = await manager.listZones();
    res.status(200).json(successResponse(zones));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error listing zones:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * GET /zones/:zoneId/dns - List DNS records for a zone
 */
router.get('/zones/:zoneId/dns', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const manager = getManager();
    const records = await manager.listDNSRecords(zoneId);
    res.status(200).json(successResponse(records));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error listing DNS records:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * POST /zones/:zoneId/dns - Create DNS record
 */
router.post('/zones/:zoneId/dns', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const recordData = req.body;

    if (!recordData.type || !recordData.name || !recordData.content) {
      return res.status(400).json(errorResponse(400, 'Missing required fields: type, name, content'));
    }

    const manager = getManager();
    const record = await manager.createDNSRecord(zoneId, recordData);
    res.status(201).json(successResponse(record));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error creating DNS record:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * DELETE /zones/:zoneId/dns/:recordId - Delete DNS record
 */
router.delete('/zones/:zoneId/dns/:recordId', async (req: Request, res: Response) => {
  try {
    const { zoneId, recordId } = req.params;
    const manager = getManager();
    await manager.deleteDNSRecord(zoneId, recordId);
    res.status(200).json(successResponse({ id: recordId }));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error deleting DNS record:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * GET /zones/:zoneId/firewall - List firewall rules
 */
router.get('/zones/:zoneId/firewall', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const manager = getManager();
    const rules = await manager.listFirewallRules(zoneId);
    res.status(200).json(successResponse(rules));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error listing firewall rules:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * GET /zones/:zoneId/ssl - Get SSL settings
 */
router.get('/zones/:zoneId/ssl', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const manager = getManager();
    const settings = await manager.getSSLSettings(zoneId);
    res.status(200).json(successResponse(settings));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error getting SSL settings:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * PATCH /zones/:zoneId/ssl - Update SSL mode
 */
router.patch('/zones/:zoneId/ssl', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { mode } = req.body;

    if (!mode || !['off', 'flexible', 'full', 'strict'].includes(mode)) {
      return res.status(400).json(errorResponse(400, 'Invalid SSL mode. Must be: off, flexible, full, or strict'));
    }

    const manager = getManager();
    const settings = await manager.updateSSLMode(zoneId, mode);
    res.status(200).json(successResponse(settings));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error updating SSL mode:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * POST /zones/:zoneId/cache/purge - Purge cache
 */
router.post('/zones/:zoneId/cache/purge', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const options = req.body || { purge_everything: true };

    const manager = getManager();
    const result = await manager.purgeCache(zoneId, options);
    res.status(200).json(successResponse(result));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error purging cache:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

/**
 * GET /zones/:zoneId/analytics - Get analytics
 */
router.get('/zones/:zoneId/analytics', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const since = (req.query.since as string) || '-1440';

    const manager = getManager();
    const analytics = await manager.getAnalytics(zoneId, since);
    res.status(200).json(successResponse(analytics));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Cloudflare] Error getting analytics:', err.message);
    res.status(500).json(errorResponse(500, err.message));
  }
});

export default router;
