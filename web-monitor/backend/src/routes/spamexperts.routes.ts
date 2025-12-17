/**
 * SpamExperts API Routes
 * Endpoints for managing SpamExperts domains and quarantine
 */

import { Router, Request, Response } from 'express';
import { SpamExpertsManager } from '../../../../src/spamexperts-manager';

const router = Router();

/**
 * Standard API response interface
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Helper to create SpamExpertsManager instance
 */
function getManager(): SpamExpertsManager {
  return new SpamExpertsManager();
}

/**
 * GET /domains - List all domains
 */
router.get('/domains', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const domains = await manager.listDomains();

    const response: ApiResponse = {
      success: true,
      data: domains
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error listing domains:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /domains - Add domain
 */
router.post('/domains', async (req: Request, res: Response) => {
  try {
    const { domain, destination } = req.body;

    if (!domain || !destination) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: domain, destination'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    await manager.addDomain(domain, destination);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Domain added successfully', domain }
    };
    res.status(201).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error adding domain:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /domains/:domain - Remove domain
 */
router.delete('/domains/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const manager = getManager();
    await manager.removeDomain(domain);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Domain removed successfully', domain }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error removing domain:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * GET /quarantine/:domain - List quarantine messages for domain
 */
router.get('/quarantine/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const manager = getManager();
    const messages = await manager.listQuarantine(domain, limit);

    const response: ApiResponse = {
      success: true,
      data: messages
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error listing quarantine:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /quarantine/:messageId/release - Release quarantined message
 */
router.post('/quarantine/:messageId/release', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const manager = getManager();
    await manager.releaseMessage(messageId);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Message released successfully', messageId }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error releasing message:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /quarantine/:messageId - Delete quarantined message
 */
router.delete('/quarantine/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const manager = getManager();
    await manager.deleteMessage(messageId);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Message deleted successfully', messageId }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error deleting message:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * GET /reports/:domain - Get report for domain
 */
router.get('/reports/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';

    if (!['24h', '7d', '30d'].includes(period)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid period. Must be: 24h, 7d, or 30d'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    const report = await manager.getReport(period);

    const response: ApiResponse = {
      success: true,
      data: report
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error getting report:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * GET /lists/:type - List whitelist/blacklist entries
 */
router.get('/lists/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    if (!['whitelist', 'blacklist'].includes(type)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid list type. Must be: whitelist or blacklist'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    const entries = await manager.listList(type as 'whitelist' | 'blacklist');

    const response: ApiResponse = {
      success: true,
      data: entries
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error listing entries:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /lists/:type - Add entry to list
 */
router.post('/lists/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { entry } = req.body;

    if (!['whitelist', 'blacklist'].includes(type)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid list type. Must be: whitelist or blacklist'
      };
      return res.status(400).json(response);
    }

    if (!entry) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required field: entry'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    await manager.addToList(type as 'whitelist' | 'blacklist', entry);

    const response: ApiResponse = {
      success: true,
      data: { message: `Entry added to ${type}`, entry }
    };
    res.status(201).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error adding entry:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /lists/:type/:entry - Remove entry from list
 */
router.delete('/lists/:type/:entry', async (req: Request, res: Response) => {
  try {
    const { type, entry } = req.params;

    if (!['whitelist', 'blacklist'].includes(type)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid list type. Must be: whitelist or blacklist'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    await manager.removeFromList(type as 'whitelist' | 'blacklist', entry);

    const response: ApiResponse = {
      success: true,
      data: { message: `Entry removed from ${type}`, entry }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SpamExperts] Error removing entry:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

export default router;
