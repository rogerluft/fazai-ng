/**
 * OPNsense API Routes
 * Endpoints for managing OPNsense firewall and network
 */

import { Router, Request, Response } from 'express';
import { OPNsenseManager } from '../../../../src/opnsense-manager';

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
 * Helper to create OPNsenseManager instance
 */
function getManager(): OPNsenseManager {
  return new OPNsenseManager();
}

// ============================================================================
// Firewall Routes
// ============================================================================

/**
 * GET /firewall - List firewall rules
 */
router.get('/firewall', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const rules = await manager.listFirewallRules();

    const response: ApiResponse = {
      success: true,
      data: rules
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error listing firewall rules:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /firewall - Add firewall rule
 */
router.post('/firewall', async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;

    // Validate required fields
    if (!ruleData.action || !ruleData.interface || !ruleData.protocol) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: action, interface, protocol'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    await manager.addFirewallRule(ruleData);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Firewall rule added successfully' }
    };
    res.status(201).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error adding firewall rule:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /firewall/:uuid - Delete firewall rule
 */
router.delete('/firewall/:uuid', async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;
    const manager = getManager();
    await manager.deleteFirewallRule(uuid);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Firewall rule deleted successfully', uuid }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error deleting firewall rule:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /firewall/apply - Apply firewall changes
 */
router.post('/firewall/apply', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    await manager.applyFirewallChanges();

    const response: ApiResponse = {
      success: true,
      data: { message: 'Firewall changes applied successfully' }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error applying firewall changes:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// NAT Routes
// ============================================================================

/**
 * GET /nat - List NAT rules
 */
router.get('/nat', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const rules = await manager.listNATRules();

    const response: ApiResponse = {
      success: true,
      data: rules
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error listing NAT rules:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /nat - Add port forward rule
 */
router.post('/nat', async (req: Request, res: Response) => {
  try {
    const natData = req.body;

    // Validate required fields
    if (!natData.interface || !natData.protocol || !natData.externalPort || !natData.internalIP || !natData.internalPort) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: interface, protocol, externalPort, internalIP, internalPort'
      };
      return res.status(400).json(response);
    }

    const manager = getManager();
    await manager.addPortForward(natData);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Port forward rule added successfully' }
    };
    res.status(201).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error adding port forward:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /nat/:uuid - Delete NAT rule
 */
router.delete('/nat/:uuid', async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;
    const manager = getManager();
    await manager.deletePortForward(uuid);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Port forward rule deleted successfully', uuid }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error deleting port forward:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /nat/apply - Apply NAT changes
 */
router.post('/nat/apply', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    await manager.applyNATChanges();

    const response: ApiResponse = {
      success: true,
      data: { message: 'NAT changes applied successfully' }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error applying NAT changes:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// VPN Routes
// ============================================================================

/**
 * GET /vpn - List VPN tunnels
 */
router.get('/vpn', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const tunnels = await manager.listVPNTunnels();

    const response: ApiResponse = {
      success: true,
      data: tunnels
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error listing VPN tunnels:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /vpn/:ikeid/connect - Connect VPN tunnel
 */
router.post('/vpn/:ikeid/connect', async (req: Request, res: Response) => {
  try {
    const { ikeid } = req.params;
    const manager = getManager();
    await manager.connectVPN(ikeid);

    const response: ApiResponse = {
      success: true,
      data: { message: 'VPN tunnel connected successfully', ikeid }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error connecting VPN:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * POST /vpn/:ikeid/disconnect - Disconnect VPN tunnel
 */
router.post('/vpn/:ikeid/disconnect', async (req: Request, res: Response) => {
  try {
    const { ikeid } = req.params;
    const manager = getManager();
    await manager.disconnectVPN(ikeid);

    const response: ApiResponse = {
      success: true,
      data: { message: 'VPN tunnel disconnected successfully', ikeid }
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error disconnecting VPN:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// Network Routes
// ============================================================================

/**
 * GET /interfaces - List network interfaces
 */
router.get('/interfaces', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const interfaces = await manager.listInterfaces();

    const response: ApiResponse = {
      success: true,
      data: interfaces
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error listing interfaces:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * GET /dhcp/leases - List DHCP leases
 */
router.get('/dhcp/leases', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const leases = await manager.listDHCPLeases();

    const response: ApiResponse = {
      success: true,
      data: leases
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error listing DHCP leases:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

/**
 * GET /system/status - Get system status
 */
router.get('/system/status', async (req: Request, res: Response) => {
  try {
    const manager = getManager();
    const status = await manager.getSystemStatus();

    const response: ApiResponse = {
      success: true,
      data: status
    };
    res.status(200).json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[OPNsense] Error getting system status:', err.message);

    const response: ApiResponse = {
      success: false,
      error: err.message
    };
    res.status(500).json(response);
  }
});

export default router;
